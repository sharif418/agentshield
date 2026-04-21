import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateApiKey } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ policyId: string }> }
) {
  const authError = validateApiKey(request)
  if (authError) return authError

  try {
    const { policyId } = await params;

    // Fetch the policy itself (for createdAt baseline)
    const policy = await db.policy.findUnique({
      where: { policyId },
    });

    if (!policy) {
      return NextResponse.json(
        { error: 'Policy not found' },
        { status: 404 }
      );
    }

    // Fetch all audit log entries that reference this policyId in their details
    const auditLogs = await db.auditLog.findMany({
      where: {
        eventType: { contains: 'POLICY' },
      },
      orderBy: { timestamp: 'desc' },
    });

    // Filter audit logs whose details JSON contains this policyId
    const relevantLogs = auditLogs.filter((log) => {
      try {
        const details = JSON.parse(log.details);
        return details.policyId === policyId;
      } catch {
        return false;
      }
    });

    // Build history entries from audit logs
    const historyEntries = relevantLogs.map((log) => {
      let details: Record<string, unknown> = {};
      try {
        details = JSON.parse(log.details);
      } catch {
        // keep empty
      }

      // Determine change type from eventType
      let changeType = 'Updated';
      if (log.eventType === 'POLICY_CREATED') changeType = 'Created';
      else if (log.eventType === 'POLICY_DELETED') changeType = 'Deleted';
      else if (log.eventType === 'POLICY_UPDATED') {
        // Check if the update was an enable/disable toggle
        const updatedFields = details.updatedFields as string[] | undefined;
        if (updatedFields?.length === 1 && updatedFields[0] === 'enabled') {
          changeType = details.enabled ? 'Enabled' : 'Disabled';
        } else {
          changeType = 'Updated';
        }
      }

      // Build description
      let description = '';
      switch (changeType) {
        case 'Created':
          description = `Policy "${details.name ?? policy.name}" was created with ${details.permissionLevel ?? policy.permissionLevel} permission`;
          break;
        case 'Deleted':
          description = `Policy "${details.name ?? policy.name}" was deleted`;
          break;
        case 'Enabled':
          description = `Policy was enabled`;
          break;
        case 'Disabled':
          description = `Policy was disabled`;
          break;
        case 'Updated':
        default: {
          const fields = (details.updatedFields as string[]) ?? [];
          if (fields.length > 0) {
            description = `Updated ${fields.join(', ')}`;
          } else {
            description = 'Policy was updated';
          }
          break;
        }
      }

      return {
        id: log.id,
        eventType: log.eventType,
        changeType,
        actor: log.actor,
        timestamp: log.timestamp,
        description,
        details: log.details,
      };
    });

    // Add the creation event from the policy itself (as the very first entry)
    const creationEntry = {
      id: `creation-${policy.policyId}`,
      eventType: 'POLICY_CREATED',
      changeType: 'Created' as const,
      actor: policy.agentRole,
      timestamp: policy.createdAt,
      description: `Policy "${policy.name}" was created with ${policy.permissionLevel} permission`,
      details: JSON.stringify({
        policyId: policy.policyId,
        name: policy.name,
        permissionLevel: policy.permissionLevel,
      }),
    };

    // Check if audit logs already have a POLICY_CREATED entry - if so, don't duplicate
    const hasCreationAudit = historyEntries.some(
      (e) => e.changeType === 'Created'
    );

    // Combine: creation first (if not already in audit logs), then audit log entries in chronological order (oldest first)
    const allEntries = hasCreationAudit
      ? historyEntries.reverse()
      : [creationEntry, ...historyEntries.reverse()];

    return NextResponse.json({
      policyId,
      policyName: policy.name,
      history: allEntries,
    });
  } catch (error) {
    console.error('Error fetching policy history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch policy history' },
      { status: 500 }
    )
  }
}
