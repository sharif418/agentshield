'use client'

import { StatCard } from './StatCard'
import { EvaluatePanel } from './EvaluatePanel'
import { SystemHealthPanel } from './SystemHealthPanel'
import { PolicyConflictDetector } from './PolicyConflictDetector'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { Shield, Activity, CheckSquare, Clock, ArrowRight, Percent, Target, TrendingUp, Scan, FileCheck, Download, Plus, BarChart3 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts'
import { useAppStore } from '@/lib/store'
import { motion } from 'framer-motion'
import { useState, useEffect, useMemo } from 'react'

// ─── Agent Activity Timeline Component ────────────────────────────────────────

const TIMELINE_ROLE_COLORS: Record<string, string> = {
  DataAgent: '#06b6d4',
  CodeAgent: '#8b5cf6',
  FinanceAgent: '#f59e0b',
  SupportAgent: '#f43f5e',
}

const TIMELINE_DECISION_COLORS: Record<string, string> = {
  ALLOW: '#10b981',
  BLOCK: '#ef4444',
  REQUIRE_APPROVAL: '#f59e0b',
}

function AgentActivityTimeline() {
  const timeRange = useAppStore((s) => s.timeRange)

  const { data: tracesData, isLoading } = useQuery({
    queryKey: ['traces-timeline', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/traces?limit=50&timeRange=24h`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      return data.traces as Array<{
        traceId: string
        agentRole: string
        toolName: string
        evaluationResult: string
        timestamp: string
        latency: number
      }>
    },
    refetchInterval: 30000,
  })

  const [hoveredTrace, setHoveredTrace] = useState<string | null>(null)

  const traces = tracesData ?? []

  // Group by agent role
  const roles = useMemo(() => {
    const roleSet = new Set<string>()
    traces.forEach(t => roleSet.add(t.agentRole))
    return Array.from(roleSet).sort()
  }, [traces])

  // Time range: last 6 hours
  const timeRange6h = useMemo(() => {
    const now = Date.now()
    const start = now - 6 * 60 * 60 * 1000
    return { start, end: now }
  }, [])

  const hourMarkers = useMemo(() => {
    const markers: number[] = []
    const startHour = new Date(timeRange6h.start)
    startHour.setMinutes(0, 0, 0)
    let h = startHour.getTime()
    while (h <= timeRange6h.end) {
      if (h >= timeRange6h.start) markers.push(h)
      h += 60 * 60 * 1000
    }
    return markers
  }, [timeRange6h])

  const svgWidth = 700
  const labelWidth = 80
  const chartWidth = svgWidth - labelWidth - 20
  const laneHeight = 28
  const headerHeight = 24
  const svgHeight = headerHeight + roles.length * laneHeight + 10

  const xForTime = (ts: number) => {
    const pct = (ts - timeRange6h.start) / (timeRange6h.end - timeRange6h.start)
    return labelWidth + pct * chartWidth
  }

  return (
    <Card className="border-0 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 hover:border-emerald-500/20 glow-hover glass-card content-slide-in content-slide-in-delay-1">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Agent Activity Timeline
          <Badge variant="outline" className="text-[10px] font-mono tabular-nums ml-auto">Last 6h</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-32 skeleton-shimmer rounded" />
        ) : traces.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
            No trace data available
          </div>
        ) : (
          <div className="overflow-x-auto relative">
            <svg
              width="100%"
              height={svgHeight}
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="min-w-[500px]"
            >
              {/* Hour markers */}
              {hourMarkers.map((h) => {
                const x = xForTime(h)
                return (
                  <g key={h}>
                    <line
                      x1={x}
                      y1={headerHeight}
                      x2={x}
                      y2={svgHeight - 4}
                      stroke="currentColor"
                      strokeOpacity={0.06}
                      strokeDasharray="2 3"
                    />
                    <text
                      x={x}
                      y={14}
                      textAnchor="middle"
                      className="fill-muted-foreground"
                      style={{ fontSize: '8px' }}
                    >
                      {new Date(h).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </text>
                  </g>
                )
              })}

              {/* Role lanes */}
              {roles.map((role, ri) => {
                const y = headerHeight + ri * laneHeight
                const roleTraces = traces.filter(t => t.agentRole === role)
                const color = TIMELINE_ROLE_COLORS[role] ?? '#888'

                return (
                  <g key={role}>
                    {/* Lane background */}
                    <rect
                      x={labelWidth}
                      y={y}
                      width={chartWidth}
                      height={laneHeight}
                      fill={color}
                      fillOpacity={0.03}
                      rx={2}
                    />
                    {/* Lane label */}
                    <text
                      x={labelWidth - 6}
                      y={y + laneHeight / 2 + 3}
                      textAnchor="end"
                      className="fill-muted-foreground"
                      style={{ fontSize: '9px' }}
                    >
                      {role.replace('Agent', '')}
                    </text>
                    {/* Activity dots */}
                    {roleTraces.map((trace) => {
                      const ts = new Date(trace.timestamp).getTime()
                      if (ts < timeRange6h.start || ts > timeRange6h.end) return null
                      const dotX = xForTime(ts)
                      const dotY = y + laneHeight / 2
                      const dotColor = TIMELINE_DECISION_COLORS[trace.evaluationResult] ?? '#888'
                      const isHovered = hoveredTrace === trace.traceId

                      return (
                        <g key={trace.traceId}>
                          <circle
                            cx={dotX}
                            cy={dotY}
                            r={isHovered ? 6 : 4}
                            fill={dotColor}
                            fillOpacity={isHovered ? 1 : 0.7}
                            stroke={isHovered ? 'white' : 'none'}
                            strokeWidth={isHovered ? 2 : 0}
                            className="cursor-pointer transition-all duration-150"
                            onMouseEnter={() => setHoveredTrace(trace.traceId)}
                            onMouseLeave={() => setHoveredTrace(null)}
                          />
                        </g>
                      )
                    })}
                  </g>
                )
              })}

              {/* Now line */}
              <line
                x1={xForTime(timeRange6h.end)}
                y1={headerHeight}
                x2={xForTime(timeRange6h.end)}
                y2={svgHeight - 4}
                stroke="#10b981"
                strokeOpacity={0.4}
                strokeWidth={1.5}
                strokeDasharray="3 2"
              />
            </svg>

            {/* Tooltip */}
            {hoveredTrace && (() => {
              const trace = traces.find(t => t.traceId === hoveredTrace)
              if (!trace) return null
              const ts = new Date(trace.timestamp).getTime()
              const dotX = xForTime(ts)
              const ri = roles.indexOf(trace.agentRole)
              const dotY = headerHeight + ri * laneHeight + laneHeight / 2
              const decisionColor = trace.evaluationResult === 'ALLOW'
                ? 'text-emerald-600 dark:text-emerald-400'
                : trace.evaluationResult === 'BLOCK'
                ? 'text-red-600 dark:text-red-400'
                : 'text-amber-600 dark:text-amber-400'

              return (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute z-10 bg-popover border border-border rounded-lg shadow-lg px-3 py-2 text-xs pointer-events-none"
                  style={{
                    left: `max(${(dotX / svgWidth) * 100}%, 10%)`,
                    top: dotY + 10,
                    transform: 'translate(-50%, 0)',
                  }}
                >
                  <div className="font-medium">{trace.agentRole} → {trace.toolName}</div>
                  <div className={`font-bold ${decisionColor}`}>
                    {trace.evaluationResult === 'REQUIRE_APPROVAL' ? 'REVIEW' : trace.evaluationResult}
                  </div>
                  <div className="text-muted-foreground font-mono tabular-nums">
                    {new Date(trace.timestamp).toLocaleTimeString()} · {trace.latency.toFixed(1)}ms
                  </div>
                </motion.div>
              )
            })()}

            {/* Legend */}
            <div className="flex items-center gap-3 mt-2 justify-center">
              {Object.entries(TIMELINE_DECISION_COLORS).map(([key, color]) => (
                <div key={key} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                  {key === 'REQUIRE_APPROVAL' ? 'REVIEW' : key}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const PERMISSION_COLORS: Record<string, string> = {
  ALLOW: '#10b981',
  BLOCK: '#ef4444',
  REQUIRE_APPROVAL: '#f59e0b',
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

export function DashboardOverview() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setTimeout(() => setMounted(true), 0) }, [])

  const timeRange = useAppStore((s) => s.timeRange)

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['stats', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/stats?timeRange=${timeRange}`)
      if (!res.ok) throw new Error('Failed to fetch stats')
      return res.json()
    },
    refetchInterval: 30000,
  })

  const setActiveSection = useAppStore((s) => s.setActiveSection)

  // Build pie chart data
  const policyPieData = stats
    ? Object.entries(stats.policyBreakdown).map(([name, value]) => ({ name, value }))
    : []

  // Build area chart data for last 7 days
  const { data: tracesData } = useQuery({
    queryKey: ['traces-chart', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/traces?limit=200&timeRange=${timeRange}`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      return data.traces as Array<{
        timestamp: string
        evaluationResult: string
      }>
    },
    refetchInterval: 30000,
  })

  const areaChartData = (() => {
    if (!tracesData) return []
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const result: Array<{ day: string; ALLOW: number; BLOCK: number; REQUIRE_APPROVAL: number }> = []

    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      const dayEnd = new Date(dayStart.getTime() + 86400000)

      const dayTraces = tracesData.filter((t: { timestamp: string }) => {
        const tt = new Date(t.timestamp)
        return tt >= dayStart && tt < dayEnd
      })

      result.push({
        day: days[dayStart.getDay()],
        ALLOW: dayTraces.filter((t: { evaluationResult: string }) => t.evaluationResult === 'ALLOW').length,
        BLOCK: dayTraces.filter((t: { evaluationResult: string }) => t.evaluationResult === 'BLOCK').length,
        REQUIRE_APPROVAL: dayTraces.filter((t: { evaluationResult: string }) => t.evaluationResult === 'REQUIRE_APPROVAL').length,
      })
    }
    return result
  })()

  // Calculate Compliance Score
  const complianceScore = (() => {
    if (!stats?.traceBreakdown) return 0
    const total = Object.values(stats.traceBreakdown).reduce((a, b) => a + b, 0)
    if (total === 0) return 0
    return (stats.traceBreakdown.ALLOW ?? 0) / total * 100
  })()

  // Calculate Policy Coverage - per role from actual data
  const policyCoverage = (() => {
    const allRoles = ['DataAgent', 'CodeAgent', 'FinanceAgent', 'SupportAgent']
    const roleCoverage = allRoles.map(role => ({
      role,
      covered: (stats?.policiesByRole?.[role] ?? 0) > 0,
      count: stats?.policiesByRole?.[role] ?? 0,
    }))
    const coveredCount = roleCoverage.filter(r => r.covered).length
    return { covered: coveredCount, total: allRoles.length, pct: Math.round((coveredCount / allRoles.length) * 100), roles: roleCoverage }
  })()

  const decisionColor: Record<string, string> = {
    ALLOW: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    BLOCK: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    REQUIRE_APPROVAL: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  }

  const decisionDot: Record<string, string> = {
    ALLOW: 'bg-emerald-500',
    BLOCK: 'bg-red-500',
    REQUIRE_APPROVAL: 'bg-amber-500',
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 relative">
      {/* Dot grid background for section */}
      <div className="absolute inset-0 dot-grid opacity-30 pointer-events-none rounded-xl" />

      <div className="section-header-gradient section-header-accent rounded-xl px-4 py-3 -mx-4 -mt-2 md:-mx-6 md:-mt-4 mb-2 relative overflow-hidden">
        <h2 className="text-lg font-bold tracking-tight gradient-text-shimmer">Dashboard Overview</h2>
        <p className="text-sm text-muted-foreground">Monitor your AI agent governance in real-time</p>
      </div>

      {/* Stat Cards - responsive grid: 1 col mobile, 2 sm, 3 md, 6 lg */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 content-slide-in">
        <StatCard
          title="Total Policies"
          value={stats?.totalPolicies ?? 0}
          icon={Shield}
          trend={`${Object.keys(stats?.policyBreakdown ?? {}).length} types`}
          loading={isLoading}
          gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
          iconBg="bg-emerald-600/10 text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          title="Traces (24h)"
          value={stats?.recentTracesCount ?? 0}
          icon={Activity}
          trend={`${stats?.totalTraces ?? 0} total`}
          loading={isLoading}
          gradient="bg-gradient-to-br from-violet-500 to-purple-600"
          iconBg="bg-violet-600/10 text-violet-600 dark:text-violet-400"
        />
        <StatCard
          title="Pending Approvals"
          value={stats?.pendingApprovals ?? 0}
          icon={CheckSquare}
          trend={stats?.pendingApprovals ? 'Needs attention' : 'All clear'}
          trendUp={stats?.pendingApprovals ? false : null}
          loading={isLoading}
          gradient="bg-gradient-to-br from-amber-500 to-orange-600"
          iconBg="bg-amber-600/10 text-amber-600 dark:text-amber-400"
        />
        <StatCard
          title="Avg Latency"
          value={stats?.averageLatency ?? 0}
          icon={Clock}
          suffix="ms"
          trend="Policy eval"
          loading={isLoading}
          gradient="bg-gradient-to-br from-cyan-500 to-sky-600"
          iconBg="bg-cyan-600/10 text-cyan-600 dark:text-cyan-400"
        />
        <StatCard
          title="Compliance"
          value={complianceScore}
          icon={Percent}
          trend="ALLOW / total"
          trendUp={complianceScore >= 80 ? true : complianceScore >= 50 ? null : false}
          loading={isLoading}
          isPercentage
          gradient="bg-gradient-to-br from-emerald-500 to-green-600"
          iconBg="bg-emerald-600/10 text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          title="Coverage"
          value={policyCoverage.pct}
          icon={Target}
          trend={`${policyCoverage.covered}/${policyCoverage.total} roles`}
          trendUp={policyCoverage.pct >= 75 ? true : policyCoverage.pct >= 50 ? null : false}
          loading={isLoading}
          isPercentage
          gradient="bg-gradient-to-br from-teal-500 to-cyan-600"
          iconBg="bg-teal-600/10 text-teal-600 dark:text-teal-400"
        />
      </div>

      {/* Quick Actions Row */}
      <div className="flex flex-wrap gap-2 content-slide-in">
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-400 dark:hover:border-emerald-800 active:scale-[0.98] transition-all"
          onClick={() => setActiveSection('security')}
        >
          <Scan className="h-3.5 w-3.5" /> Run Scan
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 dark:hover:bg-amber-950/50 dark:hover:text-amber-400 dark:hover:border-amber-800 active:scale-[0.98] transition-all"
          onClick={() => setActiveSection('approvals')}
        >
          <FileCheck className="h-3.5 w-3.5" /> View Approvals
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5 hover:bg-cyan-50 hover:text-cyan-700 hover:border-cyan-300 dark:hover:bg-cyan-950/50 dark:hover:text-cyan-400 dark:hover:border-cyan-800 active:scale-[0.98] transition-all"
          onClick={() => setActiveSection('audit')}
        >
          <Download className="h-3.5 w-3.5" /> Export Traces
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300 dark:hover:bg-teal-950/50 dark:hover:text-teal-400 dark:hover:border-teal-800 active:scale-[0.98] transition-all"
          onClick={() => setActiveSection('policies')}
        >
          <Plus className="h-3.5 w-3.5" /> New Policy
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-400 dark:hover:border-emerald-800 active:scale-[0.98] transition-all"
          onClick={() => setActiveSection('overview')}
        >
          <BarChart3 className="h-3.5 w-3.5" /> View Compliance
        </Button>
      </div>

      {/* Decision Flow Summary */}
      <Card className="border-0 shadow-sm glass-card glow-hover content-slide-in content-slide-in-delay-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Decision Flow Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-16 skeleton-shimmer rounded" />
          ) : (
            <div className="space-y-3">
              {/* Flow visualization */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Total Evaluations</span>
                  <span className="text-sm font-bold tabular-nums">{stats?.totalTraces ?? 0}</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 data-point-pulse" />
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">ALLOW</span>
                  <span className="text-xs font-bold tabular-nums">{stats?.traceBreakdown?.ALLOW ?? 0}</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500 data-point-pulse" />
                  <span className="text-xs font-semibold text-red-600 dark:text-red-400">BLOCK</span>
                  <span className="text-xs font-bold tabular-nums">{stats?.traceBreakdown?.BLOCK ?? 0}</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500 data-point-pulse" />
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">REVIEW</span>
                  <span className="text-xs font-bold tabular-nums">{stats?.traceBreakdown?.REQUIRE_APPROVAL ?? 0}</span>
                </div>
              </div>
              {/* Animated width bars */}
              <div className="flex h-3 rounded-full overflow-hidden bg-muted/50">
                {(() => {
                  const total = Object.values(stats?.traceBreakdown ?? {}).reduce((a, b) => a + b, 0)
                  if (total === 0) return <div className="flex-1 bg-muted/30" />
                  const allowPct = ((stats?.traceBreakdown?.ALLOW ?? 0) / total) * 100
                  const blockPct = ((stats?.traceBreakdown?.BLOCK ?? 0) / total) * 100
                  const reviewPct = ((stats?.traceBreakdown?.REQUIRE_APPROVAL ?? 0) / total) * 100
                  return (
                    <>
                      <motion.div
                        className="bg-emerald-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${allowPct}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                      <motion.div
                        className="bg-red-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${blockPct}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                      />
                      <motion.div
                        className="bg-amber-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${reviewPct}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.4 }}
                      />
                    </>
                  )
                })()}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 content-slide-in content-slide-in-delay-1">
        {/* Policy Distribution Pie */}
        <Card className="border-0 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 hover:border-emerald-500/20 glow-hover glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Policy Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {mounted && policyPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={policyPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                    fontSize={11}
                    strokeWidth={2}
                    stroke="var(--background)"
                    animationBegin={0}
                    animationDuration={600}
                  >
                    {policyPieData.map((entry) => (
                      <Cell key={entry.name} fill={PERMISSION_COLORS[entry.name] ?? '#8884d8'} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: 'hsl(var(--foreground))',
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px' }}
                    formatter={(value: string) => <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : !mounted ? (
              <div className="h-[220px] flex items-center justify-center">
                <div className="h-16 w-16 rounded-full skeleton-shimmer" />
              </div>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                No policy data
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trace Activity Area Chart */}
        <Card className="lg:col-span-2 border-0 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 hover:border-emerald-500/20 glow-hover glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Trace Activity (7 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mounted && areaChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={areaChartData}>
                  <defs>
                    <linearGradient id="allowGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={PERMISSION_COLORS.ALLOW} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={PERMISSION_COLORS.ALLOW} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="blockGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={PERMISSION_COLORS.BLOCK} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={PERMISSION_COLORS.BLOCK} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="approvalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={PERMISSION_COLORS.REQUIRE_APPROVAL} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={PERMISSION_COLORS.REQUIRE_APPROVAL} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: 'hsl(var(--foreground))',
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px' }}
                    formatter={(value: string) => <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>}
                  />
                  <Area type="monotone" dataKey="ALLOW" stackId="1" stroke={PERMISSION_COLORS.ALLOW} fill="url(#allowGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="BLOCK" stackId="1" stroke={PERMISSION_COLORS.BLOCK} fill="url(#blockGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="REQUIRE_APPROVAL" stackId="1" stroke={PERMISSION_COLORS.REQUIRE_APPROVAL} fill="url(#approvalGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : !mounted ? (
              <div className="h-[220px] flex flex-col items-center justify-center gap-2">
                <div className="w-3/4 h-24 skeleton-shimmer rounded" />
                <div className="flex gap-1 w-3/4">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="flex-1 h-2 skeleton-shimmer rounded" />
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                No trace data
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Agent Activity Timeline */}
      <AgentActivityTimeline />

      {/* System Health Panel + Policy Conflict Detector */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 content-slide-in content-slide-in-delay-2">
        <SystemHealthPanel />
        <PolicyConflictDetector />
      </div>

      {/* Recent Activity + Evaluate Panel + Policy Coverage - stack on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 content-slide-in content-slide-in-delay-3">
        {/* Recent Activity Feed */}
        <Card className="md:col-span-2 border-0 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 hover:border-emerald-500/20 glow-hover glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-72">
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 py-1.5 px-2">
                      <div className="h-2 w-2 rounded-full skeleton-shimmer shrink-0" />
                      <div className="h-3 w-16 skeleton-shimmer rounded" />
                      <div className="h-3 w-6 skeleton-shimmer rounded" />
                      <div className="h-3 w-20 skeleton-shimmer rounded" />
                      <div className="ml-auto h-5 w-16 skeleton-shimmer rounded" />
                      <div className="h-3 w-10 skeleton-shimmer rounded" />
                    </div>
                  ))}
                </div>
              ) : stats?.recentTraces?.length ? (
                <div className="space-y-1">
                  {stats.recentTraces.map((trace, i) => {
                    // Generate mini sparkline data from latency trend
                    const sparkData = [trace.latency * 0.6, trace.latency * 0.8, trace.latency * 0.7, trace.latency * 0.9, trace.latency]
                    const sparkMax = Math.max(...sparkData, 1)
                    const sparkMin = Math.min(...sparkData, 0)
                    const sparkRange = sparkMax - sparkMin || 1
                    const sparkPoints = sparkData.map((v, j) => {
                      const x = (j / (sparkData.length - 1)) * 48
                      const y = 14 - ((v - sparkMin) / sparkRange) * 12
                      return `${x},${y}`
                    }).join(' ')
                    const sparkColor = trace.evaluationResult === 'ALLOW' ? '#10b981' : trace.evaluationResult === 'BLOCK' ? '#ef4444' : '#f59e0b'

                    return (
                      <motion.button
                        key={trace.traceId}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors duration-200 text-xs w-full text-left group active:scale-[0.99]"
                        onClick={() => setActiveSection('traces')}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${decisionDot[trace.evaluationResult] ?? 'bg-gray-400'}`} />
                          <span className="font-medium truncate">{trace.agentRole}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="truncate">{trace.toolName}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {/* Mini sparkline */}
                          <svg width="48" height="14" className="opacity-50 group-hover:opacity-80 transition-opacity">
                            <polyline
                              points={sparkPoints}
                              fill="none"
                              stroke={sparkColor}
                              strokeWidth="1.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          <Badge className={`transition-transform duration-150 hover:scale-105 ${decisionColor[trace.evaluationResult] ?? ''}`} variant="outline">
                            {trace.evaluationResult === 'REQUIRE_APPROVAL' ? 'APPROVAL' : trace.evaluationResult}
                          </Badge>
                          <span className="text-muted-foreground w-14 text-right font-mono tabular-nums">{trace.latency.toFixed(1)}ms</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200" />
                        </div>
                      </motion.button>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center text-muted-foreground text-sm py-8">
                  No recent traces found
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Policy Coverage Card with Compliance Gauge */}
        <Card className="border-0 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 hover:border-emerald-500/20 glow-hover glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Policy Coverage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Compliance Gauge */}
            <div className="flex justify-center">
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
                  stroke={
                    policyCoverage.pct > 80 ? '#10b981'
                    : policyCoverage.pct >= 50 ? '#f59e0b'
                    : '#ef4444'
                  }
                  strokeOpacity={0.8}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${policyCoverage.pct * 1.884} 188.4`}
                />
                {/* Tick marks at 25%, 50%, 75%, 100% */}
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
                {/* Percentage text */}
                <text
                  x="80"
                  y="68"
                  textAnchor="middle"
                  className="fill-foreground text-lg font-bold tabular-nums"
                >
                  {policyCoverage.pct}%
                </text>
                <text
                  x="80"
                  y="82"
                  textAnchor="middle"
                  className="fill-muted-foreground text-[9px]"
                >
                  coverage
                </text>
              </svg>
            </div>
            <p className="text-xs text-muted-foreground text-center">{policyCoverage.covered} of {policyCoverage.total} agent roles covered</p>
            <div className="space-y-2">
              {policyCoverage.roles.map((rc) => (
                <div key={rc.role} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{rc.role}</span>
                  <span className={rc.covered ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-red-500'}>
                    {rc.covered ? `● ${rc.count} policies` : '○ No policies'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Evaluate - stacks below on mobile */}
        <EvaluatePanel />
      </div>
    </div>
  )
}
