import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const policy = await db.policy.findUnique({
      where: { policyId: id },
    });

    if (!policy) {
      return NextResponse.json(
        { error: 'Policy not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(policy);
  } catch (error) {
    console.error('Error fetching policy:', error);
    return NextResponse.json(
      { error: 'Failed to fetch policy' },
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

    const existing = await db.policy.findUnique({
      where: { policyId: id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Policy not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.agentRole !== undefined) updateData.agentRole = body.agentRole;
    if (body.resource !== undefined) updateData.resource = body.resource;
    if (body.action !== undefined) updateData.action = body.action;
    if (body.permissionLevel !== undefined) updateData.permissionLevel = body.permissionLevel;
    if (body.conditionRules !== undefined) updateData.conditionRules = JSON.stringify(body.conditionRules);
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.enabled !== undefined) updateData.enabled = body.enabled;

    const policy = await db.policy.update({
      where: { policyId: id },
      data: updateData,
    });

    await db.auditLog.create({
      data: {
        eventType: 'POLICY_UPDATED',
        actor: body.actor ?? 'system',
        details: JSON.stringify({
          policyId: policy.policyId,
          name: policy.name,
          updatedFields: Object.keys(updateData),
        }),
      },
    });

    return NextResponse.json(policy);
  } catch (error) {
    console.error('Error updating policy:', error);
    return NextResponse.json(
      { error: 'Failed to update policy' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.policy.findUnique({
      where: { policyId: id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Policy not found' },
        { status: 404 }
      );
    }

    await db.policy.delete({
      where: { policyId: id },
    });

    await db.auditLog.create({
      data: {
        eventType: 'POLICY_DELETED',
        actor: 'system',
        details: JSON.stringify({
          policyId: existing.policyId,
          name: existing.name,
        }),
      },
    });

    return NextResponse.json({ message: 'Policy deleted successfully' });
  } catch (error) {
    console.error('Error deleting policy:', error);
    return NextResponse.json(
      { error: 'Failed to delete policy' },
      { status: 500 }
    );
  }
}
