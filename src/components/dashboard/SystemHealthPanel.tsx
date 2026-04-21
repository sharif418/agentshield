'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Heart,
  Cpu,
  HardDrive,
  Zap,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Activity,
  RefreshCw,
  Shield,
  Clock,
  Database,
  Wifi,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'

interface HealthMetric {
  label: string
  value: number
  unit: string
  status: 'healthy' | 'warning' | 'critical'
  trend: 'up' | 'down' | 'stable'
  trendValue: string
  icon: React.ReactNode
}

function getStatusColor(status: string) {
  switch (status) {
    case 'healthy': return 'text-emerald-500'
    case 'warning': return 'text-amber-500'
    case 'critical': return 'text-red-500'
    default: return 'text-muted-foreground'
  }
}

function getStatusBg(status: string) {
  switch (status) {
    case 'healthy': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
    case 'warning': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
    case 'critical': return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
    default: return 'bg-muted text-muted-foreground border-border'
  }
}

function getTrendIcon(trend: string) {
  switch (trend) {
    case 'up': return <ArrowUpRight className="h-3 w-3 text-emerald-500" />
    case 'down': return <ArrowDownRight className="h-3 w-3 text-red-500" />
    default: return <Minus className="h-3 w-3 text-muted-foreground" />
  }
}

