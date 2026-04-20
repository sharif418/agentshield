'use client'

import { StatCard } from './StatCard'
import { EvaluatePanel } from './EvaluatePanel'
import { SystemHealthPanel } from './SystemHealthPanel'
import { PolicyConflictDetector } from './PolicyConflictDetector'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { Shield, Activity, CheckSquare, Clock, ArrowRight, Percent, Target, TrendingUp } from 'lucide-react'
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
import { useState, useEffect } from 'react'

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
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="section-header-gradient rounded-xl px-4 py-3 -mx-4 -mt-2 md:-mx-6 md:-mt-4 mb-2">
        <h2 className="text-lg font-bold tracking-tight bg-gradient-to-r from-emerald-700 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">Dashboard Overview</h2>
        <p className="text-sm text-muted-foreground">Monitor your AI agent governance in real-time</p>
      </div>

      {/* Stat Cards - responsive grid: 1 col mobile, 2 sm, 3 md, 6 lg */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Policy Distribution Pie */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-300 glow-hover glass-card">
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
                <div className="h-16 w-16 rounded-full border-4 border-muted animate-pulse" />
              </div>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                No policy data
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trace Activity Area Chart */}
        <Card className="lg:col-span-2 border-0 shadow-sm hover:shadow-md transition-shadow duration-300 glow-hover glass-card">
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
              <div className="h-[220px] flex items-center justify-center">
                <div className="w-3/4 h-24 bg-muted/30 animate-pulse rounded" />
              </div>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                No trace data
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* System Health Panel + Policy Conflict Detector */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <SystemHealthPanel />
        <PolicyConflictDetector />
      </div>

      {/* Recent Activity + Evaluate Panel + Policy Coverage - stack on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Recent Activity Feed */}
        <Card className="md:col-span-2 border-0 shadow-sm hover:shadow-md transition-shadow duration-300 glow-hover glass-card">
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
                    <div key={i} className="h-10 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : stats?.recentTraces?.length ? (
                <div className="space-y-1">
                  {stats.recentTraces.map((trace, i) => (
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
                        <Badge className={`transition-transform duration-150 hover:scale-105 ${decisionColor[trace.evaluationResult] ?? ''}`} variant="outline">
                          {trace.evaluationResult === 'REQUIRE_APPROVAL' ? 'APPROVAL' : trace.evaluationResult}
                        </Badge>
                        <span className="text-muted-foreground w-14 text-right font-mono tabular-nums">{trace.latency.toFixed(1)}ms</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200" />
                      </div>
                    </motion.button>
                  ))}
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
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-300 glow-hover glass-card">
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
