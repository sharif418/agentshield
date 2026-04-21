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
  Server,
  Globe,
  Bell,
  CircleDot,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
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

interface ServiceStatus {
  name: string
  status: 'Running' | 'Stopped' | 'Degraded'
  uptime: string
  lastCheck: string
  icon: React.ReactNode
}

interface AlertEntry {
  id: string
  severity: 'critical' | 'warning' | 'info'
  message: string
  timestamp: string
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

// Simulated service status data
const SERVICE_STATUSES: ServiceStatus[] = [
  { name: 'Policy Engine', status: 'Running', uptime: '99.98%', lastCheck: '12s ago', icon: <Shield className="h-4 w-4" /> },
  { name: 'WebSocket Server', status: 'Running', uptime: '99.95%', lastCheck: '8s ago', icon: <Wifi className="h-4 w-4" /> },
  { name: 'Database', status: 'Running', uptime: '99.99%', lastCheck: '5s ago', icon: <Database className="h-4 w-4" /> },
  { name: 'API Gateway', status: 'Running', uptime: '99.97%', lastCheck: '3s ago', icon: <Globe className="h-4 w-4" /> },
  { name: 'Notification Service', status: 'Degraded', uptime: '97.2%', lastCheck: '15s ago', icon: <Bell className="h-4 w-4" /> },
]

// Simulated alert history
const ALERT_HISTORY: AlertEntry[] = [
  { id: 'alert-1', severity: 'warning', message: 'High latency detected on Policy Engine (>50ms)', timestamp: '2m ago', icon: <Clock className="h-3.5 w-3.5" /> },
  { id: 'alert-2', severity: 'info', message: 'WebSocket reconnection completed successfully', timestamp: '5m ago', icon: <Wifi className="h-3.5 w-3.5" /> },
  { id: 'alert-3', severity: 'warning', message: 'Database query slow on audit_logs table', timestamp: '12m ago', icon: <Database className="h-3.5 w-3.5" /> },
  { id: 'alert-4', severity: 'critical', message: 'Notification Service response time exceeds threshold', timestamp: '18m ago', icon: <Bell className="h-3.5 w-3.5" /> },
  { id: 'alert-5', severity: 'info', message: 'Policy cache refreshed with 17 active policies', timestamp: '25m ago', icon: <RefreshCw className="h-3.5 w-3.5" /> },
  { id: 'alert-6', severity: 'warning', message: 'Memory usage approaching 80% on API Gateway', timestamp: '32m ago', icon: <Cpu className="h-3.5 w-3.5" /> },
  { id: 'alert-7', severity: 'info', message: 'Scheduled backup completed for policy database', timestamp: '1h ago', icon: <HardDrive className="h-3.5 w-3.5" /> },
]

function getServiceStatusConfig(status: string) {
  switch (status) {
    case 'Running': return { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-500' }
    case 'Degraded': return { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30', dot: 'bg-amber-500' }
    case 'Stopped': return { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/30', dot: 'bg-red-500' }
    default: return { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border', dot: 'bg-muted-foreground' }
  }
}

function getAlertSeverityConfig(severity: string) {
  switch (severity) {
    case 'critical': return { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/30' }
    case 'warning': return { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30' }
    case 'info': return { bg: 'bg-cyan-500/10', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-500/30' }
    default: return { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' }
  }
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
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 relative">
      {/* Dot grid background */}
      <div className="absolute inset-0 dot-grid opacity-30 pointer-events-none rounded-xl" />

      {/* Section Header */}
      <div className="section-header-gradient section-header-accent rounded-xl px-4 py-3 -mx-4 -mt-2 md:-mx-6 md:-mt-4 mb-2 relative overflow-hidden">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2 gradient-text-shimmer">
              <Heart className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              System Health
            </h2>
            <p className="text-sm text-muted-foreground">
              Monitor system performance and health metrics in real-time
            </p>
          </div>
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
      </div>

      {/* Status Summary Bar */}
      <Card className="glass-card glow-hover">
        <CardContent className="p-4 md:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Health Overview
            </h3>
            <span className="text-[10px] text-muted-foreground">Auto-refreshes every 15s</span>
          </div>

          {/* Status Bar */}
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

          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-md bg-muted/50 p-2 text-center">
              <Server className="h-4 w-4 mx-auto text-emerald-500 mb-1" />
              <div className="text-sm font-bold tabular-nums">{SERVICE_STATUSES.filter(s => s.status === 'Running').length}/{SERVICE_STATUSES.length}</div>
              <div className="text-[9px] text-muted-foreground">Services Up</div>
            </div>
            <div className="rounded-md bg-muted/50 p-2 text-center">
              <Clock className="h-4 w-4 mx-auto text-emerald-500 mb-1" />
              <div className="text-sm font-bold tabular-nums font-mono">99.97%</div>
              <div className="text-[9px] text-muted-foreground">Uptime</div>
            </div>
            <div className="rounded-md bg-muted/50 p-2 text-center">
              <AlertTriangle className="h-4 w-4 mx-auto text-amber-500 mb-1" />
              <div className="text-sm font-bold tabular-nums">{ALERT_HISTORY.filter(a => a.severity === 'critical' || a.severity === 'warning').length}</div>
              <div className="text-[9px] text-muted-foreground">Active Alerts</div>
            </div>
            <div className="rounded-md bg-muted/50 p-2 text-center">
              <Zap className="h-4 w-4 mx-auto text-emerald-500 mb-1" />
              <div className="text-sm font-bold tabular-nums font-mono">{statsData?.averageLatency?.toFixed(1) ?? '0'}ms</div>
              <div className="text-[9px] text-muted-foreground">Avg Latency</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <Card className="glass-card glow-hover">
        <CardContent className="p-4 md:p-6">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
            <Cpu className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Performance Metrics
          </h3>
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
        </CardContent>
      </Card>

      {/* Expanded Diagnostics */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <Card className="glass-card glow-hover">
              <CardContent className="p-4 md:p-6 space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Diagnostics
                </h4>
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
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Service Status Table */}
      <Card className="glass-card glow-hover">
        <CardContent className="p-4 md:p-6">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
            <Server className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Service Status
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">Service</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">Status</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">Uptime</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">Last Check</th>
                </tr>
              </thead>
              <tbody>
                {SERVICE_STATUSES.map((service, i) => {
                  const config = getServiceStatusConfig(service.status)
                  return (
                    <motion.tr
                      key={service.name}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="border-b border-border/30 hover:bg-muted/20 transition-colors duration-150"
                    >
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-600 dark:text-emerald-400">{service.icon}</span>
                          <span className="font-medium">{service.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2">
                        <Badge variant="outline" className={`text-[10px] ${config.bg} ${config.text} ${config.border}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${config.dot} mr-1`} />
                          {service.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-2 font-mono tabular-nums text-muted-foreground">{service.uptime}</td>
                      <td className="py-2.5 px-2 text-muted-foreground">{service.lastCheck}</td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Alert History */}
      <Card className="glass-card glow-hover">
        <CardContent className="p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Bell className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Alert History
              <Badge variant="outline" className="font-mono tabular-nums text-[10px]">
                {ALERT_HISTORY.length}
              </Badge>
            </h3>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[9px] bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
                {ALERT_HISTORY.filter(a => a.severity === 'critical').length} critical
              </Badge>
              <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                {ALERT_HISTORY.filter(a => a.severity === 'warning').length} warning
              </Badge>
            </div>
          </div>
          <div className="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar">
            <AnimatePresence>
              {ALERT_HISTORY.map((alert, i) => {
                const config = getAlertSeverityConfig(alert.severity)
                return (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors duration-200"
                  >
                    {/* Severity indicator */}
                    <Badge variant="outline" className={`shrink-0 text-[10px] ${config.bg} ${config.text} ${config.border}`}>
                      {alert.severity === 'critical' && <XCircle className="h-3 w-3 mr-1" />}
                      {alert.severity === 'warning' && <AlertTriangle className="h-3 w-3 mr-1" />}
                      {alert.severity === 'info' && <CircleDot className="h-3 w-3 mr-1" />}
                      {alert.severity}
                    </Badge>

                    {/* Icon */}
                    <span className="text-muted-foreground shrink-0">{alert.icon}</span>

                    {/* Message */}
                    <span className="flex-1 text-xs truncate">{alert.message}</span>

                    {/* Timestamp */}
                    <span className="text-[10px] text-muted-foreground font-mono tabular-nums shrink-0">{alert.timestamp}</span>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>

      {/* Toggle expand */}
      <Button
        variant="ghost"
        size="sm"
        className="w-full h-7 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? 'Hide Diagnostics' : 'Show Diagnostics'}
      </Button>
    </div>
  )
}
