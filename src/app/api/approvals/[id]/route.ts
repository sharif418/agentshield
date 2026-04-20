import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const approval = await db.approvalRequest.findUnique({
      where: { requestId: id },
      include: {
        trace: {
          include: { policy: true },
        },
      },
    });

    if (!approval) {
      return NextResponse.json(
        { error: 'Approval request not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(approval);
  } catch (error) {
    console.error('Error fetching approval:', error);
    return NextResponse.json(
      { error: 'Failed to fetch approval request' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, humanReviewerId, reviewNotes, modifiedAction } = body;

    if (!status) {
      return NextResponse.json(
        { error: 'Missing required field: status' },
        { status: 400 }
      );
    }

    const validStatuses = ['APPROVED', 'REJECTED', 'MODIFIED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const existing = await db.approvalRequest.findUnique({
      where: { requestId: id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Approval request not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {
      status,
      reviewTimestamp: new Date(),
    };
    if (humanReviewerId !== undefined) updateData.humanReviewerId = humanReviewerId;
    if (reviewNotes !== undefined) updateData.reviewNotes = reviewNotes;
    if (modifiedAction !== undefined) {
      updateData.modifiedAction = typeof modifiedAction === 'string' ? modifiedAction : JSON.stringify(modifiedAction);
    }

    const approval = await db.approvalRequest.update({
      where: { requestId: id },
      data: updateData,
      include: {
        trace: {
          include: { policy: true },
        },
      },
    });

    await db.auditLog.create({
      data: {
        eventType: 'APPROVAL_DECISION',
        actor: humanReviewerId ?? 'system',
        details: JSON.stringify({
          requestId: existing.requestId,
          decision: status,
          traceId: existing.traceId,
          reviewNotes: reviewNotes ?? null,
          modifiedAction: modifiedAction ?? null,
        }),
      },
    });

    return NextResponse.json(approval);
  } catch (error) {
    console.error('Error updating approval:', error);
    return NextResponse.json(
      { error: 'Failed to update approval request' },
      { status: 500 }
    );
  }
}
