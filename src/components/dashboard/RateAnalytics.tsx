'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Gauge,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  Clock,
  Database,
  Code2,
  DollarSign,
  Headphones,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  BarChart3,
  Flame,
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { useAppStore } from '@/lib/store'
import { formatDistanceToNow } from 'date-fns'

// ===== Types =====

interface Trace {
  traceId: string
  agentRole: string
  toolName: string
  evaluationResult: string
  latency: number
  timestamp: string
  intentPayload: string
  policy?: { name: string; permissionLevel: string; action: string; priority: number } | null
}

interface DashboardStats {
  totalPolicies: number
  totalTraces: number
  averageLatency: number
  traceBreakdown: Record<string, number>
}

// ===== Constants =====

const AGENT_ROLES = ['DataAgent', 'CodeAgent', 'FinanceAgent', 'SupportAgent'] as const

const agentMeta: Record<string, { icon: React.ReactNode; iconBg: string; iconColor: string; barColor: string }> = {
  DataAgent: {
    icon: <Database className="h-4 w-4" />,
    iconBg: 'bg-cyan-500/10',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    barColor: '#06b6d4',
  },
  CodeAgent: {
    icon: <Code2 className="h-4 w-4" />,
    iconBg: 'bg-violet-500/10',
    iconColor: 'text-violet-600 dark:text-violet-400',
    barColor: '#8b5cf6',
  },
  FinanceAgent: {
    icon: <DollarSign className="h-4 w-4" />,
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-600 dark:text-amber-400',
    barColor: '#f59e0b',
  },
  SupportAgent: {
    icon: <Headphones className="h-4 w-4" />,
    iconBg: 'bg-rose-500/10',
    iconColor: 'text-rose-600 dark:text-rose-400',
    barColor: '#f43f5e',
  },
}

const defaultMeta = {
  icon: <Activity className="h-4 w-4" />,
  iconBg: 'bg-gray-500/10',
  iconColor: 'text-gray-600 dark:text-gray-400',
  barColor: '#6b7280',
}

const decisionColors: Record<string, string> = {
  ALLOW: '#10b981',
  BLOCK: '#ef4444',
  REQUIRE_APPROVAL: '#f59e0b',
}

const decisionBadgeClasses: Record<string, string> = {
  ALLOW: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  BLOCK: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  REQUIRE_APPROVAL: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
}

// ===== Animated Number =====

function AnimatedNumber({ value, suffix = '', decimals = 0 }: { value: number; suffix?: string; decimals?: number }) {
  const displayVal = decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString()
  return (
    <span className="text-2xl font-extrabold font-mono tabular-nums leading-tight">
      {displayVal}{suffix}
    </span>
  )
}

// ===== Mini Sparkline =====

function MiniSparkline({ data, color = '#10b981' }: { data: number[]; color?: string }) {
  const width = 60
  const height = 20
  const padding = 2

  const points = useMemo(() => {
    if (data.length < 2) return ''
    const max = Math.max(...data, 1)
    const min = Math.min(...data, 0)
    const range = max - min || 1
    return data.map((v, i) => {
      const x = padding + (i / (data.length - 1)) * (width - padding * 2)
      const y = padding + (1 - (v - min) / range) * (height - padding * 2)
      return `${x},${y}`
    }).join(' ')
  }, [data])

  if (data.length < 2) return null

  return (
    <svg width={width} height={height} className="opacity-50 group-hover:opacity-80 transition-opacity duration-300">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ===== Skeleton Loader =====

function SkeletonCard() {
  return (
    <Card className="border-0 shadow-sm glass-card">
      <CardContent className="p-4 md:p-6">
        <div className="space-y-3">
          <div className="h-3 w-24 bg-muted/50 animate-pulse rounded" />
          <div className="h-8 w-20 bg-muted/50 animate-pulse rounded" />
          <div className="h-3 w-32 bg-muted/50 animate-pulse rounded" />
        </div>
      </CardContent>
    </Card>
  )
}

function SkeletonChart() {
  return (
    <Card className="border-0 shadow-sm glass-card">
      <CardContent className="p-4 md:p-6">
        <div className="space-y-4">
          <div className="h-4 w-40 bg-muted/50 animate-pulse rounded" />
          <div className="h-64 w-full bg-muted/50 animate-pulse rounded" />
        </div>
      </CardContent>
    </Card>
  )
}

// ===== Custom Tooltip for Area Chart =====

function RateChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null
  const total = payload.reduce((sum, p) => sum + p.value, 0)
  return (
    <div className="glass-card rounded-lg p-3 shadow-lg border border-border text-xs space-y-2">
      <div className="font-semibold text-foreground">{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            {entry.name}
          </span>
          <span className="font-mono tabular-nums font-medium">
            {entry.value}
            <span className="text-muted-foreground ml-1">
              ({total > 0 ? ((entry.value / total) * 100).toFixed(0) : 0}%)
            </span>
          </span>
        </div>
      ))}
      <Separator />
      <div className="flex items-center justify-between font-medium">
        <span>Total</span>
        <span className="font-mono tabular-nums">{total}</span>
      </div>
    </div>
  )
}

