import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { validateApiKey } from '@/lib/auth'
import { z } from 'zod'

const BulkActionSchema = z.object({
  policyIds: z.array(z.string().min(1)).min(1).max(100),
  action: z.enum(['enable', 'disable', 'delete']),
})

export async function PATCH(request: NextRequest) {
  const authError = validateApiKey(request)
  if (authError) return authError

  try {
    const rawBody = await request.json()
    const parseResult = BulkActionSchema.safeParse(rawBody)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { policyIds, action } = parseResult.data

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
