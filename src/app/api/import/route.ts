import { NextRequest, NextResponse } from 'next/server';
import { db, prismaClient } from '@/lib/db';
import { validateApiKey } from '@/lib/auth';
import { z } from 'zod';

// ─── Schemas ─────────────────────────────────────────────────────────────────

const PolicyImportItem = z.object({
  policyId: z.string().max(100).optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  agentRole: z.string().min(1).max(100),
  resource: z.string().min(1).max(100),
  action: z.string().min(1).max(100),
  permissionLevel: z.enum(['ALLOW', 'BLOCK', 'REQUIRE_APPROVAL']),
  conditionRules: z.record(z.unknown()).optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  enabled: z.boolean().optional(),
})

const WebhookImportItem = z.object({
  name: z.string().min(1).max(200),
  url: z.string().min(1).max(500),
  channel: z.enum(['slack', 'teams', 'telegram']),
  events: z.union([z.string(), z.array(z.string())]),
  secret: z.string().max(200).optional(),
  enabled: z.boolean().optional(),
})

const ImportSchema = z.object({
  type: z.enum(['policies', 'webhooks', 'full']),
  data: z.unknown(),
  mode: z.enum(['merge', 'replace']).default('merge'),
  validateOnly: z.boolean().default(false),
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
}

async function importPolicies(
  data: unknown,
  mode: 'merge' | 'replace',
  validateOnly: boolean
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] }

  if (!Array.isArray(data)) {
    result.errors.push('Policies data must be an array')
    return result
  }

  // Validate all items first
  const validItems: z.infer<typeof PolicyImportItem>[] = []
  for (let i = 0; i < data.length; i++) {
    const parseResult = PolicyImportItem.safeParse(data[i])
    if (parseResult.success) {
      validItems.push(parseResult.data)
    } else {
      result.errors.push(`Policy item ${i}: ${parseResult.error.issues.map(e => e.message).join(', ')}`)
    }
  }

  if (validateOnly) {
    result.imported = validItems.length
    result.skipped = data.length - validItems.length
    return result
  }

  // Replace mode: delete all existing policies
  if (mode === 'replace') {
    await db.approvalRequest.deleteMany()
    await db.executionTrace.deleteMany()
    await db.policy.deleteMany()
  }

  // Get existing policies for dedup in merge mode
  const existingPolicies = mode === 'merge'
    ? await db.policy.findMany({ select: { name: true, agentRole: true, resource: true, action: true } })
    : []

  const existingKeys = new Set(
    existingPolicies.map(p => `${p.name}|${p.agentRole}|${p.resource}|${p.action}`)
  )

  for (const item of validItems) {
    const key = `${item.name}|${item.agentRole}|${item.resource}|${item.action}`
    if (mode === 'merge' && existingKeys.has(key)) {
      result.skipped++
      continue
    }

    try {
      const policyId = item.policyId ?? `POL-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`
      await db.policy.create({
        data: {
          policyId,
          name: item.name,
          description: item.description,
          agentRole: item.agentRole,
          resource: item.resource,
          action: item.action,
          permissionLevel: item.permissionLevel,
          conditionRules: item.conditionRules ? JSON.stringify(item.conditionRules) : null,
          priority: item.priority ?? 0,
          enabled: item.enabled ?? true,
        },
      })
      result.imported++
      existingKeys.add(key)
    } catch (err) {
      result.errors.push(`Policy "${item.name}": ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return result
}

async function importWebhooks(
  data: unknown,
  mode: 'merge' | 'replace',
  validateOnly: boolean
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] }

  if (!Array.isArray(data)) {
    result.errors.push('Webhooks data must be an array')
    return result
  }

  const validItems: z.infer<typeof WebhookImportItem>[] = []
  for (let i = 0; i < data.length; i++) {
    const parseResult = WebhookImportItem.safeParse(data[i])
    if (parseResult.success) {
      validItems.push(parseResult.data)
    } else {
      result.errors.push(`Webhook item ${i}: ${parseResult.error.issues.map(e => e.message).join(', ')}`)
    }
  }

  if (validateOnly) {
    result.imported = validItems.length
    result.skipped = data.length - validItems.length
    return result
  }

  if (mode === 'replace') {
    await db.webhookConfig.deleteMany()
  }

  const existingWebhooks = mode === 'merge'
    ? await db.webhookConfig.findMany({ select: { name: true, url: true } })
    : []

  const existingKeys = new Set(
    existingWebhooks.map(w => `${w.name}|${w.url}`)
  )

  for (const item of validItems) {
    const key = `${item.name}|${item.url}`
    if (mode === 'merge' && existingKeys.has(key)) {
      result.skipped++
      continue
    }

    try {
      await db.webhookConfig.create({
        data: {
          name: item.name,
          url: item.url,
          channel: item.channel,
          events: typeof item.events === 'string' ? item.events : JSON.stringify(item.events),
          secret: item.secret,
          enabled: item.enabled ?? true,
        },
      })
      result.imported++
      existingKeys.add(key)
    } catch (err) {
      result.errors.push(`Webhook "${item.name}": ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return result
}

// ─── POST Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const authError = validateApiKey(request)
  if (authError) return authError

  // Block 'replace' mode in production
  if (process.env.NODE_ENV === 'production') {
    const body = await request.json()
    if (body.mode === 'replace') {
      return NextResponse.json(
        { error: 'Replace mode is disabled in production. Use merge mode to add data without deleting existing records.' },
        { status: 403 }
      )
    }
  }

  try {
    const rawBody = await request.json()
    const parseResult = ImportSchema.safeParse(rawBody)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { type, data, mode, validateOnly } = parseResult.data
    const results: Record<string, ImportResult> = {}

    if (type === 'policies') {
      results.policies = await importPolicies(data, mode, validateOnly)
    } else if (type === 'webhooks') {
      results.webhooks = await importWebhooks(data, mode, validateOnly)
    } else if (type === 'full') {
      const fullData = data as Record<string, unknown>
      if (fullData.policies) {
        results.policies = await importPolicies(fullData.policies, mode, validateOnly)
      }
      if (fullData.webhooks) {
        results.webhooks = await importWebhooks(fullData.webhooks, mode, validateOnly)
      }
    }

    // Log the import operation to audit log
    if (!validateOnly) {
      const totalImported = Object.values(results).reduce((sum, r) => sum + r.imported, 0)
      const totalSkipped = Object.values(results).reduce((sum, r) => sum + r.skipped, 0)
      const totalErrors = Object.values(results).reduce((sum, r) => sum + r.errors.length, 0)

      await db.auditLog.create({
        data: {
          eventType: 'DATA_IMPORTED',
          actor: 'system',
          details: JSON.stringify({
            type,
            mode,
            totalImported,
            totalSkipped,
            totalErrors,
            results,
          }),
        },
      })
    }

    return NextResponse.json({
      success: true,
      validateOnly,
      results,
    }, { status: validateOnly ? 200 : 201 })
  } catch (error) {
    console.error('Error importing data:', error)
    return NextResponse.json(
      { error: 'Failed to import data', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
