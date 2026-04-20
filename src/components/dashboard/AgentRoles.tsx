'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot,
  Database,
  Code2,
  DollarSign,
  Headphones,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ArrowLeftRight,
  BarChart3,
  Shield,
  Activity,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDistanceToNow } from 'date-fns'

interface Policy {
  policyId: string
  name: string
  agentRole: string
  resource: string
  action: string
  permissionLevel: string
  enabled: boolean
  priority: number
}

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

interface AgentStats {
  role: string
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  isActive: boolean
  policies: Policy[]
  traces: Trace[]
  totalTraces: number
  allowCount: number
  blockCount: number
  reviewCount: number
  riskScore: number
  complianceStatus: 'compliant' | 'warning' | 'critical'
  complianceLabel: string
  complianceIcon: React.ReactNode
  lastActivity: string | null
  topTools: { name: string; count: number }[]
}

const agentMeta: Record<string, { icon: React.ReactNode; iconBg: string; iconColor: string }> = {
  DataAgent: {
    icon: <Database className="h-5 w-5" />,
    iconBg: 'bg-cyan-500/10',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
  },
  CodeAgent: {
    icon: <Code2 className="h-5 w-5" />,
    iconBg: 'bg-violet-500/10',
    iconColor: 'text-violet-600 dark:text-violet-400',
  },
  FinanceAgent: {
    icon: <DollarSign className="h-5 w-5" />,
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  SupportAgent: {
    icon: <Headphones className="h-5 w-5" />,
    iconBg: 'bg-rose-500/10',
    iconColor: 'text-rose-600 dark:text-rose-400',
  },
}

const defaultMeta = { icon: <Bot className="h-5 w-5" />, iconBg: 'bg-gray-500/10', iconColor: 'text-gray-600 dark:text-gray-400' }

const permissionColor: Record<string, string> = {
  ALLOW: 'text-emerald-600 dark:text-emerald-400',
  BLOCK: 'text-red-600 dark:text-red-400',
  REQUIRE_APPROVAL: 'text-amber-600 dark:text-amber-400',
}

const decisionColor: Record<string, string> = {
  ALLOW: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  BLOCK: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  REQUIRE_APPROVAL: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
}

function computeAgentStats(policies: Policy[], traces: Trace[], allRoles: string[]): AgentStats[] {
  const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000

  // Ensure all known roles appear even if they have no data
  const roleSet = new Set([...allRoles, ...policies.map(p => p.agentRole), ...traces.map(t => t.agentRole)])

  return Array.from(roleSet).map(role => {
    const meta = agentMeta[role] ?? defaultMeta
    const rolePolicies = policies.filter(p => p.agentRole === role)
    const roleTraces = traces.filter(t => t.agentRole === role)

    const allowCount = roleTraces.filter(t => t.evaluationResult === 'ALLOW').length
    const blockCount = roleTraces.filter(t => t.evaluationResult === 'BLOCK').length
    const reviewCount = roleTraces.filter(t => t.evaluationResult === 'REQUIRE_APPROVAL').length
    const totalTraces = roleTraces.length

    const riskScore = totalTraces > 0 ? Math.round((blockCount / totalTraces) * 100) : 0

    let complianceStatus: 'compliant' | 'warning' | 'critical'
    let complianceLabel: string
    let complianceIcon: React.ReactNode

    if (riskScore > 50) {
      complianceStatus = 'critical'
      complianceLabel = 'Critical'
      complianceIcon = <XCircle className="h-3.5 w-3.5 text-red-500" />
    } else if (riskScore > 20) {
      complianceStatus = 'warning'
      complianceLabel = 'Warning'
      complianceIcon = <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
    } else {
      complianceStatus = 'compliant'
      complianceLabel = 'Compliant'
      complianceIcon = <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
    }

    const lastActivity = roleTraces.length > 0
      ? roleTraces.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0].timestamp
      : null

    // Top tools
    const toolCounts: Record<string, number> = {}
    for (const t of roleTraces) {
      toolCounts[t.toolName] = (toolCounts[t.toolName] ?? 0) + 1
    }
    const topTools = Object.entries(toolCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))

    // Active if any trace in last 24h
    const isActive = roleTraces.some(t => new Date(t.timestamp).getTime() > twentyFourHoursAgo)

    return {
      role,
      icon: meta.icon,
      iconBg: meta.iconBg,
      iconColor: meta.iconColor,
      isActive,
      policies: rolePolicies,
      traces: roleTraces,
      totalTraces,
      allowCount,
      blockCount,
      reviewCount,
      riskScore,
      complianceStatus,
      complianceLabel,
      complianceIcon,
      lastActivity,
      topTools,
    }
  }).sort((a, b) => b.totalTraces - a.totalTraces)
}

