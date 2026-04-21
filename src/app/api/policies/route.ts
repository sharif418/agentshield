import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentRole = searchParams.get('agentRole');
    const resource = searchParams.get('resource');
    const permissionLevel = searchParams.get('permissionLevel');
    const enabled = searchParams.get('enabled');

    const where: Record<string, unknown> = {};
    if (agentRole) where.agentRole = agentRole;
    if (resource) where.resource = resource;
    if (permissionLevel) where.permissionLevel = permissionLevel;
    if (enabled !== null) where.enabled = enabled === 'true';

    const policies = await db.policy.findMany({
      where,
      orderBy: { priority: 'desc' },
    });

    return NextResponse.json(policies);
  } catch (error) {
    console.error('Error fetching policies:', error);
    return NextResponse.json(
      { error: 'Failed to fetch policies' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      agentRole,
      resource,
      action,
      permissionLevel,
      conditionRules,
      priority,
      enabled,
    } = body;

    if (!name || !agentRole || !resource || !action || !permissionLevel) {
      return NextResponse.json(
        { error: 'Missing required fields: name, agentRole, resource, action, permissionLevel' },
        { status: 400 }
      );
    }

    const policyId = `POL-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;

    const policy = await db.policy.create({
      data: {
        policyId,
        name,
        description,
        agentRole,
        resource,
        action,
        permissionLevel,
        conditionRules: conditionRules ? JSON.stringify(conditionRules) : null,
        priority: priority ?? 0,
        enabled: enabled ?? true,
      },
    });

    await db.auditLog.create({
      data: {
        eventType: 'POLICY_CREATED',
        actor: agentRole,
        details: JSON.stringify({
          policyId: policy.policyId,
          name: policy.name,
          permissionLevel: policy.permissionLevel,
        }),
      },
    });

    return NextResponse.json(policy, { status: 201 });
  } catch (error) {
    console.error('Error creating policy:', error);
    return NextResponse.json(
      { error: 'Failed to create policy' },
      { status: 500 }
    );
  }
}
