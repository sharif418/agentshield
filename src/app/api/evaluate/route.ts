import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  const startTime = performance.now();

  try {
    const body = await request.json();
    const { agentRole, toolName, arguments: args } = body;

    if (!agentRole || !toolName) {
      return NextResponse.json(
        { error: 'Missing required fields: agentRole, toolName' },
        { status: 400 }
      );
    }

    const sessionId = body.sessionId ?? `SES-${Date.now().toString(36)}`;
    // Infer action from request body or from arguments
    const action = body.action ?? (args?.operation as string | undefined) ?? null;

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

    // 3. Evaluate policies in priority order
    for (const policy of policies) {
      // Check condition rules if present
      let conditionMatches = true;
      if (policy.conditionRules) {
        try {
          const rules = JSON.parse(policy.conditionRules);
          conditionMatches = evaluateConditions(rules, args ?? {});
        } catch {
          // If rules can't be parsed, treat as matching
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
        // Don't break - continue to check for BLOCK policies with lower priority
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

    const latency = performance.now() - startTime;

    // 6. Create ExecutionTrace record
    const traceId = `TRC-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
    const trace = await db.executionTrace.create({
      data: {
        traceId,
        sessionId,
        agentRole,
        toolName,
        intentPayload: JSON.stringify(args ?? {}),
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

/**
 * Given a specific action, return all policy action values that should match it.
 * E.g., "REFUND" -> ["REFUND", "WRITE"], "SELECT" -> ["SELECT", "READ"]
 */
function getMatchingActions(action: string): string[] {
  const actionMap: Record<string, string[]> = {
    // Read-type actions
    'SELECT': ['SELECT', 'READ', 'GET', 'LIST', 'SEARCH'],
    'READ': ['READ', 'SELECT', 'GET', 'LIST', 'SEARCH'],
    'GET': ['GET', 'READ', 'SELECT'],
    'LIST': ['LIST', 'READ', 'SELECT'],
    'SEARCH': ['SEARCH', 'READ', 'SELECT'],
    // Write-type actions
    'INSERT': ['INSERT', 'WRITE', 'INSERT_UPDATE_DELETE'],
    'UPDATE': ['UPDATE', 'WRITE', 'INSERT_UPDATE_DELETE'],
    'DELETE': ['DELETE', 'WRITE', 'INSERT_UPDATE_DELETE', 'ADMIN'],
    'WRITE': ['WRITE', 'INSERT', 'UPDATE', 'DELETE', 'INSERT_UPDATE_DELETE'],
    'INSERT_UPDATE_DELETE': ['INSERT_UPDATE_DELETE', 'WRITE', 'INSERT', 'UPDATE', 'DELETE'],
    // Admin-type actions
    'DROP': ['DROP', 'ADMIN', 'WRITE'],
    'ADMIN': ['ADMIN', 'DROP', 'DELETE', 'WRITE'],
    'PUSH': ['PUSH', 'WRITE'],
    'MERGE': ['MERGE', 'WRITE'],
    'DELETE_BRANCH': ['DELETE_BRANCH', 'WRITE', 'ADMIN'],
    'DELETE_REPO': ['DELETE_REPO', 'ADMIN', 'DELETE'],
    'CHANGE_SETTINGS': ['CHANGE_SETTINGS', 'ADMIN'],
    'ADD_COLLABORATOR': ['ADD_COLLABORATOR', 'ADMIN'],
    // Finance actions
    'REFUND': ['REFUND', 'WRITE'],
    'POST_MESSAGE': ['POST_MESSAGE', 'WRITE'],
    'SEND': ['SEND', 'WRITE'],
    'TRUNCATE': ['TRUNCATE', 'DROP', 'ADMIN', 'WRITE'],
  };

  // Always include the exact action itself
  const matches = actionMap[action] ?? [action];
  // Deduplicate and include original
  return [...new Set([action, ...matches])];
}

/**
 * Evaluate condition rules against provided arguments.
 * Supports: { field: "value" }, { field: { $contains: "value" } }, { $and: [...] }, { $or: [...] }
 */
function evaluateConditions(rules: Record<string, unknown>, args: Record<string, unknown>): boolean {
  // Handle logical operators
  if (rules.$and && Array.isArray(rules.$and)) {
    return (rules.$and as Record<string, unknown>[]).every((r) => evaluateConditions(r, args));
  }
  if (rules.$or && Array.isArray(rules.$or)) {
    return (rules.$or as Record<string, unknown>[]).some((r) => evaluateConditions(r, args));
  }

  // Handle field conditions
  for (const [field, condition] of Object.entries(rules)) {
    if (field.startsWith('$')) continue; // Skip logical operators already handled

    const argValue = args[field];

    if (typeof condition === 'object' && condition !== null) {
      const cond = condition as Record<string, unknown>;

      if (cond.$contains && typeof argValue === 'string') {
        if (!(argValue as string).includes(cond.$contains as string)) return false;
      } else if (cond.$equals !== undefined) {
        if (argValue !== cond.$equals) return false;
      } else if (cond.$in && Array.isArray(cond.$in)) {
        if (!cond.$in.includes(argValue)) return false;
      } else if (cond.$gt !== undefined && typeof argValue === 'number') {
        if (argValue <= (cond.$gt as number)) return false;
      } else if (cond.$lt !== undefined && typeof argValue === 'number') {
        if (argValue >= (cond.$lt as number)) return false;
      }
    } else {
      // Simple equality check
      if (argValue !== condition) return false;
    }
  }

  return true;
}