// Risk Distribution Chart (SVG)
function RiskDistributionChart({ agents }: { agents: AgentStats[] }) {
  if (agents.length === 0) return null

  const barWidth = 48
  const gap = 16
  const chartHeight = 160
  const labelHeight = 40
  const maxRisk = 100

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <svg
        width={agents.length * (barWidth + gap) + gap}
        height={chartHeight + labelHeight}
        className="min-w-[280px]"
      >
        {/* Background lines */}
        {[0, 25, 50, 75, 100].map(pct => {
          const y = chartHeight - (pct / maxRisk) * chartHeight
          return (
            <g key={pct}>
              <line x1={0} y1={y} x2={agents.length * (barWidth + gap) + gap} y2={y} stroke="currentColor" strokeOpacity={0.06} strokeDasharray="4 4" />
              <text x={4} y={y - 4} className="fill-muted-foreground text-[9px]">{pct}%</text>
            </g>
          )
        })}

        {/* Threshold lines */}
        {/* 20% warning */}
        <line
          x1={0} y1={chartHeight - (20 / maxRisk) * chartHeight}
          x2={agents.length * (barWidth + gap) + gap} y2={chartHeight - (20 / maxRisk) * chartHeight}
          stroke="#f59e0b" strokeOpacity={0.4} strokeDasharray="6 3"
        />
        {/* 50% critical */}
        <line
          x1={0} y1={chartHeight - (50 / maxRisk) * chartHeight}
          x2={agents.length * (barWidth + gap) + gap} y2={chartHeight - (50 / maxRisk) * chartHeight}
          stroke="#ef4444" strokeOpacity={0.4} strokeDasharray="6 3"
        />

        {/* Bars */}
        {agents.map((agent, i) => {
          const x = gap + i * (barWidth + gap)
          const barHeight = (agent.riskScore / maxRisk) * chartHeight
          const y = chartHeight - barHeight
          const barColor = agent.riskScore > 50 ? '#ef4444' : agent.riskScore > 20 ? '#f59e0b' : '#10b981'

          return (
            <g key={agent.role}>
              <rect x={x} y={y} width={barWidth} height={barHeight} rx={4} fill={barColor} opacity={0.8} />
              <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" className="fill-foreground text-[10px] font-medium">
                {agent.riskScore}%
              </text>
              <text x={x + barWidth / 2} y={chartHeight + 16} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                {agent.role.replace('Agent', '')}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// Agent Comparison Table
function AgentComparison({ agents }: { agents: AgentStats[] }) {
  if (agents.length === 0) return null

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Metric</th>
            {agents.map(a => (
              <th key={a.role} className="text-center py-2 px-3 font-medium">
                <span className={a.iconColor}>{a.role}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[
            { label: 'Status', render: (a: AgentStats) => (
              <Badge variant="outline" className={a.isActive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-gray-500/10 text-gray-500 border-gray-500/20'}>
                {a.isActive ? 'Active' : 'Inactive'}
              </Badge>
            )},
            { label: 'Policies', render: (a: AgentStats) => a.policies.length },
            { label: 'Total Traces', render: (a: AgentStats) => a.totalTraces },
            { label: 'ALLOW', render: (a: AgentStats) => <span className="text-emerald-600 dark:text-emerald-400">{a.allowCount}</span> },
            { label: 'BLOCK', render: (a: AgentStats) => <span className="text-red-600 dark:text-red-400">{a.blockCount}</span> },
            { label: 'REQUIRE_APPROVAL', render: (a: AgentStats) => <span className="text-amber-600 dark:text-amber-400">{a.reviewCount}</span> },
            { label: 'Risk Score', render: (a: AgentStats) => (
              <span className={a.riskScore > 50 ? 'text-red-500 font-semibold' : a.riskScore > 20 ? 'text-amber-500 font-semibold' : 'text-emerald-500'}>
                {a.riskScore}%
              </span>
            )},
            { label: 'Compliance', render: (a: AgentStats) => (
              <span className="flex items-center justify-center gap-1">
                {a.complianceIcon} {a.complianceLabel}
              </span>
            )},
          ].map(row => (
            <tr key={row.label} className="border-b border-border/50 hover:bg-muted/30">
              <td className="py-2 px-3 text-muted-foreground font-medium">{row.label}</td>
              {agents.map(a => (
                <td key={a.role} className="py-2 px-3 text-center">{row.render(a)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function AgentRoles() {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null)
  const [compareOpen, setCompareOpen] = useState(false)
  const [detailAgent, setDetailAgent] = useState<AgentStats | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const { data: policiesData } = useQuery({
    queryKey: ['agents-policies'],
    queryFn: async () => {
      const res = await fetch('/api/policies')
      if (!res.ok) return []
      return res.json() as Promise<Policy[]>
    },
  })

  const { data: tracesData } = useQuery({
    queryKey: ['agents-traces'],
    queryFn: async () => {
      const res = await fetch('/api/traces?limit=200')
      if (!res.ok) return { traces: [] as Trace[], total: 0 }
      return res.json() as Promise<{ traces: Trace[]; total: number }>
    },
  })

  const agents = useMemo(() => {
    if (!policiesData || !tracesData) return []
    const allRoles = ['DataAgent', 'CodeAgent', 'FinanceAgent', 'SupportAgent']
    return computeAgentStats(policiesData, tracesData.traces, allRoles)
  }, [policiesData, tracesData])

  const handleCardClick = (agent: AgentStats) => {
    setExpandedAgent(expandedAgent === agent.role ? null : agent.role)
  }

  const handleDetailOpen = (agent: AgentStats) => {
    setDetailAgent(agent)
    setDetailOpen(true)
  }

  return (
    <div className="h-full flex flex-col p-4 md:p-6 gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-emerald-600/10">
            <Bot className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Agent Roles</h2>
            <p className="text-xs text-muted-foreground">Policy coverage and activity stats per agent</p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => setCompareOpen(true)}
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          Compare Agents
        </Button>
      </div>

      {/* Risk Distribution */}
      {agents.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-semibold">Risk Distribution</span>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <RiskDistributionChart agents={agents} />
            <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Compliant (&lt;20%)
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> Warning (20-50%)
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-500" /> Critical (&gt;50%)
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map((agent) => (
          <motion.div
            key={agent.role}
            layout
            className="md:col-span-1"
          >
            <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleCardClick(agent)}>
              <CardContent className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center h-10 w-10 rounded-lg ${agent.iconBg}`}>
                      <span className={agent.iconColor}>{agent.icon}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{agent.role}</span>
                        <span className={`h-2 w-2 rounded-full ${agent.isActive ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {agent.isActive ? 'Active' : 'Inactive'}
                        {agent.lastActivity && ` · Last ${formatDistanceToNow(new Date(agent.lastActivity), { addSuffix: true })}`}
                      </span>
                    </div>
                  </div>

                  {/* Compliance Badge */}
                  <Badge
                    variant="outline"
                    className={`text-[10px] gap-1 ${
                      agent.complianceStatus === 'compliant'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        : agent.complianceStatus === 'warning'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                        : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                    }`}
                  >
                    {agent.complianceIcon}
                    {agent.complianceLabel}
                  </Badge>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2 rounded-md bg-muted/50">
                    <div className="text-sm font-semibold">{agent.policies.length}</div>
                    <div className="text-[10px] text-muted-foreground">Policies</div>
                  </div>
                  <div className="text-center p-2 rounded-md bg-muted/50">
                    <div className="text-sm font-semibold">{agent.totalTraces}</div>
                    <div className="text-[10px] text-muted-foreground">Traces</div>
                  </div>
                  <div className="text-center p-2 rounded-md bg-muted/50">
                    <div className="text-sm font-semibold">{agent.riskScore}%</div>
                    <div className="text-[10px] text-muted-foreground">Risk</div>
                  </div>
                </div>

                {/* Trace Breakdown Bar */}
                {agent.totalTraces > 0 && (
                  <div className="space-y-1">
                    <div className="flex h-2 rounded-full overflow-hidden bg-muted/50">
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
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {agent.allowCount} Allow</span>
                      <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> {agent.reviewCount} Review</span>
                      <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-500" /> {agent.blockCount} Block</span>
                    </div>
                  </div>
                )}

                {/* Risk Score Progress */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">Risk Score</span>
                    <span className={`font-medium ${
                      agent.riskScore > 50 ? 'text-red-500' : agent.riskScore > 20 ? 'text-amber-500' : 'text-emerald-500'
                    }`}>{agent.riskScore}%</span>
                  </div>
                  <Progress
                    value={agent.riskScore}
                    className="h-1.5"
                  />
                </div>

                {/* Top Tools */}
                {agent.topTools.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-muted-foreground">Tools:</span>
                    {agent.topTools.map(tool => (
                      <Badge key={tool.name} variant="secondary" className="text-[10px] h-5 px-1.5 gap-1">
                        {tool.name}
                        <span className="text-muted-foreground">{tool.count}</span>
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Expand/Collapse indicator */}
                <div className="flex items-center justify-center pt-1">
                  {expandedAgent === agent.role ? (
                    <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </div>

                {/* Expanded Details */}
                <AnimatePresence>
                  {expandedAgent === agent.role && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="space-y-3 pt-3 border-t border-border">
                        {/* Policy List */}
                        {agent.policies.length > 0 && (
                          <div className="space-y-1.5">
                            <h4 className="text-xs font-semibold flex items-center gap-1.5">
                              <Shield className="h-3 w-3" /> Policies
                            </h4>
                            <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                              {agent.policies.map(p => (
                                <div key={p.policyId} className="flex items-center justify-between px-2 py-1 rounded bg-muted/30 text-[11px]">
                                  <span className="truncate max-w-[150px]">{p.name}</span>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[10px] ${permissionColor[p.permissionLevel]}`}>
                                      {p.permissionLevel}
                                    </span>
                                    <span className={`h-1.5 w-1.5 rounded-full ${p.enabled ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Recent Traces */}
                        {agent.traces.length > 0 && (
                          <div className="space-y-1.5">
                            <h4 className="text-xs font-semibold flex items-center gap-1.5">
                              <Activity className="h-3 w-3" /> Recent Traces
                            </h4>
                            <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                              {agent.traces.slice(0, 10).map(t => (
                                <div key={t.traceId} className="flex items-center justify-between px-2 py-1 rounded bg-muted/30 text-[11px]">
                                  <span className="truncate max-w-[120px] font-mono">{t.traceId}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">{t.toolName}</span>
                                    <Badge variant="outline" className={`text-[9px] h-4 px-1 ${decisionColor[t.evaluationResult] ?? ''}`}>
                                      {t.evaluationResult === 'REQUIRE_APPROVAL' ? 'REVIEW' : t.evaluationResult}
                                    </Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* View Full Details Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full h-7 text-xs gap-1.5"
                          onClick={() => handleDetailOpen(agent)}
                        >
                          View Full Details
                          <ChevronDown className="h-3 w-3 rotate-[-90deg]" />
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Compare Sheet */}
      <Sheet open={compareOpen} onOpenChange={setCompareOpen}>
        <SheetContent className="sm:max-w-3xl w-full overflow-y-auto custom-scrollbar">
          <SheetHeader>
            <SheetTitle className="text-sm font-semibold flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Agent Comparison
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <Tabs defaultValue="table">
              <TabsList className="mb-4">
                <TabsTrigger value="table" className="text-xs gap-1.5">
                  <ArrowLeftRight className="h-3 w-3" /> Side by Side
                </TabsTrigger>
                <TabsTrigger value="chart" className="text-xs gap-1.5">
                  <BarChart3 className="h-3 w-3" /> Risk Chart
                </TabsTrigger>
              </TabsList>
              <TabsContent value="table">
                <AgentComparison agents={agents} />
              </TabsContent>
              <TabsContent value="chart">
                <div className="space-y-3">
                  <RiskDistributionChart agents={agents} />
                  <div className="flex items-center gap-4 text-[10px] text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Compliant (&lt;20%)</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Warning (20-50%)</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Critical (&gt;50%)</span>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>

      {/* Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="sm:max-w-lg w-full overflow-y-auto custom-scrollbar">
          <SheetHeader>
            <SheetTitle className="text-sm font-semibold flex items-center gap-2">
              {detailAgent && (
                <>
                  <span className={detailAgent.iconColor}>{detailAgent.icon}</span>
                  {detailAgent.role} Details
                </>
              )}
            </SheetTitle>
          </SheetHeader>

          {detailAgent && (
            <div className="space-y-4 mt-4">
              {/* Overview */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-md bg-muted/50 text-center">
                  <div className="text-lg font-semibold">{detailAgent.policies.length}</div>
                  <div className="text-[10px] text-muted-foreground">Policies</div>
                </div>
                <div className="p-3 rounded-md bg-muted/50 text-center">
                  <div className="text-lg font-semibold">{detailAgent.totalTraces}</div>
                  <div className="text-[10px] text-muted-foreground">Traces</div>
                </div>
                <div className="p-3 rounded-md bg-muted/50 text-center">
                  <div className={`text-lg font-semibold ${
                    detailAgent.riskScore > 50 ? 'text-red-500' : detailAgent.riskScore > 20 ? 'text-amber-500' : 'text-emerald-500'
                  }`}>{detailAgent.riskScore}%</div>
                  <div className="text-[10px] text-muted-foreground">Risk Score</div>
                </div>
                <div className="p-3 rounded-md bg-muted/50 text-center">
                  <div className="flex items-center justify-center gap-1">
                    {detailAgent.complianceIcon}
                    <span className={`text-sm font-semibold ${
                      detailAgent.complianceStatus === 'compliant' ? 'text-emerald-500' : detailAgent.complianceStatus === 'warning' ? 'text-amber-500' : 'text-red-500'
                    }`}>{detailAgent.complianceLabel}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">Compliance</div>
                </div>
              </div>

              {/* Trace Breakdown */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold flex items-center gap-1.5">
                  <Activity className="h-3 w-3" /> Trace Breakdown
                </h4>
                <div className="space-y-1.5 p-3 rounded-md bg-muted/50">
                  {[
                    { label: 'ALLOW', count: detailAgent.allowCount, color: 'text-emerald-600 dark:text-emerald-400' },
                    { label: 'BLOCK', count: detailAgent.blockCount, color: 'text-red-600 dark:text-red-400' },
                    { label: 'REQUIRE_APPROVAL', count: detailAgent.reviewCount, color: 'text-amber-600 dark:text-amber-400' },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between">
                      <span className="text-xs">{row.label}</span>
                      <span className={`text-xs font-semibold ${row.color}`}>{row.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Tools */}
              {detailAgent.topTools.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold">Most Used Tools</h4>
                  <div className="space-y-1">
                    {detailAgent.topTools.map((tool, i) => {
                      const maxCount = detailAgent.topTools[0].count
                      return (
                        <div key={tool.name} className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground w-4 text-right">{i + 1}</span>
                          <span className="text-xs flex-1">{tool.name}</span>
                          <div className="w-24 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(tool.count / maxCount) * 100}%` }} />
                          </div>
                          <span className="text-[10px] text-muted-foreground w-6 text-right">{tool.count}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* All Policies */}
              {detailAgent.policies.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold flex items-center gap-1.5">
                    <Shield className="h-3 w-3" /> All Policies ({detailAgent.policies.length})
                  </h4>
                  <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                    {detailAgent.policies.map(p => (
                      <div key={p.policyId} className="flex items-center justify-between px-3 py-1.5 rounded bg-muted/50 text-xs">
                        <div className="flex flex-col">
                          <span className="font-medium truncate max-w-[200px]">{p.name}</span>
                          <span className="text-[10px] text-muted-foreground">{p.resource} / {p.action}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${decisionColor[p.permissionLevel] ?? ''}`}>
                            {p.permissionLevel}
                          </Badge>
                          <span className={`h-1.5 w-1.5 rounded-full ${p.enabled ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Last Activity */}
              {detailAgent.lastActivity && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Last activity: {formatDistanceToNow(new Date(detailAgent.lastActivity), { addSuffix: true })}
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
