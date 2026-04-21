'use client'

import { useState, useMemo, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { AnimatePresence, motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { useAppStore } from '@/lib/store'
import {
  LayoutGrid,
  GripVertical,
  Plus,
  RotateCcw,
  X,
  BarChart3,
  Shield,
  Activity,
  Clock,
  CheckSquare,
  Target,
  TrendingUp,
  Zap,
  Database,
  PieChart,
  LayoutList,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type WidgetType =
  | 'policy_status'
  | 'approval_pipeline'
  | 'risk_heatmap'
  | 'latency_monitor'
  | 'agent_activity'
  | 'compliance_score'
  | 'recent_blocks'
  | 'quick_stats'

interface WidgetConfig {
  type: WidgetType
  id: string
}

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

interface TraceRecord {
  traceId: string
  agentRole: string
  toolName: string
  evaluationResult: string
  timestamp: string
  latency: number
  intentPayload: string
  matchedPolicyId: string | null
  policy?: { name: string; permissionLevel: string; priority: number } | null
}

// ─── Widget Metadata ─────────────────────────────────────────────────────────

const WIDGET_META: Record<WidgetType, { label: string; description: string; icon: React.ElementType }> = {
  policy_status: { label: 'Policy Status', description: 'ALLOW/BLOCK/REQUIRE_APPROVAL breakdown with donut chart', icon: PieChart },
  approval_pipeline: { label: 'Approval Pipeline', description: 'Pending → Under Review → Approved/Rejected pipeline', icon: CheckSquare },
  risk_heatmap: { label: 'Risk Heatmap', description: 'Agent roles × risk categories heatmap grid', icon: Target },
  latency_monitor: { label: 'Latency Monitor', description: 'Evaluation latency over last 10 traces', icon: Clock },
  agent_activity: { label: 'Agent Activity', description: 'Trace count per agent role bar chart', icon: BarChart3 },
  compliance_score: { label: 'Compliance Score', description: 'Overall compliance with circular progress', icon: Shield },
  recent_blocks: { label: 'Recent Blocks', description: 'Last 5 BLOCK traces with details', icon: Zap },
  quick_stats: { label: 'Quick Stats', description: 'Key metrics at a glance in 2×2 grid', icon: Database },
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { type: 'policy_status', id: 'w-policy_status' },
  { type: 'approval_pipeline', id: 'w-approval_pipeline' },
  { type: 'risk_heatmap', id: 'w-risk_heatmap' },
  { type: 'latency_monitor', id: 'w-latency_monitor' },
  { type: 'agent_activity', id: 'w-agent_activity' },
  { type: 'quick_stats', id: 'w-quick_stats' },
]

const ROLE_COLORS: Record<string, string> = {
  DataAgent: '#06b6d4',
  CodeAgent: '#8b5cf6',
  FinanceAgent: '#f59e0b',
  SupportAgent: '#f43f5e',
}

const DECISION_COLORS: Record<string, string> = {
  ALLOW: '#10b981',
  BLOCK: '#ef4444',
  REQUIRE_APPROVAL: '#f59e0b',
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function formatTimeAgo(timestamp: string): string {
  const now = Date.now()
  const then = new Date(timestamp).getTime()
  const diff = now - then
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

// ─── Skeleton Loader ─────────────────────────────────────────────────────────

function WidgetSkeleton() {
  return (
    <div className="p-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded skeleton-shimmer" />
        <div className="h-4 w-24 rounded skeleton-shimmer" />
      </div>
      <div className="h-32 w-full rounded skeleton-shimmer" />
      <div className="flex gap-2">
        <div className="h-3 w-16 rounded skeleton-shimmer" />
        <div className="h-3 w-12 rounded skeleton-shimmer" />
      </div>
    </div>
  )
}

// ─── Widget: Policy Status (Donut Chart) ─────────────────────────────────────

function PolicyStatusWidget({ stats }: { stats: DashboardStats | undefined }) {
  const breakdown = stats?.policyBreakdown ?? {}
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0)
  const entries = Object.entries(breakdown)

  const donutSegments = useMemo(() => {
    if (total === 0) return []
    let cumulative = 0
    return entries.map(([key, value]) => {
      const startAngle = (cumulative / total) * 360
      cumulative += value
      const endAngle = (cumulative / total) * 360
      return { key, value, startAngle, endAngle, color: DECISION_COLORS[key] ?? '#888' }
    })
  }, [breakdown, total, entries])

  const describeArc = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
    const start = ((startAngle - 90) * Math.PI) / 180
    const end = ((endAngle - 90) * Math.PI) / 180
    const x1 = cx + r * Math.cos(start)
    const y1 = cy + r * Math.sin(start)
    const x2 = cx + r * Math.cos(end)
    const y2 = cy + r * Math.sin(end)
    const largeArc = endAngle - startAngle > 180 ? 1 : 0
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width="120" height="120" viewBox="0 0 120 120" className="gauge-glow">
        <circle cx="60" cy="60" r="44" fill="none" stroke="currentColor" strokeOpacity={0.06} strokeWidth="14" />
        {donutSegments.map((seg) => (
          <path
            key={seg.key}
            d={describeArc(60, 60, 44, seg.startAngle, seg.endAngle)}
            fill="none"
            stroke={seg.color}
            strokeWidth="14"
            strokeLinecap="butt"
            opacity={0.85}
          />
        ))}
        <text x="60" y="56" textAnchor="middle" className="fill-foreground text-xl font-bold tabular-nums font-mono">
          {total}
        </text>
        <text x="60" y="72" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: '10px' }}>
          policies
        </text>
      </svg>
      <div className="flex flex-wrap gap-2 justify-center">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: DECISION_COLORS[key] ?? '#888' }} />
            <span className="text-muted-foreground">{key === 'REQUIRE_APPROVAL' ? 'REVIEW' : key}</span>
            <span className="font-mono tabular-nums font-medium">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Widget: Approval Pipeline ───────────────────────────────────────────────

function ApprovalPipelineWidget({ stats, traces }: { stats: DashboardStats | undefined; traces: TraceRecord[] }) {
  const pending = stats?.pendingApprovals ?? 0
  const requireApproval = stats?.traceBreakdown?.REQUIRE_APPROVAL ?? 0
  const approved = (stats?.traceBreakdown?.ALLOW ?? 0)
  const rejected = (stats?.traceBreakdown?.BLOCK ?? 0)
  const total = Math.max(pending + approved + rejected, 1)

  const segments = [
    { label: 'Pending', count: pending, color: '#f59e0b', bgClass: 'bg-amber-500' },
    { label: 'Under Review', count: requireApproval, color: '#8b5cf6', bgClass: 'bg-violet-500' },
    { label: 'Approved', count: approved, color: '#10b981', bgClass: 'bg-emerald-500' },
    { label: 'Rejected', count: rejected, color: '#ef4444', bgClass: 'bg-red-500' },
  ]

  return (
    <div className="space-y-3">
      {/* Pipeline bar */}
      <div className="flex h-6 rounded-full overflow-hidden bg-muted">
        {segments.map((seg) => {
          const pct = (seg.count / total) * 100
          if (pct < 0.5) return null
          return (
            <motion.div
              key={seg.label}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className={`${seg.bgClass} flex items-center justify-center min-w-[2px]`}
              style={{ opacity: 0.85 }}
            >
              {pct > 12 && (
                <span className="text-white text-[9px] font-mono tabular-nums font-medium">{seg.count}</span>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* Pipeline stages */}
      <div className="flex items-center gap-1">
        {segments.map((seg, i) => (
          <div key={seg.label} className="flex items-center gap-1 flex-1 min-w-0">
            <div className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
              <div className={`h-7 w-7 rounded-full ${seg.bgClass}/10 flex items-center justify-center shrink-0`}>
                <span className={`text-[10px] font-mono tabular-nums font-bold`} style={{ color: seg.color }}>
                  {seg.count}
                </span>
              </div>
              <span className="text-[9px] text-muted-foreground truncate w-full text-center">{seg.label}</span>
            </div>
            {i < segments.length - 1 && (
              <ArrowUpRight className="h-3 w-3 text-muted-foreground/40 shrink-0 -rotate-45" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Widget: Risk Heatmap ────────────────────────────────────────────────────

function RiskHeatmapWidget({ traces }: { traces: TraceRecord[] }) {
  const roles = ['DataAgent', 'CodeAgent', 'FinanceAgent', 'SupportAgent']
  const riskCategories = ['SQL Injection', 'Data Exfil', 'Privilege Escal', 'Compliance']

  const heatmapData = useMemo(() => {
    const data: number[][] = []
    for (const role of roles) {
      const roleTraces = traces.filter(t => t.agentRole === role)
      const row: number[] = []
      const blockCount = roleTraces.filter(t => t.evaluationResult === 'BLOCK').length
      const total = Math.max(roleTraces.length, 1)

      for (const _cat of riskCategories) {
        // Simulated risk based on block ratio + trace volume
        const baseRisk = blockCount / total
        const volumeFactor = Math.min(roleTraces.length / 20, 1)
        const risk = Math.min(baseRisk * 0.6 + volumeFactor * 0.4 + Math.random() * 0.1, 1)
        row.push(Math.round(risk * 100) / 100)
      }
      data.push(row)
    }
    return data
  }, [traces, roles, riskCategories])

  const getHeatColor = (value: number) => {
    if (value < 0.25) return `rgba(16, 185, 129, ${0.2 + value * 0.8})`
    if (value < 0.5) return `rgba(245, 158, 11, ${0.3 + value * 0.5})`
    if (value < 0.75) return `rgba(249, 115, 22, ${0.4 + value * 0.4})`
    return `rgba(239, 68, 68, ${0.5 + value * 0.4})`
  }

  const cellSize = 36
  const labelWidth = 70
  const headerHeight = 28

  return (
    <div className="overflow-x-auto">
      <svg
        width={labelWidth + riskCategories.length * cellSize + 8}
        height={headerHeight + roles.length * cellSize + 8}
        className="w-full"
        viewBox={`0 0 ${labelWidth + riskCategories.length * cellSize + 8} ${headerHeight + roles.length * cellSize + 8}`}
      >
        {/* Column headers */}
        {riskCategories.map((cat, i) => (
          <text
            key={cat}
            x={labelWidth + i * cellSize + cellSize / 2}
            y={14}
            textAnchor="middle"
            className="fill-muted-foreground"
            style={{ fontSize: '8px' }}
          >
            {cat}
          </text>
        ))}
        {/* Rows */}
        {roles.map((role, ri) => (
          <g key={role}>
            <text
              x={labelWidth - 4}
              y={headerHeight + ri * cellSize + cellSize / 2 + 3}
              textAnchor="end"
              className="fill-muted-foreground"
              style={{ fontSize: '9px' }}
            >
              {role.replace('Agent', '')}
            </text>
            {riskCategories.map((_cat, ci) => {
              const val = heatmapData[ri]?.[ci] ?? 0
              return (
                <rect
                  key={`${ri}-${ci}`}
                  x={labelWidth + ci * cellSize + 1}
                  y={headerHeight + ri * cellSize + 1}
                  width={cellSize - 2}
                  height={cellSize - 2}
                  rx={4}
                  fill={getHeatColor(val)}
                />
              )
            })}
          </g>
        ))}
      </svg>
      <div className="flex items-center gap-2 mt-1 justify-center">
        <span className="text-[9px] text-muted-foreground">Low</span>
        <div className="flex gap-0.5">
          {[0.1, 0.3, 0.5, 0.7, 0.9].map(v => (
            <div key={v} className="h-2 w-4 rounded-sm" style={{ backgroundColor: getHeatColor(v) }} />
          ))}
        </div>
        <span className="text-[9px] text-muted-foreground">High</span>
      </div>
    </div>
  )
}

// ─── Widget: Latency Monitor ─────────────────────────────────────────────────

function LatencyMonitorWidget({ traces }: { traces: TraceRecord[] }) {
  const last10 = traces.slice(0, 10)
  const latencies = last10.map(t => t.latency)
  const avg = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0
  const max = latencies.length > 0 ? Math.max(...latencies) : 0
  const min = latencies.length > 0 ? Math.min(...latencies) : 0

  const width = 240
  const height = 80
  const padding = { top: 8, right: 8, bottom: 20, left: 8 }

  const points = useMemo(() => {
    if (latencies.length === 0) return ''
    const chartW = width - padding.left - padding.right
    const chartH = height - padding.top - padding.bottom
    const maxVal = Math.max(max, 1)

    return latencies.map((lat, i) => {
      const x = padding.left + (i / Math.max(latencies.length - 1, 1)) * chartW
      const y = padding.top + chartH - (lat / maxVal) * chartH
      return `${x},${y}`
    }).join(' ')
  }, [latencies, max, width, height, padding])

  const areaPath = useMemo(() => {
    if (latencies.length === 0) return ''
    const chartW = width - padding.left - padding.right
    const chartH = height - padding.top - padding.bottom
    const maxVal = Math.max(max, 1)

    const linePoints = latencies.map((lat, i) => {
      const x = padding.left + (i / Math.max(latencies.length - 1, 1)) * chartW
      const y = padding.top + chartH - (lat / maxVal) * chartH
      return { x, y }
    })

    const first = linePoints[0]
    const last = linePoints[linePoints.length - 1]
    let d = `M ${first.x} ${padding.top + chartH} L ${first.x} ${first.y}`
    linePoints.forEach(p => { d += ` L ${p.x} ${p.y}` })
    d += ` L ${last.x} ${padding.top + chartH} Z`
    return d
  }, [latencies, max, width, height, padding])

  return (
    <div className="space-y-2">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {latencies.length > 0 && (
          <>
            <defs>
              <linearGradient id="latGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#latGrad)" />
            <polyline
              points={points}
              fill="none"
              stroke="#10b981"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {latencies.map((lat, i) => {
              const chartW = width - padding.left - padding.right
              const chartH = height - padding.top - padding.bottom
              const maxVal = Math.max(max, 1)
              const x = padding.left + (i / Math.max(latencies.length - 1, 1)) * chartW
              const y = padding.top + chartH - (lat / maxVal) * chartH
              return <circle key={i} cx={x} cy={y} r={2.5} fill="#10b981" stroke="white" strokeWidth={1} />
            })}
          </>
        )}
      </svg>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">Avg: <span className="font-mono tabular-nums font-medium text-foreground">{avg.toFixed(1)}ms</span></span>
        <span className="text-muted-foreground">Max: <span className="font-mono tabular-nums font-medium text-red-500">{max.toFixed(1)}ms</span></span>
        <span className="text-muted-foreground">Min: <span className="font-mono tabular-nums font-medium text-emerald-500">{min.toFixed(1)}ms</span></span>
      </div>
    </div>
  )
}

// ─── Widget: Agent Activity ──────────────────────────────────────────────────

function AgentActivityWidget({ traces }: { traces: TraceRecord[] }) {
  const roleData = useMemo(() => {
    const counts: Record<string, number> = {}
    traces.forEach(t => {
      counts[t.agentRole] = (counts[t.agentRole] ?? 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [traces])

  const maxCount = Math.max(...roleData.map(r => r[1]), 1)

  return (
    <div className="space-y-2">
      {roleData.map(([role, count]) => {
        const pct = (count / maxCount) * 100
        const color = ROLE_COLORS[role] ?? '#888'
        return (
          <div key={role} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{role.replace('Agent', '')}</span>
              <span className="font-mono tabular-nums font-medium">{count}</span>
            </div>
            <div className="h-4 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ backgroundColor: color, opacity: 0.8 }}
              />
            </div>
          </div>
        )
      })}
      {roleData.length === 0 && (
        <div className="text-center text-muted-foreground text-xs py-4">No agent activity</div>
      )}
    </div>
  )
}

// ─── Widget: Compliance Score ────────────────────────────────────────────────

function ComplianceScoreWidget({ stats }: { stats: DashboardStats | undefined }) {
  const score = useMemo(() => {
    if (!stats?.traceBreakdown) return 0
    const total = Object.values(stats.traceBreakdown).reduce((a, b) => a + b, 0)
    if (total === 0) return 0
    return Math.round((stats.traceBreakdown.ALLOW ?? 0) / total * 100)
  }, [stats])

  const color = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'
  const trendUp = score >= 70
  const size = 100
  const strokeWidth = 8
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (score / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="gauge-glow">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.06}
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1, ease: 'easeOut' }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x={size / 2}
          y={size / 2 - 4}
          textAnchor="middle"
          className="fill-foreground font-bold tabular-nums font-mono"
          style={{ fontSize: '22px' }}
        >
          {score}%
        </text>
        <text
          x={size / 2}
          y={size / 2 + 12}
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: '9px' }}
        >
          compliance
        </text>
      </svg>
      <div className="flex items-center gap-1 text-xs">
        {trendUp ? (
          <ArrowUpRight className="h-3 w-3 text-emerald-500" />
        ) : (
          <ArrowDownRight className="h-3 w-3 text-red-500" />
        )}
        <span className={trendUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
          {trendUp ? 'On track' : 'Needs attention'}
        </span>
      </div>
    </div>
  )
}

// ─── Widget: Recent Blocks ───────────────────────────────────────────────────

function RecentBlocksWidget({ traces }: { traces: TraceRecord[] }) {
  const blockedTraces = useMemo(() => {
    return traces
      .filter(t => t.evaluationResult === 'BLOCK')
      .slice(0, 5)
  }, [traces])

  if (blockedTraces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
        <Shield className="h-8 w-8 mb-2 opacity-20" />
        <span className="text-xs">No recent blocks</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {blockedTraces.map((trace, i) => (
        <motion.div
          key={trace.traceId}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-md bg-red-500/5 border border-red-500/10"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <X className="h-3 w-3 text-red-500 shrink-0" />
            <span className="text-xs font-medium truncate">{trace.agentRole.replace('Agent', '')}</span>
            <span className="text-[10px] text-muted-foreground">→</span>
            <span className="text-xs truncate text-muted-foreground">{trace.toolName}</span>
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0 font-mono tabular-nums">
            {formatTimeAgo(trace.timestamp)}
          </span>
        </motion.div>
      ))}
    </div>
  )
}

// ─── Widget: Quick Stats ─────────────────────────────────────────────────────

function QuickStatsWidget({ stats }: { stats: DashboardStats | undefined }) {
  const items = [
    { label: 'Total Policies', value: stats?.totalPolicies ?? 0, icon: Shield, color: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Traces Today', value: stats?.recentTracesCount ?? 0, icon: Activity, color: 'text-violet-600 dark:text-violet-400' },
    { label: 'Pending Approvals', value: stats?.pendingApprovals ?? 0, icon: CheckSquare, color: 'text-amber-600 dark:text-amber-400' },
    { label: 'Avg Latency', value: `${(stats?.averageLatency ?? 0).toFixed(1)}ms`, icon: Clock, color: 'text-cyan-600 dark:text-cyan-400' },
  ]

  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-border/50 bg-muted/30 p-3 flex flex-col items-center gap-1">
          <item.icon className={`h-4 w-4 ${item.color}`} />
          <span className="font-mono tabular-nums text-sm font-bold">{item.value}</span>
          <span className="text-[10px] text-muted-foreground text-center leading-tight">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Widget Card ─────────────────────────────────────────────────────────────

function WidgetCard({
  config,
  onRemove,
  stats,
  traces,
  isLoading,
}: {
  config: WidgetConfig
  onRemove: (id: string) => void
  stats: DashboardStats | undefined
  traces: TraceRecord[]
  isLoading: boolean
}) {
  const meta = WIDGET_META[config.type]
  const Icon = meta.icon

  const renderContent = () => {
    if (isLoading) return <WidgetSkeleton />

    switch (config.type) {
      case 'policy_status':
        return <PolicyStatusWidget stats={stats} />
      case 'approval_pipeline':
        return <ApprovalPipelineWidget stats={stats} traces={traces} />
      case 'risk_heatmap':
        return <RiskHeatmapWidget traces={traces} />
      case 'latency_monitor':
        return <LatencyMonitorWidget traces={traces} />
      case 'agent_activity':
        return <AgentActivityWidget traces={traces} />
      case 'compliance_score':
        return <ComplianceScoreWidget stats={stats} />
      case 'recent_blocks':
        return <RecentBlocksWidget traces={traces} />
      case 'quick_stats':
        return <QuickStatsWidget stats={stats} />
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25 }}
      className="glass-card glow-hover card-shine corner-accent rounded-xl border border-border/50 shadow-sm min-h-[200px] flex flex-col"
    >
      {/* Title Bar */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/30">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 cursor-grab shrink-0" />
        <Icon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span className="text-xs font-semibold flex-1 truncate">{meta.label}</span>
        <button
          onClick={() => onRemove(config.id)}
          className="h-5 w-5 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors duration-150 shrink-0 active:scale-95"
          aria-label={`Remove ${meta.label} widget`}
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Content */}
      <CardContent className="flex-1 p-3">
        {renderContent()}
      </CardContent>
    </motion.div>
  )
}

// ─── Add Widget Dialog ───────────────────────────────────────────────────────

function AddWidgetDialog({
  open,
  onOpenChange,
  activeWidgets,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeWidgets: WidgetType[]
  onAdd: (type: WidgetType) => void
}) {
  const allTypes: WidgetType[] = [
    'policy_status',
    'approval_pipeline',
    'risk_heatmap',
    'latency_monitor',
    'agent_activity',
    'compliance_score',
    'recent_blocks',
    'quick_stats',
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-fullscreen-mobile sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Add Widget
          </DialogTitle>
          <DialogDescription>
            Choose a widget to add to your dashboard. Already-added widgets are disabled.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1">
            {allTypes.map((type) => {
              const meta = WIDGET_META[type]
              const Icon = meta.icon
              const isAdded = activeWidgets.includes(type)
              return (
                <button
                  key={type}
                  disabled={isAdded}
                  onClick={() => {
                    onAdd(type)
                    onOpenChange(false)
                  }}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-all duration-200 text-left
                    ${isAdded
                      ? 'border-border/30 bg-muted/20 opacity-50 cursor-not-allowed'
                      : 'border-border/50 bg-card hover:border-emerald-500/30 hover:shadow-md active:scale-[0.98] cursor-pointer'
                    }`}
                >
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isAdded ? 'bg-muted' : 'bg-emerald-500/10'
                  }`}>
                    <Icon className={`h-4 w-4 ${isAdded ? 'text-muted-foreground' : 'text-emerald-600 dark:text-emerald-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold flex items-center gap-1.5">
                      {meta.label}
                      {isAdded && (
                        <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 font-normal">Added</Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{meta.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function DashboardWidgets() {
  const timeRange = useAppStore((s) => s.timeRange)

  // Layout state
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGETS)
  const [layout, setLayout] = useState<'grid' | 'compact'>('grid')
  const [addDialogOpen, setAddDialogOpen] = useState(false)

  // Data fetching
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['stats', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/stats?timeRange=${timeRange}`)
      if (!res.ok) throw new Error('Failed to fetch stats')
      return res.json()
    },
    refetchInterval: 30000,
  })

  const { data: tracesData, isLoading: tracesLoading } = useQuery<{ traces: TraceRecord[] }>({
    queryKey: ['traces-widgets', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/traces?limit=50&timeRange=${timeRange}`)
      if (!res.ok) throw new Error('Failed to fetch traces')
      return res.json()
    },
    refetchInterval: 30000,
  })

  const traces = tracesData?.traces ?? []
  const isLoading = statsLoading || tracesLoading

  // Widget management
  const activeWidgetTypes = useMemo(() => widgets.map(w => w.type), [widgets])

  const addWidget = useCallback((type: WidgetType) => {
    setWidgets(prev => [...prev, { type, id: `w-${type}-${Date.now()}` }])
  }, [])

  const removeWidget = useCallback((id: string) => {
    setWidgets(prev => prev.filter(w => w.id !== id))
  }, [])

  const resetLayout = useCallback(() => {
    setWidgets(DEFAULT_WIDGETS)
  }, [])

  const gridCols = layout === 'compact'
    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
    : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 relative">
      {/* Background */}
      <div className="absolute inset-0 dot-grid opacity-30 pointer-events-none rounded-xl" />

      {/* Section Header */}
      <div className="section-header-gradient section-header-accent rounded-xl px-4 py-3 -mx-4 -mt-2 md:-mx-6 md:-mt-4 mb-2 relative overflow-hidden">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <h2 className="text-lg font-bold tracking-tight gradient-text-shimmer">Dashboard Widgets</h2>
        </div>
        <p className="text-sm text-muted-foreground ml-7">Customizable widget-based overview with drag-and-drop arrangement</p>
      </div>

      {/* Widget Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Add Widget Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 active:scale-[0.98] transition-transform"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Widget
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel className="text-[10px] text-muted-foreground">Available Widgets</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {Object.entries(WIDGET_META).map(([type, meta]) => {
              const isAdded = activeWidgetTypes.includes(type as WidgetType)
              const Icon = meta.icon
              return (
                <DropdownMenuItem
                  key={type}
                  disabled={isAdded}
                  onClick={() => addWidget(type as WidgetType)}
                  className="gap-2 text-xs"
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{meta.label}</span>
                  {isAdded && <Badge variant="outline" className="ml-auto text-[8px] px-1 py-0 h-3.5">Added</Badge>}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Add Widget Dialog Button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs gap-1.5 active:scale-[0.98] transition-transform"
          onClick={() => setAddDialogOpen(true)}
        >
          <LayoutList className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Browse All</span>
        </Button>

        <Separator orientation="vertical" className="h-5" />

        {/* Reset Layout */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs gap-1.5 active:scale-[0.98] transition-transform"
          onClick={resetLayout}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset Layout
        </Button>

        <div className="flex-1" />

        {/* Layout Toggle */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-md p-0.5">
          <button
            onClick={() => setLayout('grid')}
            className={`px-2 py-1 rounded text-[10px] font-medium transition-colors duration-150 ${
              layout === 'grid' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Grid
          </button>
          <button
            onClick={() => setLayout('compact')}
            className={`px-2 py-1 rounded text-[10px] font-medium transition-colors duration-150 ${
              layout === 'compact' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Compact
          </button>
        </div>

        {/* Widget Count Badge */}
        <Badge variant="outline" className="text-[10px] font-mono tabular-nums px-2">
          {widgets.length} widget{widgets.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Widget Grid */}
      <AnimatePresence mode="popLayout">
        <div className={`grid ${gridCols} gap-3 md:gap-4`}>
          {widgets.map((config) => (
            <WidgetCard
              key={config.id}
              config={config}
              onRemove={removeWidget}
              stats={stats}
              traces={traces}
              isLoading={isLoading}
            />
          ))}
        </div>
      </AnimatePresence>

      {/* Empty State */}
      {widgets.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <LayoutGrid className="h-12 w-12 text-muted-foreground/20 mb-3" />
          <h3 className="text-sm font-semibold text-muted-foreground">No widgets added</h3>
          <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">
            Click &ldquo;Add Widget&rdquo; to add dashboard widgets, or &ldquo;Reset Layout&rdquo; to restore defaults.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 h-8 text-xs gap-1.5 active:scale-[0.98] transition-transform"
            onClick={resetLayout}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restore Default Layout
          </Button>
        </motion.div>
      )}

      {/* Add Widget Dialog */}
      <AddWidgetDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        activeWidgets={activeWidgetTypes}
        onAdd={addWidget}
      />
    </div>
  )
}
