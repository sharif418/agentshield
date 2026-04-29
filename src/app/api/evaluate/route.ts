import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateApiKey } from '@/lib/auth';
import { evaluatePolicies } from '@/lib/policy-engine';
import type { Policy } from '@/lib/policy-engine';
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

    // Fetch matching policies from the database
    const policies = await db.policy.findMany({
      where: {
        enabled: true,
        agentRole,
        resource: toolName,
      },
      orderBy: { priority: 'desc' },
    });

    // Use the shared evaluation engine from @agentshieldhq/core
    // Convert DB policies to the core Policy format
    const corePolicies: Policy[] = policies.map((p) => ({
      policyId: p.policyId,
      name: p.name,
      description: p.description ?? undefined,
      agentRole: p.agentRole,
      resource: p.resource,
      action: p.action,
      permissionLevel: p.permissionLevel as Policy['permissionLevel'],
      conditionRules: p.conditionRules,
      priority: p.priority,
      enabled: p.enabled,
    }));

    const result = evaluatePolicies(corePolicies, {
      agentRole,
      toolName,
      arguments: rawArgs as Record<string, unknown>,
      action: body.action,
    });

    const decision = result.decision;
    const matchedPolicy = result.matchedPolicy;
    const reason = result.reason;

    const latency = performance.now() - startTime;

    // Create ExecutionTrace record
    const traceId = `TRC-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
    const trace = await db.executionTrace.create({
      data: {
        traceId,
        sessionId,
        agentRole,
        toolName,
        intentPayload: JSON.stringify(rawArgs ?? {}),
        evaluationResult: decision,
        matchedPolicyId: matchedPolicy ? matchedPolicy.policyId : null,
        latency: parseFloat(latency.toFixed(3)),
      },
    });

    // If REQUIRE_APPROVAL, auto-create ApprovalRequest
    let approvalRequest: { requestId: string } | null = null;
    if (decision === 'REQUIRE_APPROVAL') {
      const requestId = `APR-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
      approvalRequest = await db.approvalRequest.create({
        data: {
          requestId,
          traceId: trace.traceId,
          agentContext: JSON.stringify({ agentRole, toolName, arguments: rawArgs }),
          requestedAction: JSON.stringify({ toolName, arguments: rawArgs, policyMatch: matchedPolicy }),
          status: 'PENDING',
        },
      });
    }

    // Create AuditLog entry
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

    const response: Record<string, unknown> = {
      decision,
      traceId: trace.traceId,
      latency: trace.latency,
    };

    if (matchedPolicy) {
      response.matchedPolicy = matchedPolicy;
    }
    if (reason) {
      response.reason = reason;
    }
    if (approvalRequest) {
      response.approvalRequestId = approvalRequest.requestId;
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to evaluate policy' },
      { status: 500 }
    );
  }
}
