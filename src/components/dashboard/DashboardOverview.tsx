'use client'

import { StatCard } from './StatCard'
import { EvaluatePanel } from './EvaluatePanel'
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
}

export function DashboardOverview() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['stats'],
    queryFn: async () => {
      const res = await fetch('/api/stats')
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
    queryKey: ['traces-chart'],
    queryFn: async () => {
      const res = await fetch('/api/traces?limit=200')
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

  // Calculate Policy Coverage
  const policyCoverage = (() => {
    if (!stats?.policyBreakdown) return { covered: 0, total: 4, pct: 0 }
    const totalRoles = 4
    if (stats.totalPolicies >= 12) return { covered: totalRoles, total: totalRoles, pct: 100 }
    if (stats.totalPolicies >= 8) return { covered: 3, total: totalRoles, pct: 75 }
    if (stats.totalPolicies >= 4) return { covered: 2, total: totalRoles, pct: 50 }
    if (stats.totalPolicies >= 1) return { covered: 1, total: totalRoles, pct: 25 }
    return { covered: 0, total: totalRoles, pct: 0 }
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
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Dashboard Overview</h2>
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
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-300 hover:border-emerald-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Policy Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {policyPieData.length > 0 ? (
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
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                No policy data
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trace Activity Area Chart */}
        <Card className="lg:col-span-2 border-0 shadow-sm hover:shadow-md transition-shadow duration-300 hover:border-emerald-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Trace Activity (7 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {areaChartData.length > 0 ? (
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
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                No trace data
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity + Evaluate Panel + Policy Coverage - stack on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Recent Activity Feed */}
        <Card className="md:col-span-2 border-0 shadow-sm hover:shadow-md transition-shadow duration-300">
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

        {/* Policy Coverage Card */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Policy Coverage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{policyCoverage.pct}%</span>
              <p className="text-xs text-muted-foreground mt-1">{policyCoverage.covered} of {policyCoverage.total} agent roles covered</p>
            </div>
            <Progress value={policyCoverage.pct} className="h-2" />
            <div className="space-y-2">
              {['DataAgent', 'CodeAgent', 'FinanceAgent', 'SupportAgent'].map((role) => {
                const covered = stats?.totalPolicies ? stats.totalPolicies >= 4 : false
                return (
                  <div key={role} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{role}</span>
                    <span className={covered ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-red-500'}>
                      {covered ? '● Covered' : '○ No policies'}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Quick Evaluate - stacks below on mobile */}
        <EvaluatePanel />
      </div>
    </div>
  )
}
