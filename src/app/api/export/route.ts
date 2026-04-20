import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function tracesToCsv(traces: Awaited<ReturnType<typeof db.executionTrace.findMany>>): string {
  const headers = ['traceId', 'sessionId', 'agentRole', 'toolName', 'evaluationResult', 'latency', 'timestamp', 'matchedPolicyId']
  const rows = traces.map((t) =>
    [
      escapeCsvField(t.traceId),
      escapeCsvField(t.sessionId),
      escapeCsvField(t.agentRole),
      escapeCsvField(t.toolName),
      escapeCsvField(t.evaluationResult),
      String(t.latency),
      escapeCsvField(new Date(t.timestamp).toISOString()),
      t.matchedPolicyId ?? '',
    ].join(',')
  )
  return [headers.join(','), ...rows].join('\n')
}

function auditLogsToCsv(logs: Awaited<ReturnType<typeof db.auditLog.findMany>>): string {
  const headers = ['id', 'eventType', 'actor', 'timestamp', 'details']
  const rows = logs.map((l) =>
    [
      escapeCsvField(l.id),
      escapeCsvField(l.eventType),
      escapeCsvField(l.actor),
      escapeCsvField(new Date(l.timestamp).toISOString()),
      escapeCsvField(l.details),
    ].join(',')
  )
  return [headers.join(','), ...rows].join('\n')
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') ?? 'traces'
    const format = searchParams.get('format') ?? 'csv'

    if (type !== 'traces' && type !== 'audit') {
      return NextResponse.json(
        { error: 'Invalid type parameter. Must be "traces" or "audit".' },
        { status: 400 }
      )
    }

    if (format !== 'csv' && format !== 'json') {
      return NextResponse.json(
        { error: 'Invalid format parameter. Must be "csv" or "json".' },
        { status: 400 }
      )
    }

    const dateStr = new Date().toISOString().split('T')[0]

    if (type === 'traces') {
      const traces = await db.executionTrace.findMany({
        orderBy: { timestamp: 'desc' },
      })

      if (format === 'json') {
        return NextResponse.json(traces, {
          headers: {
            'Content-Disposition': `attachment; filename="traces-export-${dateStr}.json"`,
          },
        })
      }

      const csv = tracesToCsv(traces)
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="traces-export-${dateStr}.csv"`,
        },
      })
    }

    // type === 'audit'
    const logs = await db.auditLog.findMany({
      orderBy: { timestamp: 'desc' },
    })

    if (format === 'json') {
      return NextResponse.json(logs, {
        headers: {
          'Content-Disposition': `attachment; filename="audit-export-${dateStr}.json"`,
        },
      })
    }

    const csv = auditLogsToCsv(logs)
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit-export-${dateStr}.csv"`,
      },
    })
  } catch (error) {
    console.error('Error exporting data:', error)
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    )
  }
}
