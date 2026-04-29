'use client'

import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import {
  FileCheck,
  Download,
  AlertTriangle,
  ShieldCheck,
  ShieldX,
  Clock,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  Eye,
  Printer,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from '@/lib/store'

// === Data Types ===

interface DashboardStats {
  totalPolicies: number
  policyBreakdown: Record<string, number>
  totalTraces: number
  traceBreakdown: Record<string, number>
  pendingApprovals: number
  recentTracesCount: number
  recentTraces: Array<{
    traceId: string
    agentRole: string
    toolName: string
    evaluationResult: string
    timestamp: string
    latency: number
  }>
  averageLatency: number
  auditLogCount: number
  policiesByRole: Record<string, number>
}

interface PolicyRecord {
  id: string
  policyId: string
  name: string
  description: string | null
  agentRole: string
  resource: string
  action: string
  permissionLevel: 'ALLOW' | 'BLOCK' | 'REQUIRE_APPROVAL'
  conditionRules: string | null
  priority: number
  enabled: boolean
}

interface TraceRecord {
  id: string
  traceId: string
  sessionId: string
  agentRole: string
  toolName: string
  intentPayload: string
  evaluationResult: string
  matchedPolicyId: string | null
  latency: number
  timestamp: string
  policy?: PolicyRecord | null
}

interface ApprovalRecord {
  id: string
  requestId: string
  traceId: string
  agentContext: string
  requestedAction: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'MODIFIED'
  humanReviewerId: string | null
  reviewNotes: string | null
  modifiedAction: string | null
  reviewTimestamp: string | null
  createdAt: string
  trace?: TraceRecord | null
}

interface AuditRecord {
  id: string
  eventType: string
  actor: string
  details: string | null
  timestamp: string
  immutable: boolean
}

// === Constants ===

const AGENT_ROLES = ['DataAgent', 'CodeAgent', 'FinanceAgent', 'SupportAgent']
const RESOURCES = ['PostgreSQL', 'GitHub', 'Stripe', 'EmailAPI', 'FileSystem', 'Kubernetes']

const PERMISSION_COLORS: Record<string, string> = {
  ALLOW: '#10b981',
  BLOCK: '#ef4444',
  REQUIRE_APPROVAL: '#f59e0b',
}

const PERMISSION_BG: Record<string, string> = {
  ALLOW: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  BLOCK: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  REQUIRE_APPROVAL: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
}

const SEVERITY_CONFIG: Record<string, { label: string; bg: string; icon: React.ReactNode }> = {
  critical: {
    label: 'Critical',
    bg: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    icon: <ShieldX className="h-3 w-3" />,
  },
  warning: {
    label: 'Warning',
    bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  info: {
    label: 'Info',
    bg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    icon: <ShieldCheck className="h-3 w-3" />,
  },
}

// === Gauge Component ===

function ComplianceGauge({
  value,
  label,
  colorThresholds,
}: {
  value: number
  label: string
  colorThresholds: { green: number; amber: number }
}) {
  const color =
    value >= colorThresholds.green
      ? '#10b981'
      : value >= colorThresholds.amber
        ? '#f59e0b'
        : '#ef4444'

  const displayVal = Math.round(value)

  return (
    <div className="flex flex-col items-center">
      <svg width="160" height="90" viewBox="0 0 160 90" className="gauge-glow">
        {/* Background arc */}
        <path
          d="M 20 80 A 60 60 0 0 1 140 80"
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.08}
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Colored arc */}
        <path
          d="M 20 80 A 60 60 0 0 1 140 80"
          fill="none"
          stroke={color}
          strokeOpacity={0.8}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${displayVal * 1.884} 188.4`}
        />
        {/* Tick marks */}
        {[25, 50, 75, 100].map((pct) => {
          const angle = Math.PI - (pct / 100) * Math.PI
          const cx = 80
          const cy = 80
          const outerR = 68
          const innerR = 62
          const x1 = cx + innerR * Math.cos(angle)
          const y1 = cy - innerR * Math.sin(angle)
          const x2 = cx + outerR * Math.cos(angle)
          const y2 = cy - outerR * Math.sin(angle)
          return (
            <line
              key={pct}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="currentColor"
              strokeOpacity={0.2}
              strokeWidth={1.5}
            />
          )
        })}
        {/* Value text */}
        <text
          x="80"
          y="68"
          textAnchor="middle"
          className="fill-foreground text-lg font-bold tabular-nums"
        >
          {displayVal}%
        </text>
        <text
          x="80"
          y="82"
          textAnchor="middle"
          className="fill-muted-foreground text-[9px]"
        >
          {label}
        </text>
      </svg>
    </div>
  )
}

// === Main Component ===

export function ComplianceReport() {
  const timeRange = useAppStore((s) => s.timeRange)
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setTimeout(() => setMounted(true), 0)
  }, [])

  // Filter states for violations
  const [violationRoleFilter, setViolationRoleFilter] = useState<string>('all')
  const [violationToolFilter, setViolationToolFilter] = useState<string>('all')
  const [violationSeverityFilter, setViolationSeverityFilter] = useState<string>('all')
  const [expandedViolation, setExpandedViolation] = useState<string | null>(null)

  // Report dialog
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [reportFormat, setReportFormat] = useState<'summary' | 'detailed' | 'audit'>('summary')
  const [generatedReport, setGeneratedReport] = useState<string>('')

  // Matrix cell detail dialog
  const [cellDetail, setCellDetail] = useState<{
    role: string
    resource: string
    policies: PolicyRecord[]
  } | null>(null)

  // === Data Fetching ===

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['stats', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/stats?timeRange=${timeRange}`)
      if (!res.ok) throw new Error('Failed to fetch stats')
      return res.json()
    },
    refetchInterval: 30000,
  })

  const { data: policiesData, isLoading: policiesLoading } = useQuery<PolicyRecord[]>({
    queryKey: ['policies-compliance'],
    queryFn: async () => {
      const res = await fetch('/api/policies')
      if (!res.ok) return []
      return res.json()
    },
    refetchInterval: 30000,
  })

  const { data: tracesData, isLoading: tracesLoading } = useQuery<{
    traces: TraceRecord[]
    total: number
  }>({
    queryKey: ['traces-compliance', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/traces?limit=200&timeRange=${timeRange}`)
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    refetchInterval: 30000,
  })

  const { data: approvalsData } = useQuery<ApprovalRecord[]>({
    queryKey: ['approvals-compliance'],
    queryFn: async () => {
      const res = await fetch('/api/approvals')
      if (!res.ok) return []
      return res.json()
    },
    refetchInterval: 30000,
  })

  const { data: auditData } = useQuery<{ logs: AuditRecord[]; total: number }>({
    queryKey: ['audit-compliance'],
    queryFn: async () => {
      const res = await fetch('/api/audit?limit=100')
      if (!res.ok) return { logs: [], total: 0 }
      return res.json()
    },
  })

  const policies = policiesData ?? []
  const traces = tracesData?.traces ?? []
  const approvals = approvalsData ?? []
  const auditLogs = auditData?.logs ?? []
  const isLoading = statsLoading || policiesLoading || tracesLoading

  // === Computed Metrics ===

  // Overall Compliance Score: % of ALLOW traces out of total
  const overallCompliance = useMemo(() => {
    if (!stats?.traceBreakdown) return 0
    const total = Object.values(stats.traceBreakdown).reduce((a, b) => a + b, 0)
    if (total === 0) return 0
    return ((stats.traceBreakdown.ALLOW ?? 0) / total) * 100
  }, [stats?.traceBreakdown])

  // Policy Coverage Score: % of agent roles with at least 1 policy
  const policyCoverage = useMemo(() => {
    const rolesWithPolicies = AGENT_ROLES.filter(
      (role) => (stats?.policiesByRole?.[role] ?? 0) > 0
    ).length
    return (rolesWithPolicies / AGENT_ROLES.length) * 100
  }, [stats?.policiesByRole])

  // Approval Responsiveness: % of non-PENDING approvals
  const approvalResponsiveness = useMemo(() => {
    if (approvals.length === 0) return 100
    const nonPending = approvals.filter((a) => a.status !== 'PENDING').length
    return (nonPending / approvals.length) * 100
  }, [approvals])

  // === Compliance Trend Chart ===

  const trendData = useMemo(() => {
    if (!traces.length) return []
    const result: Array<{ date: string; score: number; total: number; allow: number }> = []

    // Determine bucket size based on timeRange
    const bucketMs =
      timeRange === '90d'
        ? 7 * 24 * 60 * 60 * 1000 // weekly
        : 24 * 60 * 60 * 1000 // daily

    // Determine number of buckets
    const bucketCount = timeRange === '90d' ? 12 : timeRange === '30d' ? 30 : timeRange === '7d' ? 7 : 24

    const now = Date.now()
    for (let i = bucketCount - 1; i >= 0; i--) {
      const bucketEnd = now - i * bucketMs
      const bucketStart = bucketEnd - bucketMs
      const bucketTraces = traces.filter((t) => {
        const tt = new Date(t.timestamp).getTime()
        return tt >= bucketStart && tt < bucketEnd
      })
      const allowCount = bucketTraces.filter(
        (t) => t.evaluationResult === 'ALLOW'
      ).length
      const totalCount = bucketTraces.length
      const score = totalCount > 0 ? Math.round((allowCount / totalCount) * 100) : 0

      const date = new Date(bucketStart)
      const label =
        bucketMs >= 7 * 24 * 60 * 60 * 1000
          ? `W${Math.ceil((date.getDate()) / 7)}`
          : timeRange === '24h'
            ? `${date.getHours()}:00`
            : `${date.getMonth() + 1}/${date.getDate()}`

      result.push({ date: label, score, total: totalCount, allow: allowCount })
    }
    return result
  }, [traces, timeRange])

  // === Policy Compliance Matrix ===

  const matrixData = useMemo(() => {
    const matrix: Record<string, Record<string, PolicyRecord[]>> = {}
    for (const role of AGENT_ROLES) {
      matrix[role] = {}
      for (const resource of RESOURCES) {
        matrix[role][resource] = policies.filter(
          (p) => p.agentRole === role && p.resource === resource
        )
      }
    }
    return matrix
  }, [policies])

  // Get dominant permission for a cell
  const getCellPermission = (rolePolicies: PolicyRecord[]): string | null => {
    if (rolePolicies.length === 0) return null
    // Priority: BLOCK > REQUIRE_APPROVAL > ALLOW (most restrictive wins)
    const enabled = rolePolicies.filter((p) => p.enabled)
    if (enabled.length === 0) return null
    if (enabled.some((p) => p.permissionLevel === 'BLOCK')) return 'BLOCK'
    if (enabled.some((p) => p.permissionLevel === 'REQUIRE_APPROVAL'))
      return 'REQUIRE_APPROVAL'
    return 'ALLOW'
  }

  // === Violations List ===

  const violations = useMemo(() => {
    const blockTraces = traces.filter(
      (t) => t.evaluationResult === 'BLOCK' || t.evaluationResult === 'REQUIRE_APPROVAL'
    )

    return blockTraces.map((t) => {
      // Determine severity
      let severity: 'critical' | 'warning' | 'info' = 'info'
      try {
        const payload =
          typeof t.intentPayload === 'string'
            ? JSON.parse(t.intentPayload)
            : t.intentPayload
        const action = (payload?.action ?? payload?.query ?? '').toString().toUpperCase()
        if (action.includes('DROP') || action.includes('DELETE')) {
          severity = 'critical'
        } else if (t.evaluationResult === 'REQUIRE_APPROVAL') {
          severity = 'warning'
        } else if (action.includes('READ') || action.includes('SELECT')) {
          severity = 'info'
        } else {
          severity = 'warning'
        }
      } catch {
        severity = t.evaluationResult === 'REQUIRE_APPROVAL' ? 'warning' : 'info'
      }

      return { ...t, severity }
    })
  }, [traces])

  const filteredViolations = useMemo(() => {
    return violations.filter((v) => {
      if (violationRoleFilter !== 'all' && v.agentRole !== violationRoleFilter)
        return false
      if (violationToolFilter !== 'all' && v.toolName !== violationToolFilter)
        return false
      if (violationSeverityFilter !== 'all' && v.severity !== violationSeverityFilter)
        return false
      return true
    })
  }, [violations, violationRoleFilter, violationToolFilter, violationSeverityFilter])

  // === Recommendations ===

  const recommendations = useMemo(() => {
    const recs: Array<{
      id: string
      message: string
      priority: 'High' | 'Medium' | 'Low'
      type: 'missing_policy' | 'high_block_rate' | 'pending_approvals' | 'disabled_policies'
    }> = []

    // Check for missing policies
    for (const role of AGENT_ROLES) {
      for (const resource of RESOURCES) {
        const hasPolicy = policies.some(
          (p) => p.agentRole === role && p.resource === resource && p.enabled
        )
        if (!hasPolicy) {
          recs.push({
            id: `missing-${role}-${resource}`,
            message: `Add policy for ${role} on ${resource}`,
            priority: 'High',
            type: 'missing_policy',
          })
        }
      }
    }

    // Check for high BLOCK rate
    for (const role of AGENT_ROLES) {
      const roleTraces = traces.filter((t) => t.agentRole === role)
      const blockTraces = roleTraces.filter((t) => t.evaluationResult === 'BLOCK')
      if (roleTraces.length > 5 && blockTraces.length / roleTraces.length > 0.3) {
        const blockedPolicies = blockTraces
          .map((t) => t.policy?.name)
          .filter(Boolean)
          .filter((v, i, a) => a.indexOf(v) === i)
        recs.push({
          id: `high-block-${role}`,
          message: `Review ${blockedPolicies[0] ?? 'blocking policies'} for ${role} (high BLOCK rate)`,
          priority: 'Medium',
          type: 'high_block_rate',
        })
      }
    }

    // Check for pending approvals
    const pendingCount = approvals.filter((a) => a.status === 'PENDING').length
    if (pendingCount > 0) {
      recs.push({
        id: 'pending-approvals',
        message: `Respond to ${pendingCount} pending approval${pendingCount > 1 ? 's' : ''}`,
        priority: 'High',
        type: 'pending_approvals',
      })
    }

    // Check for disabled policies
    const disabledPolicies = policies.filter((p) => !p.enabled)
    if (disabledPolicies.length > 0) {
      recs.push({
        id: 'disabled-policies',
        message: `Enable ${disabledPolicies.length} disabled polic${disabledPolicies.length > 1 ? 'ies' : 'y'}`,
        priority: 'Low',
        type: 'disabled_policies',
      })
    }

    return recs
  }, [policies, traces, approvals])

  // === Report Generator ===

  const generateReport = () => {
    const now = new Date()
    const timestamp = now.toISOString()
    const timeLabel =
      timeRange === '24h' ? '24 Hours' : timeRange === '7d' ? '7 Days' : timeRange === '30d' ? '30 Days' : '90 Days'

    const violationSummary = {
      critical: violations.filter((v) => v.severity === 'critical').length,
      warning: violations.filter((v) => v.severity === 'warning').length,
      info: violations.filter((v) => v.severity === 'info').length,
    }

    const sectionTitle = (title: string) =>
      `<h2 style="color:#059669;border-bottom:2px solid #059669;padding-bottom:8px;margin-top:24px;">${title}</h2>`

    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>AgentShield Compliance Report</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:960px;margin:0 auto;padding:24px;color:#1f2937;background:#fff;}
  h1{color:#047857;font-size:24px;} h2{font-size:18px;margin-top:20px;} table{border-collapse:collapse;width:100%;margin:12px 0;}
  th,td{border:1px solid #d1d5db;padding:8px 12px;text-align:left;font-size:13px;}
  th{background:#f3f4f6;font-weight:600;}
  .allow{color:#059669;} .block{color:#dc2626;} .review{color:#d97706;}
  .metric{display:inline-block;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 20px;margin:6px;text-align:center;}
  .metric-val{font-size:28px;font-weight:700;color:#047857;} .metric-label{font-size:12px;color:#6b7280;}
  .critical{background:#fef2f2;} .warning{background:#fffbeb;} .info{background:#ecfeff;}
  .footer{margin-top:32px;border-top:1px solid #e5e7eb;padding-top:12px;color:#9ca3af;font-size:11px;}
</style></head><body>
<h1>🛡️ AgentShield Compliance Report</h1>
<p><strong>Generated:</strong> ${now.toLocaleString()} | <strong>Period:</strong> ${timeLabel}</p>

${sectionTitle('Compliance Scores')}
<div style="display:flex;flex-wrap:wrap;gap:8px;">
  <div class="metric"><div class="metric-val">${Math.round(overallCompliance)}%</div><div class="metric-label">Overall Compliance</div></div>
  <div class="metric"><div class="metric-val">${Math.round(policyCoverage)}%</div><div class="metric-label">Policy Coverage</div></div>
  <div class="metric"><div class="metric-val">${Math.round(approvalResponsiveness)}%</div><div class="metric-label">Approval Response</div></div>
</div>`

    if (reportFormat === 'summary') {
      html += `
${sectionTitle('Summary')}
<p>Total Policies: <strong>${policies.length}</strong> | Total Traces: <strong>${traces.length}</strong> | Violations: <strong>${violations.length}</strong></p>
<p>Critical: ${violationSummary.critical} | Warning: ${violationSummary.warning} | Info: ${violationSummary.info}</p>`
    }

    if (reportFormat === 'detailed' || reportFormat === 'audit') {
      // Trend summary
      html += `
${sectionTitle('Compliance Trend')}
<p>Average compliance over period: <strong>${trendData.length > 0 ? Math.round(trendData.reduce((s, d) => s + d.score, 0) / trendData.length) : 0}%</strong></p>`

      // Violations table
      html += `
${sectionTitle('Violations')}
<table><tr><th>Timestamp</th><th>Agent</th><th>Tool</th><th>Result</th><th>Severity</th><th>Latency</th></tr>`
      const violationRows =
        reportFormat === 'audit' ? filteredViolations : filteredViolations.slice(0, 50)
      for (const v of violationRows) {
        html += `<tr class="${v.severity}">
          <td>${new Date(v.timestamp).toLocaleString()}</td>
          <td>${v.agentRole}</td>
          <td>${v.toolName}</td>
          <td class="${v.evaluationResult === 'BLOCK' ? 'block' : 'review'}">${v.evaluationResult}</td>
          <td>${v.severity}</td>
          <td>${v.latency.toFixed(1)}ms</td>
        </tr>`
      }
      html += `</table>`
    }

    if (reportFormat === 'audit') {
      // Full policy matrix
      html += `
${sectionTitle('Policy Compliance Matrix')}
<table><tr><th>Agent \\ Resource</th>${RESOURCES.map((r) => `<th>${r}</th>`).join('')}</tr>`
      for (const role of AGENT_ROLES) {
        html += `<tr><td><strong>${role}</strong></td>`
        for (const resource of RESOURCES) {
          const perm = getCellPermission(matrixData[role]?.[resource] ?? [])
          html += `<td class="${perm === 'ALLOW' ? 'allow' : perm === 'BLOCK' ? 'block' : perm === 'REQUIRE_APPROVAL' ? 'review' : ''}">${perm ?? '—'}</td>`
        }
        html += `</tr>`
      }
      html += `</table>`

      // Audit logs
      html += `
${sectionTitle('Audit Log')}
<table><tr><th>Timestamp</th><th>Event</th><th>Actor</th><th>Details</th></tr>`
      for (const log of auditLogs.slice(0, 100)) {
        html += `<tr>
          <td>${new Date(log.timestamp).toLocaleString()}</td>
          <td>${log.eventType}</td>
          <td>${log.actor}</td>
          <td>${log.details ?? '—'}</td>
        </tr>`
      }
      html += `</table>`
    }

    // Recommendations
    html += `
${sectionTitle('Recommendations')}
<table><tr><th>Priority</th><th>Recommendation</th></tr>`
    for (const rec of recommendations) {
      html += `<tr><td>${rec.priority}</td><td>${rec.message}</td></tr>`
    }
    html += `</table>`

    // Footer
    html += `
<div class="footer">
  <p>AgentShield Policy Engine v1.0.0 | Report generated at ${timestamp} | Time range: ${timeLabel}</p>
  <p>This report is auto-generated and should be reviewed for accuracy before submission.</p>
</div>
</body></html>`

    setGeneratedReport(html)
    setReportDialogOpen(true)
  }

  const downloadReport = () => {
    const blob = new Blob([generatedReport], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `compliance-report-${new Date().toISOString().slice(0, 10)}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const printReport = () => {
    const w = window.open('', '_blank')
    if (w) {
      w.document.write(generatedReport)
      w.document.close()
      w.print()
    }
  }

  // === Unique filter values ===
  const violationRoles = useMemo(
    () => Array.from(new Set(violations.map((v) => v.agentRole))),
    [violations]
  )
  const violationTools = useMemo(
    () => Array.from(new Set(violations.map((v) => v.toolName))),
    [violations]
  )

  // === Custom tooltip for trend chart ===
  const CustomTrendTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; payload: { total: number; allow: number } }>; label?: string }) => {
    if (!active || !payload?.length) return null
    const data = payload[0].payload
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs">
        <p className="font-medium text-foreground">{label}</p>
        <p className="text-emerald-600 dark:text-emerald-400">
          Compliance: <span className="font-mono tabular-nums font-bold">{payload[0].value}%</span>
        </p>
        <p className="text-muted-foreground">
          {data.allow} ALLOW / {data.total} total
        </p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 relative">
      {/* Dot grid background */}
      <div className="absolute inset-0 dot-grid opacity-30 pointer-events-none rounded-xl" />

      {/* === 1. Section Header === */}
      <div className="section-header-gradient rounded-xl px-4 py-3 -mx-4 -mt-2 md:-mx-6 md:-mt-4 mb-2 relative overflow-hidden">
        <h2 className="text-lg font-bold tracking-tight flex items-center gap-2 bg-linear-to-r from-emerald-700 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
          <FileCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          Compliance
        </h2>
        <p className="text-sm text-muted-foreground">
          Governance reporting and compliance tracking
        </p>
      </div>

      {/* === 2. Compliance Score Dashboard (3 Gauges) === */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="glass-card glow-hover">
              <CardContent className="p-6 flex flex-col items-center">
                <div className="h-[90px] w-[160px] skeleton-shimmer rounded" />
                <div className="h-3 w-20 skeleton-shimmer rounded mt-3" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0 }}
            >
              <Card className="glass-card glow-hover">
                <CardContent className="p-6 flex flex-col items-center">
                  <ComplianceGauge
                    value={overallCompliance}
                    label="Overall Compliance"
                    colorThresholds={{ green: 80, amber: 50 }}
                  />
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    ALLOW traces / total traces
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="glass-card glow-hover">
                <CardContent className="p-6 flex flex-col items-center">
                  <ComplianceGauge
                    value={policyCoverage}
                    label="Policy Coverage"
                    colorThresholds={{ green: 100, amber: 75 }}
                  />
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    {AGENT_ROLES.filter(
                      (r) => (stats?.policiesByRole?.[r] ?? 0) > 0
                    ).length}{' '}
                    of {AGENT_ROLES.length} roles covered
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="glass-card glow-hover">
                <CardContent className="p-6 flex flex-col items-center">
                  <ComplianceGauge
                    value={approvalResponsiveness}
                    label="Approval Response"
                    colorThresholds={{ green: 90, amber: 70 }}
                  />
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    {approvals.filter((a) => a.status !== 'PENDING').length} of{' '}
                    {approvals.length} resolved
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </div>

      {/* === 3. Compliance Trend Chart === */}
      <Card className="glass-card glow-hover">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Compliance Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-[260px] flex items-center justify-center">
              <div className="w-3/4 h-40 skeleton-shimmer rounded" />
            </div>
          ) : mounted && trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trendData}>
                <defs>
                  <linearGradient id="complianceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <RechartsTooltip content={<CustomTrendTooltip />} />
                <ReferenceLine
                  y={80}
                  stroke="#f59e0b"
                  strokeDasharray="6 3"
                  strokeWidth={1.5}
                  label={{
                    value: '80% threshold',
                    position: 'right',
                    fill: '#f59e0b',
                    fontSize: 10,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ fill: '#10b981', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#059669', stroke: '#fff', strokeWidth: 2 }}
                  fill="url(#complianceGrad)"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : !mounted ? (
            <div className="h-[260px] flex items-center justify-center">
              <div className="w-3/4 h-40 skeleton-shimmer rounded" />
            </div>
          ) : (
            <div className="h-[260px] flex flex-col items-center justify-center text-muted-foreground text-sm">
              <TrendingUp className="h-8 w-8 mb-2 opacity-40" />
              <p>No trend data available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* === 4. Policy Compliance Matrix === */}
      <Card className="glass-card glow-hover">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Policy Compliance Matrix
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-2">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <div
                      key={j}
                      className="h-8 flex-1 skeleton-shimmer rounded"
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left p-2 text-muted-foreground font-medium sticky left-0 bg-card">
                      Agent / Resource
                    </th>
                    {RESOURCES.map((resource) => (
                      <th
                        key={resource}
                        className="p-2 text-muted-foreground font-medium text-center"
                      >
                        {resource}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {AGENT_ROLES.map((role) => (
                    <tr key={role} className="border-t border-border">
                      <td className="p-2 font-medium sticky left-0 bg-card">
                        {role}
                      </td>
                      {RESOURCES.map((resource) => {
                        const cellPolicies = matrixData[role]?.[resource] ?? []
                        const perm = getCellPermission(cellPolicies)
                        return (
                          <td key={resource} className="p-1.5 text-center">
                            <button
                              type="button"
                              className={`inline-flex items-center justify-center min-w-[60px] px-2 py-1 rounded-md text-[10px] font-semibold border transition-all duration-150 hover:scale-105 ${
                                perm
                                  ? PERMISSION_BG[perm]
                                  : 'bg-gray-500/10 text-gray-400 dark:text-gray-500 border-gray-500/20'
                              }`}
                              onClick={() =>
                                setCellDetail({
                                  role,
                                  resource,
                                  policies: cellPolicies,
                                })
                              }
                            >
                              {perm
                                ? perm === 'REQUIRE_APPROVAL'
                                  ? 'REVIEW'
                                  : perm
                                : '—'}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* === 5. Compliance Violations List === */}
      <Card className="glass-card glow-hover">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShieldX className="h-4 w-4 text-red-600 dark:text-red-400" />
              Compliance Violations
              <Badge variant="outline" className="font-mono tabular-nums">
                {filteredViolations.length}
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Select
                value={violationRoleFilter}
                onValueChange={setViolationRoleFilter}
              >
                <SelectTrigger className="h-7 w-[130px] text-xs">
                  <SelectValue placeholder="Agent Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {violationRoles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={violationToolFilter}
                onValueChange={setViolationToolFilter}
              >
                <SelectTrigger className="h-7 w-[130px] text-xs">
                  <SelectValue placeholder="Tool" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tools</SelectItem>
                  {violationTools.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={violationSeverityFilter}
                onValueChange={setViolationSeverityFilter}
              >
                <SelectTrigger className="h-7 w-[120px] text-xs">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severity</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 skeleton-shimmer rounded"
                />
              ))}
            </div>
          ) : filteredViolations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm">
              <ShieldCheck className="h-8 w-8 mb-2 opacity-40" />
              <p className="font-medium">No violations found</p>
              <p className="text-xs mt-1">All traces are compliant</p>
            </div>
          ) : (
            <ScrollArea className="max-h-96">
              <div className="space-y-1">
                <AnimatePresence>
                  {filteredViolations.map((v, i) => (
                    <motion.div
                      key={v.traceId}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.02, 0.5) }}
                    >
                      <button
                        type="button"
                        className="w-full text-left flex items-center gap-2 py-2 px-2 rounded-md hover:bg-muted/50 transition-colors duration-200 group text-xs"
                        onClick={() =>
                          setExpandedViolation(
                            expandedViolation === v.traceId
                              ? null
                              : v.traceId
                          )
                        }
                      >
                        {/* Severity indicator */}
                        <Badge
                          className={`transition-transform duration-150 hover:scale-105 ${SEVERITY_CONFIG[v.severity].bg}`}
                          variant="outline"
                        >
                          {SEVERITY_CONFIG[v.severity].icon}
                          <span className="ml-1">{SEVERITY_CONFIG[v.severity].label}</span>
                        </Badge>

                        {/* Timestamp */}
                        <span className="text-muted-foreground font-mono tabular-nums shrink-0">
                          {new Date(v.timestamp).toLocaleString()}
                        </span>

                        {/* Agent & Tool */}
                        <span className="font-medium">{v.agentRole}</span>
                        <span className="text-muted-foreground">→</span>
                        <span>{v.toolName}</span>

                        {/* Result */}
                        <Badge
                          className={`transition-transform duration-150 hover:scale-105 ${
                            v.evaluationResult === 'BLOCK'
                              ? PERMISSION_BG.BLOCK
                              : PERMISSION_BG.REQUIRE_APPROVAL
                          }`}
                          variant="outline"
                        >
                          {v.evaluationResult === 'REQUIRE_APPROVAL'
                            ? 'REVIEW'
                            : v.evaluationResult}
                        </Badge>

                        {/* Blocking policy */}
                        <span className="text-muted-foreground truncate max-w-[140px]">
                          {v.policy?.name ?? '—'}
                        </span>

                        {/* Latency */}
                        <span className="text-muted-foreground font-mono tabular-nums ml-auto shrink-0">
                          {v.latency.toFixed(1)}ms
                        </span>

                        {/* Expand icon */}
                        {expandedViolation === v.traceId ? (
                          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        )}
                      </button>

                      {/* Expanded details */}
                      <AnimatePresence>
                        {expandedViolation === v.traceId && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="ml-4 mb-2 p-3 bg-muted/30 rounded-lg text-xs space-y-1.5">
                              <div className="flex gap-4">
                                <span className="text-muted-foreground">
                                  Trace ID:
                                </span>
                                <span className="font-mono">{v.traceId}</span>
                              </div>
                              <div className="flex gap-4">
                                <span className="text-muted-foreground">
                                  Session:
                                </span>
                                <span className="font-mono">{v.sessionId}</span>
                              </div>
                              {v.policy && (
                                <>
                                  <div className="flex gap-4">
                                    <span className="text-muted-foreground">
                                      Policy:
                                    </span>
                                    <span>{v.policy.name}</span>
                                  </div>
                                  <div className="flex gap-4">
                                    <span className="text-muted-foreground">
                                      Permission:
                                    </span>
                                    <Badge
                                      className={PERMISSION_BG[v.policy.permissionLevel]}
                                      variant="outline"
                                    >
                                      {v.policy.permissionLevel ===
                                      'REQUIRE_APPROVAL'
                                        ? 'REVIEW'
                                        : v.policy.permissionLevel}
                                    </Badge>
                                  </div>
                                  <div className="flex gap-4">
                                    <span className="text-muted-foreground">
                                      Priority:
                                    </span>
                                    <span className="font-mono tabular-nums">
                                      {v.policy.priority}
                                    </span>
                                  </div>
                                </>
                              )}
                              {v.intentPayload && (
                                <div className="flex gap-4">
                                  <span className="text-muted-foreground shrink-0">
                                    Intent:
                                  </span>
                                  <pre className="text-[10px] font-mono bg-muted/50 p-1.5 rounded overflow-x-auto max-w-[400px]">
                                    {(() => {
                                      try {
                                        return JSON.stringify(
                                          JSON.parse(v.intentPayload),
                                          null,
                                          2
                                        )
                                      } catch {
                                        return v.intentPayload
                                      }
                                    })()}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* === 6. Report Generator === */}
      <Card className="glass-card glow-hover">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Report Generator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 flex-wrap">
            <Select
              value={reportFormat}
              onValueChange={(v) => setReportFormat(v as 'summary' | 'detailed' | 'audit')}
            >
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="summary">Summary</SelectItem>
                <SelectItem value="detailed">Detailed</SelectItem>
                <SelectItem value="audit">Audit-Ready</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={generateReport}
              className="gap-2 active:scale-[0.98] transition-transform"
              size="sm"
            >
              <Download className="h-3.5 w-3.5" />
              Generate Report
            </Button>
            <div className="text-xs text-muted-foreground">
              {reportFormat === 'summary' && 'Key metrics, scores, and trend overview'}
              {reportFormat === 'detailed' && 'Full metrics plus violations list'}
              {reportFormat === 'audit' && 'Complete policy matrix, violations, and audit logs'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* === 7. Compliance Recommendations === */}
      <Card className="glass-card glow-hover">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            Compliance Recommendations
            <Badge variant="outline" className="font-mono tabular-nums">
              {recommendations.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recommendations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm">
              <ShieldCheck className="h-8 w-8 mb-2 opacity-40" />
              <p className="font-medium">All clear!</p>
              <p className="text-xs mt-1">No compliance recommendations at this time</p>
            </div>
          ) : (
            <ScrollArea className="max-h-96">
              <div className="space-y-2">
                <AnimatePresence>
                  {recommendations.map((rec, i) => (
                    <motion.div
                      key={rec.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.6) }}
                      className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-muted/50 transition-colors duration-200"
                    >
                      {/* Priority badge */}
                      <Badge
                        className={`transition-transform duration-150 hover:scale-105 shrink-0 ${
                          rec.priority === 'High'
                            ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                            : rec.priority === 'Medium'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                              : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20'
                        }`}
                        variant="outline"
                      >
                        {rec.priority}
                      </Badge>

                      {/* Type icon */}
                      <span className="shrink-0">
                        {rec.type === 'missing_policy' && (
                          <ShieldX className="h-4 w-4 text-red-500" />
                        )}
                        {rec.type === 'high_block_rate' && (
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        )}
                        {rec.type === 'pending_approvals' && (
                          <Clock className="h-4 w-4 text-amber-500" />
                        )}
                        {rec.type === 'disabled_policies' && (
                          <ShieldCheck className="h-4 w-4 text-cyan-500" />
                        )}
                      </span>

                      {/* Message */}
                      <span className="text-xs flex-1">{rec.message}</span>

                      {/* Action button */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1 active:scale-[0.98] transition-transform shrink-0"
                        onClick={() => {
                          const setActiveSection = useAppStore.getState().setActiveSection
                          if (rec.type === 'missing_policy' || rec.type === 'disabled_policies') {
                            setActiveSection('policies')
                          } else if (rec.type === 'pending_approvals') {
                            setActiveSection('approvals')
                          } else if (rec.type === 'high_block_rate') {
                            setActiveSection('traces')
                          }
                        }}
                      >
                        <Eye className="h-3 w-3" />
                        View
                      </Button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* === Cell Detail Dialog === */}
      <Dialog open={cellDetail !== null} onOpenChange={(open) => !open && setCellDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Policy Details: {cellDetail?.role} → {cellDetail?.resource}
            </DialogTitle>
          </DialogHeader>
          {cellDetail && cellDetail.policies.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground text-sm">
              <ShieldX className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="font-medium">No policies defined</p>
              <p className="text-xs mt-1">
                No policy exists for {cellDetail.role} on {cellDetail.resource}
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-72">
              <div className="space-y-2">
                {cellDetail?.policies.map((p) => (
                  <div
                    key={p.policyId}
                    className="p-3 bg-muted/30 rounded-lg text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{p.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge className={PERMISSION_BG[p.permissionLevel]} variant="outline">
                          {p.permissionLevel === 'REQUIRE_APPROVAL'
                            ? 'REVIEW'
                            : p.permissionLevel}
                        </Badge>
                        {!p.enabled && (
                          <Badge className="bg-gray-500/10 text-gray-500 border-gray-500/20" variant="outline">
                            Disabled
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-muted-foreground">
                      Action: <span className="font-mono">{p.action}</span> | Priority:{' '}
                      <span className="font-mono tabular-nums">{p.priority}</span>
                    </div>
                    {p.description && (
                      <p className="text-muted-foreground">{p.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* === Report Preview Dialog === */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Compliance Report Preview
              <Badge variant="outline" className="text-[10px] capitalize">
                {reportFormat}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: generatedReport }}
            />
          </ScrollArea>
          <Separator />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Report generated at {new Date().toLocaleString()} | Period:{' '}
              {timeRange === '24h'
                ? '24 Hours'
                : timeRange === '7d'
                  ? '7 Days'
                  : timeRange === '30d'
                    ? '30 Days'
                    : '90 Days'}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 active:scale-[0.98] transition-transform"
                onClick={printReport}
              >
                <Printer className="h-3.5 w-3.5" />
                Print
              </Button>
              <Button
                size="sm"
                className="gap-1.5 active:scale-[0.98] transition-transform"
                onClick={downloadReport}
              >
                <Download className="h-3.5 w-3.5" />
                Download HTML
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