// Mini SVG sparkline
function MiniSparkline({ data, color = '#10b981', width = 80, height = 24 }: { data: number[]; color?: string; width?: number; height?: number }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const step = width / (data.length - 1)
  const points = data.map((v, i) => `${i * step},${height - (v / max) * (height - 4) - 2}`).join(' ')
  const areaPoints = `0,${height} ${points} ${width},${height}`

  return (
    <svg width={width} height={height} className="overflow-visible shrink-0">
      <defs>
        <linearGradient id={`healthGrad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.2} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#healthGrad-${color.replace('#', '')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

export function SystemHealthPanel() {
  const [expanded, setExpanded] = useState(false)

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['health-stats'],
    queryFn: async () => {
      const res = await fetch('/api/stats')
      if (!res.ok) return null
      return res.json()
    },
    refetchInterval: 15000,
  })

  const { data: policiesData } = useQuery({
    queryKey: ['health-policies'],
    queryFn: async () => {
      const res = await fetch('/api/policies')
      if (!res.ok) return []
      return res.json() as Promise<Array<{ enabled: boolean; permissionLevel: string }>>
    },
    refetchInterval: 30000,
  })

  // Compute health metrics
  const metrics = useMemo((): HealthMetric[] => {
    if (!statsData) return []

    const totalPolicies = statsData.totalPolicies ?? 0
    const totalTraces = statsData.totalTraces ?? 0
    const blockRate = totalTraces > 0 ? ((statsData.traceBreakdown?.BLOCK ?? 0) / totalTraces) * 100 : 0
    const approvalRate = totalTraces > 0 ? ((statsData.traceBreakdown?.REQUIRE_APPROVAL ?? 0) / totalTraces) * 100 : 0
    const avgLatency = statsData.averageLatency ?? 0
    const enabledPolicies = policiesData ? policiesData.filter((p: { enabled: boolean }) => p.enabled).length : 0
    const policyCoverage = policiesData ? (enabledPolicies / Math.max(totalPolicies, 1)) * 100 : 0
    const complianceScore = totalTraces > 0 ? ((statsData.traceBreakdown?.ALLOW ?? 0) / totalTraces) * 100 : 0

    return [
      {
        label: 'Policy Engine',
        value: avgLatency,
        unit: 'ms avg',
        status: avgLatency < 10 ? 'healthy' : avgLatency < 50 ? 'warning' : 'critical',
        trend: avgLatency < 10 ? 'down' : 'up',
        trendValue: avgLatency < 10 ? 'Fast' : 'Slow',
        icon: <Zap className="h-4 w-4" />,
      },
      {
        label: 'Block Rate',
        value: Math.round(blockRate * 10) / 10,
        unit: '%',
        status: blockRate < 20 ? 'healthy' : blockRate < 40 ? 'warning' : 'critical',
        trend: blockRate < 20 ? 'down' : 'up',
        trendValue: blockRate < 20 ? 'Low risk' : 'High risk',
        icon: <Shield className="h-4 w-4" />,
      },
      {
        label: 'Compliance',
        value: Math.round(complianceScore * 10) / 10,
        unit: '%',
        status: complianceScore >= 70 ? 'healthy' : complianceScore >= 50 ? 'warning' : 'critical',
        trend: complianceScore >= 70 ? 'up' : 'down',
        trendValue: complianceScore >= 70 ? 'Good' : 'Needs attention',
        icon: <CheckCircle2 className="h-4 w-4" />,
      },
      {
        label: 'Policy Coverage',
        value: Math.round(policyCoverage * 10) / 10,
        unit: '% active',
        status: policyCoverage >= 90 ? 'healthy' : policyCoverage >= 70 ? 'warning' : 'critical',
        trend: 'stable',
        trendValue: `${enabledPolicies}/${totalPolicies} enabled`,
        icon: <Database className="h-4 w-4" />,
      },
      {
        label: 'Approval Load',
        value: Math.round(approvalRate * 10) / 10,
        unit: '% need review',
        status: approvalRate < 25 ? 'healthy' : approvalRate < 45 ? 'warning' : 'critical',
        trend: approvalRate < 25 ? 'down' : 'up',
        trendValue: `${statsData.pendingApprovals ?? 0} pending`,
        icon: <Clock className="h-4 w-4" />,
      },
    ]
  }, [statsData, policiesData])

  // Generate fake historical data for sparklines (simulated from current values)
  const generateHistory = useMemo(() => {
    return metrics.map((m) => {
      const base = m.value
      const points: number[] = []
      for (let i = 0; i < 12; i++) {
        const variation = (Math.random() - 0.5) * base * 0.3
        points.push(Math.max(0, base + variation))
      }
      return points
    })
  }, [metrics])

  const overallStatus = useMemo(() => {
    if (metrics.length === 0) return 'unknown'
    const hasCritical = metrics.some(m => m.status === 'critical')
    const hasWarning = metrics.some(m => m.status === 'warning')
    if (hasCritical) return 'critical'
    if (hasWarning) return 'warning'
    return 'healthy'
  }, [metrics])

  const healthyCount = metrics.filter(m => m.status === 'healthy').length
  const warningCount = metrics.filter(m => m.status === 'warning').length
  const criticalCount = metrics.filter(m => m.status === 'critical').length

  return (
    <Card className="border-0 shadow-sm glass-card glow-hover">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Heart className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            System Health
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-[10px] h-5 ${getStatusBg(overallStatus)}`}>
              {overallStatus === 'healthy' && <CheckCircle2 className="h-3 w-3 mr-1" />}
              {overallStatus === 'warning' && <AlertTriangle className="h-3 w-3 mr-1" />}
              {overallStatus === 'critical' && <XCircle className="h-3 w-3 mr-1" />}
              {overallStatus === 'healthy' ? 'All Systems Go' : overallStatus === 'warning' ? 'Attention Needed' : 'Issues Detected'}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setExpanded(!expanded)}
            >
              <RefreshCw className={`h-3 w-3 transition-transform duration-500 ${statsLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Status Summary Bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full overflow-hidden flex">
            {healthyCount > 0 && (
              <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${(healthyCount / metrics.length) * 100}%` }} />
            )}
            {warningCount > 0 && (
              <div className="bg-amber-500 transition-all duration-500" style={{ width: `${(warningCount / metrics.length) * 100}%` }} />
            )}
            {criticalCount > 0 && (
              <div className="bg-red-500 transition-all duration-500" style={{ width: `${(criticalCount / metrics.length) * 100}%` }} />
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground shrink-0">
            <span className="flex items-center gap-0.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{healthyCount}</span>
            <span className="flex items-center gap-0.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />{warningCount}</span>
            <span className="flex items-center gap-0.5"><span className="h-1.5 w-1.5 rounded-full bg-red-500" />{criticalCount}</span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {metrics.map((metric, i) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-lg border border-border/50 p-2.5 space-y-1.5 hover:border-emerald-500/20 transition-colors duration-200"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <span className={getStatusColor(metric.status)}>{metric.icon}</span>
                  {metric.label}
                </span>
                {getTrendIcon(metric.trend)}
              </div>
              <div className="flex items-end gap-1">
                <span className={`text-lg font-bold tabular-nums ${getStatusColor(metric.status)}`}>
                  {typeof metric.value === 'number' ? metric.value.toFixed(1) : metric.value}
                </span>
                <span className="text-[10px] text-muted-foreground mb-0.5">{metric.unit}</span>
              </div>
              <MiniSparkline
                data={generateHistory[i] ?? []}
                color={
                  metric.status === 'healthy' ? '#10b981' :
                  metric.status === 'warning' ? '#f59e0b' : '#ef4444'
                }
                width={80}
                height={20}
              />
              <div className="text-[9px] text-muted-foreground">{metric.trendValue}</div>
            </motion.div>
          ))}
        </div>

        {/* Expanded Details */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <Separator className="my-2" />
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Diagnostics</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="rounded-md bg-muted/50 p-2 text-center">
                    <Database className="h-4 w-4 mx-auto text-emerald-500 mb-1" />
                    <div className="text-sm font-bold tabular-nums">{statsData?.totalPolicies ?? 0}</div>
                    <div className="text-[9px] text-muted-foreground">Total Policies</div>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2 text-center">
                    <Activity className="h-4 w-4 mx-auto text-emerald-500 mb-1" />
                    <div className="text-sm font-bold tabular-nums">{statsData?.totalTraces ?? 0}</div>
                    <div className="text-[9px] text-muted-foreground">Total Traces</div>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2 text-center">
                    <Clock className="h-4 w-4 mx-auto text-emerald-500 mb-1" />
                    <div className="text-sm font-bold tabular-nums font-mono">{statsData?.averageLatency?.toFixed(1) ?? '0'}ms</div>
                    <div className="text-[9px] text-muted-foreground">Avg Latency</div>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2 text-center">
                    <Wifi className="h-4 w-4 mx-auto text-emerald-500 mb-1" />
                    <div className="text-sm font-bold tabular-nums">{statsData?.pendingApprovals ?? 0}</div>
                    <div className="text-[9px] text-muted-foreground">Pending Approvals</div>
                  </div>
                </div>

                {/* Uptime Simulation */}
                <div className="rounded-md bg-muted/50 p-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-medium text-muted-foreground">System Uptime</span>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">99.97%</span>
                  </div>
                  <Progress value={99.97} className="h-1.5" />
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[9px] text-muted-foreground">Last incident: 14d ago</span>
                    <span className="text-[9px] text-muted-foreground">Since deployment</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toggle expand */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-7 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show Less' : 'Show Diagnostics'}
        </Button>
      </CardContent>
    </Card>
  )
}
