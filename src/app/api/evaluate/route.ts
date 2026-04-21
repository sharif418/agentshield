import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateApiKey } from '@/lib/auth';
import { evaluateConditions, inferAction, enrichArgsFromQuery, getMatchingActions } from '@/lib/policy-engine';
import { z } from 'zod'

const EvaluateSchema = z.object({
  agentRole: z.string().min(1).max(100),
  toolName: z.string().min(1).max(100),
  arguments: z.record(z.unknown()).optional(),
  action: z.string().max(100).optional(),
  sessionId: z.string().max(100).optional(),
})

export async function POST(request: NextRequest) {
  const authError = validateApiKey(request)
  if (authError) return authError

  const startTime = performance.now();

  try {
    const rawBody = await request.json();
    const parseResult = EvaluateSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const body = parseResult.data;
    const { agentRole, toolName } = body;
    const rawArgs = body.arguments ?? {};

    const sessionId = body.sessionId ?? `SES-${Date.now().toString(36)}`;
    // Infer action from request body, or smart-infer from original arguments/toolName
    const action = body.action ?? inferAction((rawArgs as Record<string, unknown>) ?? {}, toolName);
    // Enrich args with inferred operation from SQL queries for condition matching
    const args = enrichArgsFromQuery((rawArgs as Record<string, unknown>) ?? {});

    // 1. Find all enabled policies matching agentRole and resource/toolName
    // If action is specified, also filter by action for more precise matching
    const whereCondition: Record<string, unknown> = {
      enabled: true,
      agentRole,
      resource: toolName,
    };

    if (action) {
      // Match policies where the action field matches the requested action,
      // or where the action is a broader category (e.g., "WRITE" covers "INSERT", "UPDATE", "DELETE")
      whereCondition.action = {
        in: getMatchingActions(action),
      };
    }

    const policies = await db.policy.findMany({
      where: whereCondition,
      orderBy: { priority: 'desc' },
    });

    let decision: 'ALLOW' | 'BLOCK' | 'REQUIRE_APPROVAL' = 'ALLOW';
    let matchedPolicy: Record<string, unknown> | null = null;
    let reason: string | null = null;

    // 2. Sort by priority (already done by orderBy)

    // 3. Evaluate policies
    // When action is null (could not be inferred), use most-restrictive logic:
    // BLOCK > REQUIRE_APPROVAL > ALLOW across ALL matching policies (zero-trust).
    // When action is specified, use standard priority-based evaluation.
    if (action) {
      // Standard priority-based evaluation (action was successfully inferred or provided)
      for (const policy of policies) {
        // Check condition rules if present
        let conditionMatches = true;
        if (policy.conditionRules) {
          try {
            const rules = JSON.parse(policy.conditionRules);
            conditionMatches = evaluateConditions(rules, args ?? {});
          } catch {
            conditionMatches = true;
          }
        }

        if (!conditionMatches) continue;

        // BLOCK takes highest precedence
        if (policy.permissionLevel === 'BLOCK') {
          decision = 'BLOCK';
          matchedPolicy = {
            policyId: policy.policyId,
            name: policy.name,
            permissionLevel: policy.permissionLevel,
            priority: policy.priority,
            action: policy.action,
          };
          reason = `Blocked by policy: ${policy.name}`;
          break;
        }

        // REQUIRE_APPROVAL - note but continue checking for BLOCK
        if (policy.permissionLevel === 'REQUIRE_APPROVAL' && decision === 'ALLOW') {
          decision = 'REQUIRE_APPROVAL';
          matchedPolicy = {
            policyId: policy.policyId,
            name: policy.name,
            permissionLevel: policy.permissionLevel,
            priority: policy.priority,
            action: policy.action,
          };
          reason = `Requires approval per policy: ${policy.name}`;
        }

        // ALLOW - note but lower priority policies could override
        if (policy.permissionLevel === 'ALLOW' && decision === 'ALLOW') {
          matchedPolicy = {
            policyId: policy.policyId,
            name: policy.name,
            permissionLevel: policy.permissionLevel,
            priority: policy.priority,
            action: policy.action,
          };
          reason = `Allowed by policy: ${policy.name}`;
        }
      }
    } else {
      // Zero-trust mode: action could not be inferred.
      // Collect all matching policies and return the most restrictive decision.
      const blockPolicies: typeof policies = [];
      const approvalPolicies: typeof policies = [];
      const allowPolicies: typeof policies = [];

      for (const policy of policies) {
        let conditionMatches = true;
        if (policy.conditionRules) {
          try {
            const rules = JSON.parse(policy.conditionRules);
            conditionMatches = evaluateConditions(rules, args ?? {});
          } catch {
            conditionMatches = true;
          }
        }
        if (!conditionMatches) continue;

        if (policy.permissionLevel === 'BLOCK') blockPolicies.push(policy);
        else if (policy.permissionLevel === 'REQUIRE_APPROVAL') approvalPolicies.push(policy);
        else if (policy.permissionLevel === 'ALLOW') allowPolicies.push(policy);
      }

      // Most restrictive decision wins (zero-trust)
      if (blockPolicies.length > 0) {
        // Pick the highest-priority BLOCK policy
        decision = 'BLOCK';
        matchedPolicy = {
          policyId: blockPolicies[0].policyId,
          name: blockPolicies[0].name,
          permissionLevel: blockPolicies[0].permissionLevel,
          priority: blockPolicies[0].priority,
          action: blockPolicies[0].action,
        };
        reason = `Blocked by policy: ${blockPolicies[0].name} (zero-trust: action unknown)`;
      } else if (approvalPolicies.length > 0) {
        decision = 'REQUIRE_APPROVAL';
        matchedPolicy = {
          policyId: approvalPolicies[0].policyId,
          name: approvalPolicies[0].name,
          permissionLevel: approvalPolicies[0].permissionLevel,
          priority: approvalPolicies[0].priority,
          action: approvalPolicies[0].action,
        };
        reason = `Requires approval per policy: ${approvalPolicies[0].name} (zero-trust: action unknown)`;
      } else if (allowPolicies.length > 0) {
        decision = 'ALLOW';
        matchedPolicy = {
          policyId: allowPolicies[0].policyId,
          name: allowPolicies[0].name,
          permissionLevel: allowPolicies[0].permissionLevel,
          priority: allowPolicies[0].priority,
          action: allowPolicies[0].action,
        };
        reason = `Allowed by policy: ${allowPolicies[0].name}`;
      } else {
        // No matching policies at all - default deny
        decision = 'BLOCK';
        matchedPolicy = null;
        reason = 'No matching policy found (default deny: action unknown)';
      }
    }

    const latency = performance.now() - startTime;

    // 6. Create ExecutionTrace record
    const traceId = `TRC-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
    const trace = await db.executionTrace.create({
      data: {
        traceId,
        sessionId,
        agentRole,
        toolName,
        intentPayload: JSON.stringify(rawArgs ?? {}),
        evaluationResult: decision,
        matchedPolicyId: matchedPolicy ? (matchedPolicy.policyId as string) : null,
        latency: parseFloat(latency.toFixed(3)),
      },
    });

    // 4. If REQUIRE_APPROVAL, auto-create ApprovalRequest
    let approvalRequest = null;
    if (decision === 'REQUIRE_APPROVAL') {
      const requestId = `APR-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
      approvalRequest = await db.approvalRequest.create({
        data: {
          requestId,
          traceId: trace.traceId,
          agentContext: JSON.stringify({ agentRole, toolName, arguments: args }),
          requestedAction: JSON.stringify({ toolName, arguments: args, policyMatch: matchedPolicy }),
          status: 'PENDING',
        },
      });
    }

    // 7. Create AuditLog entry
    await db.auditLog.create({
      data: {
        eventType: 'TRACE_EVALUATED',
        actor: agentRole,
        details: JSON.stringify({
          traceId: trace.traceId,
          agentRole,
          toolName,
          decision,
          matchedPolicy,
          latency: trace.latency,
          approvalRequestId: approvalRequest?.requestId ?? null,
        }),
      },
    });

    const result: Record<string, unknown> = {
      decision,
      traceId: trace.traceId,
      latency: trace.latency,
    };

    if (matchedPolicy) {
      result.matchedPolicy = matchedPolicy;
    }
    if (reason) {
      result.reason = reason;
    }
    if (approvalRequest) {
      result.approvalRequestId = approvalRequest.requestId;
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error evaluating policy:', error);
    return NextResponse.json(
      { error: 'Failed to evaluate policy' },
      { status: 500 }
    );
  }
}
