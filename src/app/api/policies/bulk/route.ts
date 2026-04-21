import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { policyIds, action } = body as {
      policyIds: string[]
      action: 'enable' | 'disable' | 'delete'
    }

    if (!Array.isArray(policyIds) || policyIds.length === 0) {
      return NextResponse.json(
        { error: 'policyIds must be a non-empty array' },
        { status: 400 }
      )
    }

    if (!['enable', 'disable', 'delete'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be enable, disable, or delete' },
        { status: 400 }
      )
    }

    let updated = 0

    if (action === 'enable') {
      const result = await db.policy.updateMany({
        where: { policyId: { in: policyIds } },
        data: { enabled: true },
      })
      updated = result.count
    } else if (action === 'disable') {
      const result = await db.policy.updateMany({
        where: { policyId: { in: policyIds } },
        data: { enabled: false },
      })
      updated = result.count
    } else if (action === 'delete') {
      // Null out references from execution traces before deleting
      await db.executionTrace.updateMany({
        where: { matchedPolicyId: { in: policyIds } },
        data: { matchedPolicyId: null },
      })

      const result = await db.policy.deleteMany({
        where: { policyId: { in: policyIds } },
      })
      updated = result.count
    }

    // Create audit log entry
    await db.auditLog.create({
      data: {
        eventType: `POLICY_BULK_${action.toUpperCase()}`,
        actor: 'dashboard_user',
        details: JSON.stringify({ policyIds, action, count: updated }),
        immutable: true,
      },
    })

    return NextResponse.json({ updated })
  } catch (error) {
    console.error('Bulk operation error:', error)
    return NextResponse.json({ error: 'Bulk operation failed' }, { status: 500 })
  }
}
