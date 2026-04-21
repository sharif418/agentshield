import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateApiKey } from '@/lib/auth';
import { z } from 'zod'

const UpdatePolicySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  agentRole: z.string().max(100).optional(),
  resource: z.string().max(100).optional(),
  action: z.string().max(100).optional(),
  permissionLevel: z.enum(['ALLOW', 'BLOCK', 'REQUIRE_APPROVAL']).optional(),
  conditionRules: z.record(z.unknown()).optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  enabled: z.boolean().optional(),
  actor: z.string().max(100).optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ policyId: string }> }
) {
  const authError = validateApiKey(_request)
  if (authError) return authError

  try {
    const { policyId } = await params;
    const policy = await db.policy.findUnique({
      where: { policyId },
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
  { params }: { params: Promise<{ policyId: string }> }
) {
  const authError = validateApiKey(request)
  if (authError) return authError

  try {
    const { policyId } = await params;
    const rawBody = await request.json();
    const parseResult = UpdatePolicySchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const body = parseResult.data;

    const existing = await db.policy.findUnique({
      where: { policyId },
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
      where: { policyId },
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
  { params }: { params: Promise<{ policyId: string }> }
) {
  const authError = validateApiKey(_request)
  if (authError) return authError

  try {
    const { policyId } = await params;

    const existing = await db.policy.findUnique({
      where: { policyId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Policy not found' },
        { status: 404 }
      );
    }

    await db.policy.delete({
      where: { policyId },
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
