import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateApiKey } from '@/lib/auth';
import { z } from 'zod'

const CreateApprovalSchema = z.object({
  traceId: z.string().min(1).max(100),
  agentContext: z.union([z.string(), z.record(z.unknown())]),
  requestedAction: z.union([z.string(), z.record(z.unknown())]),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'MODIFIED']).optional(),
})

export async function GET(request: NextRequest) {
  const authError = validateApiKey(request)
  if (authError) return authError

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
  const authError = validateApiKey(request)
  if (authError) return authError

  try {
    const rawBody = await request.json();
    const parseResult = CreateApprovalSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { traceId, agentContext, requestedAction, status } = parseResult.data;

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
