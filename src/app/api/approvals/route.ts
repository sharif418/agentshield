import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const approvals = await db.approvalRequest.findMany({
      where,
      include: {
        trace: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(approvals);
  } catch (error) {
    console.error('Error fetching approvals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch approvals' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { traceId, agentContext, requestedAction, status } = body;

    if (!traceId || !agentContext || !requestedAction) {
      return NextResponse.json(
        { error: 'Missing required fields: traceId, agentContext, requestedAction' },
        { status: 400 }
      );
    }

    // Verify the trace exists
    const trace = await db.executionTrace.findUnique({
      where: { traceId },
    });

    if (!trace) {
      return NextResponse.json(
        { error: 'Execution trace not found' },
        { status: 404 }
      );
    }

    const requestId = `APR-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;

    const approval = await db.approvalRequest.create({
      data: {
        requestId,
        traceId,
        agentContext: typeof agentContext === 'string' ? agentContext : JSON.stringify(agentContext),
        requestedAction: typeof requestedAction === 'string' ? requestedAction : JSON.stringify(requestedAction),
        status: status ?? 'PENDING',
      },
      include: { trace: true },
    });

    return NextResponse.json(approval, { status: 201 });
  } catch (error) {
    console.error('Error creating approval request:', error);
    return NextResponse.json(
      { error: 'Failed to create approval request' },
      { status: 500 }
    );
  }
}