// ===== Custom Tooltip for Heatmap =====

function HeatmapTooltip({ cell, position }: { cell: { role: string; hour: number; count: number } | null; position: { x: number; y: number } }) {
  if (!cell) return null
  return (
    <div
      className="glass-card rounded-lg p-2.5 shadow-lg border border-border text-xs pointer-events-none fixed z-50"
      style={{ left: position.x + 12, top: position.y - 40 }}
    >
      <div className="font-semibold">{cell.role}</div>
      <div className="text-muted-foreground">
        Hour {cell.hour}:00 — <span className="font-mono tabular-nums text-foreground">{cell.count}</span> evals
      </div>
    </div>
  )
}

// ===== Latency Distribution Tooltip =====

function LatencyTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="glass-card rounded-lg p-3 shadow-lg border border-border text-xs space-y-1.5">
      <div className="font-semibold text-foreground">{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            {entry.name}
          </span>
          <span className="font-mono tabular-nums">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

// ===== Main Component =====

export function RateAnalytics() {
  const timeRange = useAppStore((s) => s.timeRange)
  const [latencyThreshold, setLatencyThreshold] = useState(50)
  const [heatmapTooltip, setHeatmapTooltip] = useState<{
    cell: { role: string; hour: number; count: number } | null
    position: { x: number; y: number }
  }>({ cell: null, position: { x: 0, y: 0 } })

  // Fetch traces data
  const { data: tracesData, isLoading: tracesLoading } = useQuery({
    queryKey: ['rate-analytics-traces', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/traces?limit=200&timeRange=${timeRange}`)
      if (!res.ok) return { traces: [] as Trace[], total: 0 }
      return res.json() as Promise<{ traces: Trace[]; total: number }>
    },
  })

  // Fetch stats data
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['rate-analytics-stats', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/stats?timeRange=${timeRange}`)
      if (!res.ok) return null
      return res.json() as Promise<DashboardStats>
    },
  })

  const traces = tracesData?.traces ?? []

  // ===== Computed Metrics =====

  const totalEvaluations = useMemo(() => traces.length, [traces])

  const avgThroughput = useMemo(() => {
    if (traces.length === 0) return 0
    const timestamps = traces.map(t => new Date(t.timestamp).getTime())
    const minTs = Math.min(...timestamps)
    const maxTs = Math.max(...timestamps)
    const hoursDiff = (maxTs - minTs) / (1000 * 60 * 60)
    if (hoursDiff <= 0) return traces.length
    return traces.length / hoursDiff
  }, [traces])

  const peakRate = useMemo(() => {
    if (traces.length === 0) return 0
    // Group traces into 1-hour windows
    const hourBuckets: Record<number, number> = {}
    for (const t of traces) {
      const ts = new Date(t.timestamp).getTime()
      const hourBucket = Math.floor(ts / (1000 * 60 * 60))
      hourBuckets[hourBucket] = (hourBuckets[hourBucket] ?? 0) + 1
    }
    return Math.max(...Object.values(hourBuckets), 0)
  }, [traces])

  const p99Latency = useMemo(() => {
    if (traces.length === 0) return 0
    const latencies = traces.map(t => t.latency).sort((a, b) => a - b)
    const p99Index = Math.ceil(latencies.length * 0.99) - 1
    return latencies[p99Index] ?? 0
  }, [traces])

  // Sparkline data for stat cards
  const sparklineData = useMemo(() => {
    if (traces.length === 0) return { total: [0, 0, 0, 0, 0], throughput: [0, 0, 0, 0, 0], peak: [0, 0, 0, 0, 0], latency: [0, 0, 0, 0, 0] }
    // Split traces into 5 buckets for sparkline
    const sorted = [...traces].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    const bucketSize = Math.ceil(sorted.length / 5)
    const buckets: Trace[][] = []
    for (let i = 0; i < 5; i++) {
      buckets.push(sorted.slice(i * bucketSize, (i + 1) * bucketSize))
    }

    return {
      total: buckets.map(b => b.length),
      throughput: buckets.map((b, i) => {
        if (b.length === 0) return 0
        const ts = b.map(t => new Date(t.timestamp).getTime())
        const hours = (Math.max(...ts) - Math.min(...ts)) / (1000 * 60 * 60)
        return hours > 0 ? b.length / hours : b.length
      }),
      peak: buckets.map(b => {
        const hourBuckets: Record<number, number> = {}
        for (const t of b) {
          const hb = Math.floor(new Date(t.timestamp).getTime() / (1000 * 60 * 60))
          hourBuckets[hb] = (hourBuckets[hb] ?? 0) + 1
        }
        return Math.max(...Object.values(hourBuckets), 0)
      }),
      latency: buckets.map(b => {
        if (b.length === 0) return 0
        const lat = b.map(t => t.latency).sort((a, c) => a - c)
        return lat[Math.ceil(lat.length * 0.99) - 1] ?? 0
      }),
    }
  }, [traces])

  // ===== Evaluation Rate Over Time (Area Chart) =====

  const rateChartData = useMemo(() => {
    if (traces.length === 0) return []

    // Determine bucket size based on time range
    let bucketMs: number
    switch (timeRange) {
      case '24h': bucketMs = 60 * 60 * 1000; break // 1 hour
      case '7d': bucketMs = 24 * 60 * 60 * 1000; break // 1 day
      case '30d': bucketMs = 24 * 60 * 60 * 1000; break // 1 day
      case '90d': bucketMs = 7 * 24 * 60 * 60 * 1000; break // 1 week
      default: bucketMs = 60 * 60 * 1000
    }

    const timestamps = traces.map(t => new Date(t.timestamp).getTime())
    const minTs = Math.min(...timestamps)
    const maxTs = Math.max(...timestamps)

    const buckets: Record<string, { ALLOW: number; BLOCK: number; REQUIRE_APPROVAL: number; label: string }> = {}

    // Initialize all buckets in the range
    const startBucket = Math.floor(minTs / bucketMs) * bucketMs
    const endBucket = Math.ceil(maxTs / bucketMs) * bucketMs
    for (let ts = startBucket; ts <= endBucket; ts += bucketMs) {
      const key = ts.toString()
      const date = new Date(ts)
      let label: string
      if (bucketMs < 24 * 60 * 60 * 1000) {
        label = `${date.getHours().toString().padStart(2, '0')}:00`
      } else if (bucketMs < 7 * 24 * 60 * 60 * 1000) {
        label = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`
      } else {
        label = `W${Math.ceil((date.getDate()) / 7)} ${date.getMonth() + 1}/${date.getDate()}`
      }
      buckets[key] = { ALLOW: 0, BLOCK: 0, REQUIRE_APPROVAL: 0, label }
    }

    // Fill buckets
    for (const t of traces) {
      const ts = new Date(t.timestamp).getTime()
      const key = (Math.floor(ts / bucketMs) * bucketMs).toString()
      if (buckets[key]) {
        const result = t.evaluationResult as 'ALLOW' | 'BLOCK' | 'REQUIRE_APPROVAL'
        if (result in buckets[key]) {
          buckets[key][result]++
        }
      }
    }

    return Object.entries(buckets)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([, v]) => ({
        name: v.label,
        ALLOW: v.ALLOW,
        BLOCK: v.BLOCK,
        REQUIRE_APPROVAL: v.REQUIRE_APPROVAL,
      }))
  }, [traces, timeRange])

  // ===== Heatmap Data =====

  const heatmapData = useMemo(() => {
    const grid: Record<string, Record<number, number>> = {}
    for (const role of AGENT_ROLES) {
      grid[role] = {}
      for (let h = 0; h < 24; h++) {
        grid[role][h] = 0
      }
    }
    for (const t of traces) {
      const hour = new Date(t.timestamp).getHours()
      if (grid[t.agentRole]) {
        grid[t.agentRole][hour] = (grid[t.agentRole][hour] ?? 0) + 1
      }
    }
    return grid
  }, [traces])

  const heatmapMax = useMemo(() => {
    let max = 0
    for (const role of AGENT_ROLES) {
      for (let h = 0; h < 24; h++) {
        const v = heatmapData[role]?.[h] ?? 0
        if (v > max) max = v
      }
    }
    return max || 1
  }, [heatmapData])

  // ===== Per-Agent Rate Cards =====

  const agentRateData = useMemo(() => {
    return AGENT_ROLES.map(role => {
      const roleTraces = traces.filter(t => t.agentRole === role)
      const allowCount = roleTraces.filter(t => t.evaluationResult === 'ALLOW').length
      const blockCount = roleTraces.filter(t => t.evaluationResult === 'BLOCK').length
      const reviewCount = roleTraces.filter(t => t.evaluationResult === 'REQUIRE_APPROVAL').length

      // Compute rate (evals/hour)
      let rate = 0
      if (roleTraces.length > 1) {
        const ts = roleTraces.map(t => new Date(t.timestamp).getTime())
        const hours = (Math.max(...ts) - Math.min(...ts)) / (1000 * 60 * 60)
        rate = hours > 0 ? roleTraces.length / hours : roleTraces.length
      } else if (roleTraces.length === 1) {
        rate = 1
      }

      // Trend: compare first half vs second half
      const sorted = [...roleTraces].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      const mid = Math.floor(sorted.length / 2)
      const firstHalf = sorted.slice(0, mid)
      const secondHalf = sorted.slice(mid)
      const firstRate = firstHalf.length
      const secondRate = secondHalf.length
      const trendPercent = firstRate > 0 ? ((secondRate - firstRate) / firstRate) * 100 : 0
      const trendUp = trendPercent > 0

      // Avg latency
      const avgLatency = roleTraces.length > 0
        ? roleTraces.reduce((sum, t) => sum + t.latency, 0) / roleTraces.length
        : 0

      return {
        role,
        rate: Math.round(rate * 10) / 10,
        allowCount,
        blockCount,
        reviewCount,
        totalTraces: roleTraces.length,
        trendPercent: Math.abs(Math.round(trendPercent)),
        trendUp,
        avgLatency: Math.round(avgLatency * 100) / 100,
      }
    })
  }, [traces])

  // ===== Latency Distribution =====

  const latencyDistribution = useMemo(() => {
    const buckets = [
      { label: '0-2ms', min: 0, max: 2 },
      { label: '2-5ms', min: 2, max: 5 },
      { label: '5-10ms', min: 5, max: 10 },
      { label: '10-20ms', min: 10, max: 20 },
      { label: '20-50ms', min: 20, max: 50 },
      { label: '50ms+', min: 50, max: Infinity },
    ]

    return buckets.map(bucket => {
      const bucketTraces = traces.filter(t => t.latency >= bucket.min && t.latency < bucket.max)
      const allow = bucketTraces.filter(t => t.evaluationResult === 'ALLOW').length
      const block = bucketTraces.filter(t => t.evaluationResult === 'BLOCK').length
      const review = bucketTraces.filter(t => t.evaluationResult === 'REQUIRE_APPROVAL').length
      return {
        name: bucket.label,
        ALLOW: allow,
        BLOCK: block,
        REQUIRE_APPROVAL: review,
      }
    })
  }, [traces])

  const latencyPercentiles = useMemo(() => {
    if (traces.length === 0) return { p50: 0, p95: 0, p99: 0 }
    const latencies = traces.map(t => t.latency).sort((a, b) => a - b)
    return {
      p50: latencies[Math.ceil(latencies.length * 0.5) - 1] ?? 0,
      p95: latencies[Math.ceil(latencies.length * 0.95) - 1] ?? 0,
      p99: latencies[Math.ceil(latencies.length * 0.99) - 1] ?? 0,
    }
  }, [traces])

  // ===== Slow Traces (Rate Limiting Violations) =====

  const slowTraces = useMemo(() => {
    return traces
      .filter(t => t.latency > latencyThreshold)
      .sort((a, b) => b.latency - a.latency)
      .slice(0, 50)
  }, [traces, latencyThreshold])

  // ===== Heatmap Cell Hover =====

  const handleHeatmapMouseEnter = useCallback((role: string, hour: number, count: number, e: React.MouseEvent) => {
    setHeatmapTooltip({
      cell: { role, hour, count },
      position: { x: e.clientX, y: e.clientY },
    })
  }, [])

  const handleHeatmapMouseLeave = useCallback(() => {
    setHeatmapTooltip({ cell: null, position: { x: 0, y: 0 } })
  }, [])

  // ===== Loading State =====

  if (tracesLoading || statsLoading) {
    return (
      <div className="h-full flex flex-col p-4 md:p-6 gap-4">
        <div className="section-header-gradient rounded-xl px-4 py-3 -mx-4 -mt-2 md:-mx-6 md:-mt-4 mb-2">
          <div className="h-6 w-40 bg-muted/30 animate-pulse rounded" />
          <div className="h-4 w-64 bg-muted/20 animate-pulse rounded mt-2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => <SkeletonChart key={i} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col p-4 md:p-6 gap-4 overflow-y-auto custom-scrollbar">
      {/* ===== Section Header ===== */}
      <div className="section-header-gradient rounded-xl px-4 py-3 -mx-4 -mt-2 md:-mx-6 md:-mt-4 mb-2">
        <h2 className="text-lg font-bold tracking-tight flex items-center gap-2 bg-gradient-to-r from-emerald-700 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
          <Gauge className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          Rate Analytics
        </h2>
        <p className="text-sm text-muted-foreground">Evaluation throughput and request rate monitoring</p>
      </div>

      {/* ===== Key Metrics Row ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="border-0 shadow-sm glass-card glow-hover group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-600 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity" />
            <CardContent className="p-4 md:p-6 relative">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Evaluations</p>
                  <AnimatedNumber value={totalEvaluations} />
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform duration-300">
                    {statsData && statsData.totalTraces > 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                  </div>
                  <MiniSparkline data={sparklineData.total} color="#10b981" />
                </div>
              </div>
              {statsData && statsData.totalTraces > 0 && (
                <div className="mt-2 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                  <ArrowUpRight className="h-3 w-3" /> {((totalEvaluations / Math.max(statsData.totalTraces, 1)) * 100).toFixed(0)}% of total
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-0 shadow-sm glass-card glow-hover group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-teal-500 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity" />
            <CardContent className="p-4 md:p-6 relative">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Avg Throughput</p>
                  <AnimatedNumber value={avgThroughput} suffix="/hr" decimals={1} />
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-600/10 text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform duration-300">
                    <Activity className="h-5 w-5" />
                  </div>
                  <MiniSparkline data={sparklineData.throughput} color="#06b6d4" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="border-0 shadow-sm glass-card glow-hover group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-orange-500 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity" />
            <CardContent className="p-4 md:p-6 relative">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Peak Rate</p>
                  <AnimatedNumber value={peakRate} suffix="/hr" />
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-600/10 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform duration-300">
                    <Zap className="h-5 w-5" />
                  </div>
                  <MiniSparkline data={sparklineData.peak} color="#f59e0b" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-0 shadow-sm glass-card glow-hover group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-rose-500 to-red-500 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity" />
            <CardContent className="p-4 md:p-6 relative">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">P99 Latency</p>
                  <AnimatedNumber value={p99Latency} suffix="ms" decimals={1} />
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-600/10 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform duration-300">
                    <Clock className="h-5 w-5" />
                  </div>
                  <MiniSparkline data={sparklineData.latency} color="#f43f5e" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ===== Evaluation Rate Over Time ===== */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <Card className="border-0 shadow-sm glass-card glow-hover">
          <CardHeader className="pb-2 pt-4 px-4 md:px-6">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-semibold">Evaluation Rate Over Time</span>
              <Badge variant="outline" className="text-[10px] h-5 ml-auto">
                {timeRange === '24h' ? 'Hourly' : timeRange === '7d' ? 'Daily' : timeRange === '30d' ? 'Daily' : 'Weekly'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-4 md:px-6 pb-4 md:pb-6">
            {rateChartData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <BarChart3 className="h-8 w-8 subtle-pulse" />
                <span className="text-sm">No evaluation data available</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={rateChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradAllow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradBlock" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradReview" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    stroke="currentColor"
                    strokeOpacity={0.2}
                    interval={Math.max(Math.floor(rateChartData.length / 12), 0)}
                  />
                  <YAxis tick={{ fontSize: 10 }} stroke="currentColor" strokeOpacity={0.2} />
                  <RechartsTooltip content={<RateChartTooltip />} />
                  <Area type="monotone" dataKey="ALLOW" stroke="#10b981" fill="url(#gradAllow)" strokeWidth={2} name="ALLOW" />
                  <Area type="monotone" dataKey="BLOCK" stroke="#ef4444" fill="url(#gradBlock)" strokeWidth={2} name="BLOCK" />
                  <Area type="monotone" dataKey="REQUIRE_APPROVAL" stroke="#f59e0b" fill="url(#gradReview)" strokeWidth={2} name="REQUIRE_APPROVAL" />
                </AreaChart>
              </ResponsiveContainer>
            )}
            {rateChartData.length > 0 && (
              <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> ALLOW</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> BLOCK</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> REQUIRE_APPROVAL</span>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ===== Heatmap + Latency Distribution ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Agent Throughput Heatmap */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="border-0 shadow-sm glass-card glow-hover">
            <CardHeader className="pb-2 pt-4 px-4 md:px-6">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-semibold">Agent Throughput Heatmap</span>
              </div>
            </CardHeader>
            <CardContent className="px-4 md:px-6 pb-4 md:pb-6">
              <div className="overflow-x-auto custom-scrollbar">
                <svg
                  width={Math.max(24 * 28 + 80, 500)}
                  height={AGENT_ROLES.length * 32 + 50}
                  className="min-w-[500px]"
                >
                  {/* Hour labels */}
                  {Array.from({ length: 24 }, (_, h) => (
                    <text
                      key={h}
                      x={80 + h * 28 + 14}
                      y={14}
                      textAnchor="middle"
                      className="fill-muted-foreground text-[9px]"
                    >
                      {h.toString().padStart(2, '0')}
                    </text>
                  ))}

                  {/* Agent rows */}
                  {AGENT_ROLES.map((role, ri) => {
                    const meta = agentMeta[role] ?? defaultMeta
                    return (
                      <g key={role}>
                        {/* Role label */}
                        <text
                          x={10}
                          y={ri * 32 + 36}
                          className="fill-muted-foreground text-[10px] font-medium"
                        >
                          {role.replace('Agent', '')}
                        </text>

                        {/* Cells */}
                        {Array.from({ length: 24 }, (_, h) => {
                          const count = heatmapData[role]?.[h] ?? 0
                          const intensity = heatmapMax > 0 ? count / heatmapMax : 0
                          // Emerald gradient from light to dark
                          const opacity = 0.08 + intensity * 0.85
                          const cellColor = count === 0
                            ? 'rgba(16, 185, 129, 0.04)'
                            : `rgba(16, 185, 129, ${opacity})`

                          return (
                            <rect
                              key={h}
                              x={80 + h * 28}
                              y={ri * 32 + 22}
                              width={26}
                              height={26}
                              rx={4}
                              fill={cellColor}
                              stroke="currentColor"
                              strokeOpacity={0.04}
                              strokeWidth={1}
                              className="cursor-pointer transition-all duration-150 hover:stroke-emerald-500 hover:stroke-opacity-40"
                              onMouseEnter={(e) => handleHeatmapMouseEnter(role, h, count, e as unknown as React.MouseEvent)}
                              onMouseMove={(e) => handleHeatmapMouseEnter(role, h, count, e as unknown as React.MouseEvent)}
                              onMouseLeave={handleHeatmapMouseLeave}
                            >
                              <title>{role} at {h}:00 — {count} evaluations</title>
                            </rect>
                          )
                        })}
                      </g>
                    )
                  })}
                </svg>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground">
                <span>Low</span>
                <div className="flex items-center gap-0.5">
                  {[0.04, 0.15, 0.3, 0.5, 0.7, 0.93].map((opacity, i) => (
                    <span
                      key={i}
                      className="h-3 w-6 rounded-sm"
                      style={{ backgroundColor: `rgba(16, 185, 129, ${opacity})` }}
                    />
                  ))}
                </div>
                <span>High</span>
              </div>

              {/* Heatmap Tooltip */}
              <HeatmapTooltip cell={heatmapTooltip.cell} position={heatmapTooltip.position} />
            </CardContent>
          </Card>
        </motion.div>

        {/* Latency Distribution Chart */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card className="border-0 shadow-sm glass-card glow-hover">
            <CardHeader className="pb-2 pt-4 px-4 md:px-6">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-semibold">Latency Distribution</span>
              </div>
            </CardHeader>
            <CardContent className="px-4 md:px-6 pb-4 md:pb-6">
              {traces.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <Clock className="h-8 w-8 subtle-pulse" />
                  <span className="text-sm">No latency data available</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={latencyDistribution} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="currentColor" strokeOpacity={0.2} />
                    <YAxis tick={{ fontSize: 10 }} stroke="currentColor" strokeOpacity={0.2} />
                    <RechartsTooltip content={<LatencyTooltip />} />
                    <Bar dataKey="ALLOW" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} name="ALLOW" />
                    <Bar dataKey="REQUIRE_APPROVAL" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} name="REQUIRE_APPROVAL" />
                    <Bar dataKey="BLOCK" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} name="BLOCK" />
                    {/* Percentile reference lines — map to bucket index */}
                    <ReferenceLine
                      y={Math.ceil(traces.length * 0.5)}
                      stroke="#10b981"
                      strokeDasharray="4 4"
                      strokeOpacity={0.6}
                      label={{ value: 'P50', position: 'right', fill: '#10b981', fontSize: 9 }}
                    />
                    <ReferenceLine
                      y={Math.ceil(traces.length * 0.05)}
                      stroke="#f59e0b"
                      strokeDasharray="4 4"
                      strokeOpacity={0.6}
                      label={{ value: 'P95', position: 'right', fill: '#f59e0b', fontSize: 9 }}
                    />
                    <ReferenceLine
                      y={Math.ceil(traces.length * 0.01)}
                      stroke="#ef4444"
                      strokeDasharray="4 4"
                      strokeOpacity={0.6}
                      label={{ value: 'P99', position: 'right', fill: '#ef4444', fontSize: 9 }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
              {traces.length > 0 && (
                <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground flex-wrap">
                  <span>P50: <span className="font-mono tabular-nums text-foreground">{latencyPercentiles.p50}ms</span></span>
                  <span>P95: <span className="font-mono tabular-nums text-foreground">{latencyPercentiles.p95}ms</span></span>
                  <span>P99: <span className="font-mono tabular-nums text-foreground">{latencyPercentiles.p99}ms</span></span>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ===== Per-Agent Rate Cards ===== */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Gauge className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-sm font-semibold">Per-Agent Throughput</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {agentRateData.map((agent, i) => {
            const meta = agentMeta[agent.role] ?? defaultMeta
            return (
              <motion.div
                key={agent.role}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.05 }}
              >
                <Card className="border-0 shadow-sm glass-card glow-hover group">
                  <CardContent className="p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`flex items-center justify-center h-9 w-9 rounded-lg ${meta.iconBg} group-hover:scale-110 transition-transform duration-300`}>
                          <span className={meta.iconColor}>{meta.icon}</span>
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{agent.role}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {agent.totalTraces} traces
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Rate */}
                    <div className="flex items-baseline justify-between">
                      <div>
                        <span className="font-mono tabular-nums text-xl font-bold">{agent.rate}</span>
                        <span className="text-xs text-muted-foreground ml-1">evals/hr</span>
                      </div>
                      <div className={`flex items-center gap-0.5 text-xs font-medium ${
                        agent.trendUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {agent.trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {agent.trendPercent}%
                      </div>
                    </div>

                    {/* Mini Bar Chart */}
                    {agent.totalTraces > 0 && (
                      <div className="space-y-1">
                        <div className="flex h-3 rounded-full overflow-hidden bg-muted/50">
                          <div
                            className="bg-emerald-500 transition-all"
                            style={{ width: `${(agent.allowCount / agent.totalTraces) * 100}%` }}
                          />
                          <div
                            className="bg-amber-500 transition-all"
                            style={{ width: `${(agent.reviewCount / agent.totalTraces) * 100}%` }}
                          />
                          <div
                            className="bg-red-500 transition-all"
                            style={{ width: `${(agent.blockCount / agent.totalTraces) * 100}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                          <span className="flex items-center gap-0.5"><span className="h-1 w-1 rounded-full bg-emerald-500" /> {agent.allowCount}</span>
                          <span className="flex items-center gap-0.5"><span className="h-1 w-1 rounded-full bg-amber-500" /> {agent.reviewCount}</span>
                          <span className="flex items-center gap-0.5"><span className="h-1 w-1 rounded-full bg-red-500" /> {agent.blockCount}</span>
                        </div>
                      </div>
                    )}

                    {/* Average Latency */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Avg Latency</span>
                      <span className="font-mono tabular-nums text-foreground">{agent.avgLatency}ms</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* ===== Rate Limiting Violations Panel ===== */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <Card className="border-0 shadow-sm glass-card glow-hover">
          <CardHeader className="pb-2 pt-4 px-4 md:px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="text-sm font-semibold">Rate Limiting Violations</span>
                <Badge variant="outline" className="text-[10px] h-5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                  {slowTraces.length} slow
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Threshold:</span>
                <Input
                  type="number"
                  value={latencyThreshold}
                  onChange={(e) => setLatencyThreshold(Number(e.target.value) || 0)}
                  className="h-7 w-20 text-xs font-mono tabular-nums"
                  min={0}
                />
                <span className="text-xs text-muted-foreground">ms</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 md:px-6 pb-4 md:pb-6">
            {slowTraces.length === 0 ? (
              <div className="h-32 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <Zap className="h-8 w-8 subtle-pulse text-emerald-500" />
                <span className="text-sm">No slow evaluations detected</span>
                <span className="text-xs">All traces are within the {latencyThreshold}ms threshold</span>
              </div>
            ) : (
              <ScrollArea className="max-h-96">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Time</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Agent</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Tool</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">Latency</th>
                      <th className="text-center py-2 px-2 font-medium text-muted-foreground">Decision</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {slowTraces.map((t) => (
                        <motion.tr
                          key={t.traceId}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 8 }}
                          transition={{ duration: 0.15 }}
                          className="border-b border-border/50 hover:bg-muted/30 transition-colors duration-150"
                        >
                          <td className="py-2 px-2 text-muted-foreground font-mono tabular-nums">
                            {formatDistanceToNow(new Date(t.timestamp), { addSuffix: true })}
                          </td>
                          <td className="py-2 px-2">
                            <span className={`inline-flex items-center gap-1 ${(agentMeta[t.agentRole] ?? defaultMeta).iconColor}`}>
                              {(agentMeta[t.agentRole] ?? defaultMeta).icon}
                              {t.agentRole.replace('Agent', '')}
                            </span>
                          </td>
                          <td className="py-2 px-2 font-mono text-[11px]">{t.toolName}</td>
                          <td className="py-2 px-2 text-right">
                            <span className="font-mono tabular-nums text-red-600 dark:text-red-400 font-medium">{t.latency}ms</span>
                          </td>
                          <td className="py-2 px-2 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <Badge variant="outline" className={`text-[9px] h-4 px-1.5 ${decisionBadgeClasses[t.evaluationResult] ?? ''}`}>
                                {t.evaluationResult === 'REQUIRE_APPROVAL' ? 'REVIEW' : t.evaluationResult}
                              </Badge>
                              <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
                                SLOW
                              </Badge>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
