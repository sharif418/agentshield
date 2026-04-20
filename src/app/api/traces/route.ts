import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const agentRole = searchParams.get('agentRole');
    const evaluationResult = searchParams.get('evaluationResult');
    const toolName = searchParams.get('toolName');
    const limit = parseInt(searchParams.get('limit') ?? '50');
    const offset = parseInt(searchParams.get('offset') ?? '0');

    const where: Record<string, unknown> = {};
    if (sessionId) where.sessionId = sessionId;
    if (agentRole) where.agentRole = agentRole;
    if (evaluationResult) where.evaluationResult = evaluationResult;
    if (toolName) where.toolName = toolName;

    const [traces, total] = await Promise.all([
      db.executionTrace.findMany({
        where,
        include: { policy: true },
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.executionTrace.count({ where }),
    ]);

    return NextResponse.json({ traces, total, limit, offset });
  } catch (error) {
    console.error('Error fetching traces:', error);
    return NextResponse.json(
      { error: 'Failed to fetch traces' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sessionId,
      agentRole,
      toolName,
      intentPayload,
      evaluationResult,
      matchedPolicyId,
      latency,
    } = body;

    if (!sessionId || !agentRole || !toolName || !evaluationResult) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, agentRole, toolName, evaluationResult' },
        { status: 400 }
      );
    }

    const traceId = `TRC-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;

    const trace = await db.executionTrace.create({
      data: {
        traceId,
        sessionId,
        agentRole,
        toolName,
        intentPayload: typeof intentPayload === 'string' ? intentPayload : JSON.stringify(intentPayload),
        evaluationResult,
        matchedPolicyId,
        latency: latency ?? 0,
      },
      include: { policy: true },
    });

    return NextResponse.json(trace, { status: 201 });
  } catch (error) {
    console.error('Error creating trace:', error);
    return NextResponse.json(
      { error: 'Failed to create trace' },
      { status: 500 }
    );
  }
}
