'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  FlaskConical,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  Database,
  Code2,
  DollarSign,
  Headphones,
  ChevronRight,
  Clock,
  Fingerprint,
  ShieldCheck,
  GitBranch,
  Zap,
} from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Types ───────────────────────────────────────────────────────────────────

interface EvaluateResult {
  decision: string
  matchedPolicy?: {
    policyId: string
    name: string
    permissionLevel: string
    priority: number
    action: string
  } | null
  reason?: string
  traceId: string
  latency?: number
  approvalRequestId?: string
}

interface SimulationHistoryEntry {
  id: string
  timestamp: Date
  agentRole: string
  toolName: string
  action: string
  decision: string
  result: EvaluateResult
}

// ─── Constants ───────────────────────────────────────────────────────────────

const AGENT_ROLES = ['DataAgent', 'CodeAgent', 'FinanceAgent', 'SupportAgent'] as const

const TOOLS = ['PostgreSQL', 'GitHub', 'Stripe', 'EmailAPI', 'FileSystem', 'Kubernetes'] as const

const ROLE_COLORS: Record<string, string> = {
  DataAgent: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
  CodeAgent: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
  FinanceAgent: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  SupportAgent: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
}

const ROLE_BTN_COLORS: Record<string, string> = {
  DataAgent: 'bg-cyan-600 hover:bg-cyan-700 text-white',
  CodeAgent: 'bg-violet-600 hover:bg-violet-700 text-white',
  FinanceAgent: 'bg-amber-600 hover:bg-amber-700 text-white',
  SupportAgent: 'bg-rose-600 hover:bg-rose-700 text-white',
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  DataAgent: <Database className="h-3.5 w-3.5" />,
  CodeAgent: <Code2 className="h-3.5 w-3.5" />,
  FinanceAgent: <DollarSign className="h-3.5 w-3.5" />,
  SupportAgent: <Headphones className="h-3.5 w-3.5" />,
}

const TOOL_ARGUMENT_TEMPLATES: Record<string, string> = {
  PostgreSQL: JSON.stringify({ query: 'SELECT * FROM users', operation: 'SELECT' }, null, 2),
  GitHub: JSON.stringify({ operation: 'MERge', branch: 'main', repository: 'org/repo' }, null, 2),
  Stripe: JSON.stringify({ operation: 'CHARGE', amount: 100, currency: 'USD' }, null, 2),
  EmailAPI: JSON.stringify({ to: 'user@example.com', subject: 'Hello', body: 'Test email' }, null, 2),
  FileSystem: JSON.stringify({ path: '/data/file.txt', operation: 'read' }, null, 2),
  Kubernetes: JSON.stringify({ operation: 'GET', resource: 'pods', namespace: 'default' }, null, 2),
}

const DECISION_CONFIG: Record<string, {
  color: string
  icon: React.ReactNode
  bg: string
  border: string
  glow: string
}> = {
  ALLOW: {
    color: 'text-emerald-600 dark:text-emerald-400',
    icon: <CheckCircle2 className="h-10 w-10" />,
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    border: 'border-emerald-500/30',
    glow: '0 0 30px rgba(16,185,129,0.15), 0 0 60px rgba(16,185,129,0.05)',
  },
  BLOCK: {
    color: 'text-red-600 dark:text-red-400',
    icon: <XCircle className="h-10 w-10" />,
    bg: 'bg-red-500/10 dark:bg-red-500/20',
    border: 'border-red-500/30',
    glow: '0 0 30px rgba(239,68,68,0.15), 0 0 60px rgba(239,68,68,0.05)',
  },
  REQUIRE_APPROVAL: {
    color: 'text-amber-600 dark:text-amber-400',
    icon: <AlertTriangle className="h-10 w-10" />,
    bg: 'bg-amber-500/10 dark:bg-amber-500/20',
    border: 'border-amber-500/30',
    glow: '0 0 30px rgba(245,158,11,0.15), 0 0 60px rgba(245,158,11,0.05)',
  },
}

interface QuickScenario {
  label: string
  agentRole: string
  toolName: string
  action: string
  arguments: Record<string, unknown>
}

const QUICK_SCENARIOS: QuickScenario[] = [
  {
    label: 'SQL Injection Attempt',
    agentRole: 'DataAgent',
    toolName: 'PostgreSQL',
    action: 'DROP TABLE',
    arguments: { query: 'DROP TABLE users', operation: 'DROP' },
  },
  {
    label: 'Unauthorized Merge',
    agentRole: 'CodeAgent',
    toolName: 'GitHub',
    action: 'force push',
    arguments: { operation: 'PUSH', branch: 'main', force: true },
  },
  {
    label: 'Large Transaction',
    agentRole: 'FinanceAgent',
    toolName: 'Stripe',
    action: '$10000 charge',
    arguments: { operation: 'CHARGE', amount: 10000, currency: 'USD' },
  },
  {
    label: 'Mass Email',
    agentRole: 'SupportAgent',
    toolName: 'EmailAPI',
    action: 'bulk send',
    arguments: { to: 'all-users@company.com', subject: 'Newsletter', body: 'Bulk email', bulk: true },
  },
  {
    label: 'File System Access',
    agentRole: 'DataAgent',
    toolName: 'FileSystem',
    action: '/etc/passwd read',
    arguments: { path: '/etc/passwd', operation: 'read' },
  },
]

// ─── Decision Flow Visualization ─────────────────────────────────────────────

function DecisionFlow({
  agentRole,
  toolName,
  decision,
}: {
  agentRole: string
  toolName: string
  decision: string | null
}) {
  const decisionColor = decision
    ? decision === 'ALLOW'
      ? '#10b981'
      : decision === 'BLOCK'
        ? '#ef4444'
        : '#f59e0b'
    : '#6b7280'

  const steps = [
    { label: agentRole || 'Agent', icon: ROLE_ICONS[agentRole] ?? <ShieldCheck className="h-4 w-4" />, color: agentRole ? (ROLE_BTN_COLORS[agentRole]?.split(' ')[0] ?? '#6b7280') : '#6b7280' },
    { label: toolName || 'Tool', icon: <Zap className="h-4 w-4" />, color: '#8b5cf6' },
    { label: 'Policy Check', icon: <ShieldCheck className="h-4 w-4" />, color: decisionColor },
    { label: decision === 'ALLOW' ? 'Allowed' : decision === 'BLOCK' ? 'Blocked' : decision === 'REQUIRE_APPROVAL' ? 'Approval Required' : 'Decision', icon: decision ? DECISION_CONFIG[decision]?.icon ?? <GitBranch className="h-4 w-4" /> : <GitBranch className="h-4 w-4" />, color: decisionColor },
  ]

  return (
    <div className="flex flex-col items-center gap-1 py-2">
      {steps.map((step, i) => (
        <div key={i} className="flex flex-col items-center">
          {/* Connector line */}
          {i > 0 && (
            <div className="flex flex-col items-center">
              <ChevronRight className="h-3 w-3 text-muted-foreground rotate-90" />
              <div
                className="w-0.5 h-3"
                style={{ backgroundColor: i === steps.length - 1 ? decisionColor : '#6b728033' }}
              />
            </div>
          )}
          {/* Node */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.15, duration: 0.3 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border"
            style={{
              borderColor: step.color + '40',
              backgroundColor: step.color + '10',
            }}
          >
            <span style={{ color: step.color }}>{step.icon}</span>
            <span className="text-xs font-medium" style={{ color: step.color }}>{step.label}</span>
          </motion.div>
        </div>
      ))}
    </div>
  )
}

// ─── What-If Analysis ────────────────────────────────────────────────────────

function WhatIfAnalysis({
  currentRole,
  currentTool,
  currentAction,
  currentResult,
}: {
  currentRole: string
  currentTool: string
  currentAction: string
  currentResult: EvaluateResult | null
}) {
  const [whatIfLoading, setWhatIfLoading] = useState(false)
  const [whatIfResults, setWhatIfResults] = useState<Array<{
    label: string
    change: string
    decision: string
  }> | null>(null)

  const runWhatIf = useCallback(async () => {
    if (!currentResult) return
    setWhatIfLoading(true)
    setWhatIfResults(null)

    try {
      const alternatives: Array<{ label: string; change: string; body: Record<string, unknown> }> = []

      // What if you changed the agent role?
      for (const role of AGENT_ROLES) {
        if (role !== currentRole) {
          alternatives.push({
            label: `Change to ${role}`,
            change: 'agent role',
            body: { agentRole: role, toolName: currentTool, action: currentAction },
          })
        }
      }

      // What if the action was READ instead?
      if (currentAction.toUpperCase() !== 'READ' && currentAction.toUpperCase() !== 'SELECT') {
        alternatives.push({
          label: 'Change to READ',
          change: 'action',
          body: { agentRole: currentRole, toolName: currentTool, action: 'READ' },
        })
      }

      const results = await Promise.all(
        alternatives.map(async (alt) => {
          try {
            const res = await fetch('/api/evaluate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(alt.body),
            })
            if (!res.ok) return { ...alt, decision: 'ERROR' }
            const data = (await res.json()) as EvaluateResult
            return { label: alt.label, change: alt.change, decision: data.decision }
          } catch {
            return { ...alt, decision: 'ERROR' }
          }
        })
      )

      setWhatIfResults(results)
    } finally {
      setWhatIfLoading(false)
    }
  }, [currentRole, currentTool, currentAction, currentResult])

  if (!currentResult) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium flex items-center gap-1.5">
          <GitBranch className="h-3 w-3" />
          What-If Analysis
        </Label>
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-[10px] active:scale-[0.98] transition-transform"
          onClick={runWhatIf}
          disabled={whatIfLoading}
        >
          {whatIfLoading ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <Play className="h-3 w-3 mr-1" />
          )}
          Run What-If
        </Button>
      </div>

      <AnimatePresence>
        {whatIfResults && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-1 overflow-hidden"
          >
            {whatIfResults.map((r, i) => {
              const cfg = DECISION_CONFIG[r.decision]
              const isDifferent = r.decision !== currentResult.decision
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`flex items-center justify-between text-[11px] px-2 py-1.5 rounded-md ${isDifferent ? 'bg-amber-500/5 border border-amber-500/20' : 'bg-muted/50'}`}
                >
                  <span className="text-muted-foreground">
                    {r.label}
                    <span className="text-muted-foreground/60 ml-1">({r.change})</span>
                  </span>
                  {cfg ? (
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 ${cfg.color} ${cfg.border}`}
                    >
                      {r.decision === 'REQUIRE_APPROVAL' ? 'APPROVAL' : r.decision}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {r.decision}
                    </Badge>
                  )}
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function PolicySimulator() {
  // Scenario config state
  const [agentRole, setAgentRole] = useState<string>('DataAgent')
  const [toolName, setToolName] = useState<string>('PostgreSQL')
  const [actionInput, setActionInput] = useState<string>('SELECT')
  const [argumentsText, setArgumentsText] = useState<string>(TOOL_ARGUMENT_TEMPLATES['PostgreSQL'])
  const [result, setResult] = useState<EvaluateResult | null>(null)
  const [history, setHistory] = useState<SimulationHistoryEntry[]>([])

  // Evaluate mutation
  const evaluateMutation = useMutation({
    mutationFn: async (body: { agentRole: string; toolName: string; arguments: unknown; action?: string }) => {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Evaluation failed')
      return res.json() as Promise<EvaluateResult>
    },
    onSuccess: (data) => {
      setResult(data)
      toast.success(`Decision: ${data.decision === 'REQUIRE_APPROVAL' ? 'REQUIRE APPROVAL' : data.decision}`)
      // Add to history (max 10)
      setHistory((prev) => [
        {
          id: `sim-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date(),
          agentRole,
          toolName,
          action: actionInput,
          decision: data.decision,
          result: data,
        },
        ...prev,
      ].slice(0, 10))
    },
    onError: () => {
      toast.error('Simulation failed')
    },
  })

  const handleSimulate = useCallback(() => {
    let parsedArgs: unknown = {}
    try {
      parsedArgs = JSON.parse(argumentsText)
    } catch {
      toast.error('Invalid JSON in arguments')
      return
    }
    evaluateMutation.mutate({
      agentRole,
      toolName,
      arguments: parsedArgs,
      action: actionInput || undefined,
    })
  }, [agentRole, toolName, actionInput, argumentsText, evaluateMutation])

  const handleQuickScenario = useCallback((scenario: QuickScenario) => {
    setAgentRole(scenario.agentRole)
    setToolName(scenario.toolName)
    setActionInput(scenario.action)
    setArgumentsText(JSON.stringify(scenario.arguments, null, 2))
    setResult(null)
  }, [])

  const handleToolChange = useCallback((tool: string) => {
    setToolName(tool)
    setArgumentsText(TOOL_ARGUMENT_TEMPLATES[tool] ?? '{}')
  }, [])

  const handleHistoryClick = useCallback((entry: SimulationHistoryEntry) => {
    setAgentRole(entry.agentRole)
    setToolName(entry.toolName)
    setActionInput(entry.action)
    try {
      setArgumentsText(JSON.stringify(entry.result, null, 2))
    } catch {
      setArgumentsText('{}')
    }
    setResult(entry.result)
  }, [])

  const handleReset = useCallback(() => {
    setAgentRole('DataAgent')
    setToolName('PostgreSQL')
    setActionInput('SELECT')
    setArgumentsText(TOOL_ARGUMENT_TEMPLATES['PostgreSQL'])
    setResult(null)
  }, [])

  const config = result ? DECISION_CONFIG[result.decision] : null

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Section Header */}
      <div className="section-header-gradient rounded-xl px-4 py-3 -mx-4 -mt-2 md:-mx-6 md:-mt-4 mb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2 bg-gradient-to-r from-emerald-700 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
              <FlaskConical className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Policy Simulator
            </h2>
            <p className="text-sm text-muted-foreground">
              Test policy configurations before deploying by simulating agent actions
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs active:scale-[0.98] transition-transform"
            onClick={handleReset}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
        </div>
      </div>

      {/* Two-Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* ─── Left Panel: Scenario Configuration ─── */}
        <div className="space-y-4">
          <Card className="glass-card glow-hover border border-border/50 rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Play className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Scenario Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Agent Role */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Agent Role</Label>
                <Select value={agentRole} onValueChange={setAgentRole}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGENT_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        <span className="flex items-center gap-2">
                          {ROLE_ICONS[role]}
                          {role}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tool Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Tool Name</Label>
                <Select value={toolName} onValueChange={handleToolChange}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TOOLS.map((tool) => (
                      <SelectItem key={tool} value={tool}>{tool}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Action */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Action</Label>
                <Input
                  className="h-9 text-sm"
                  placeholder="e.g., DROP TABLE, merge PR, charge $500"
                  value={actionInput}
                  onChange={(e) => setActionInput(e.target.value)}
                />
              </div>

              {/* Arguments JSON */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Arguments (JSON)</Label>
                <Textarea
                  className="text-xs font-mono min-h-[100px] overflow-x-auto"
                  value={argumentsText}
                  onChange={(e) => setArgumentsText(e.target.value)}
                />
              </div>

              {/* Simulate Button */}
              <Button
                className="w-full h-10 text-sm bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98] transition-transform font-medium"
                onClick={handleSimulate}
                disabled={evaluateMutation.isPending}
              >
                {evaluateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <FlaskConical className="h-4 w-4 mr-2" />
                )}
                Simulate
              </Button>
            </CardContent>
          </Card>

          {/* Quick Scenarios */}
          <Card className="glass-card glow-hover border border-border/50 rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                Quick Scenarios
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {QUICK_SCENARIOS.map((scenario) => (
                <button
                  key={scenario.label}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 active:scale-[0.98] border border-transparent hover:border-border/50 hover:shadow-sm ${ROLE_BTN_COLORS[scenario.agentRole]}`}
                  onClick={() => handleQuickScenario(scenario)}
                >
                  {ROLE_ICONS[scenario.agentRole]}
                  <span className="flex-1 text-left">{scenario.label}</span>
                  <span className="opacity-70 text-[10px]">{scenario.toolName}</span>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* ─── Right Panel: Simulation Results ─── */}
        <div className="space-y-4">
          {/* Decision Result */}
          <Card className="glass-card glow-hover border border-border/50 rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Simulation Result
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AnimatePresence mode="wait">
                {result && config ? (
                  <motion.div
                    key={result.traceId}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3, type: 'spring', stiffness: 200, damping: 20 }}
                    className={`rounded-xl p-5 ${config.bg} border ${config.border}`}
                    style={{ boxShadow: config.glow }}
                  >
                    {/* Large animated decision display */}
                    <div className="flex flex-col items-center gap-3 py-3">
                      <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 15 }}
                        className={config.color}
                      >
                        {config.icon}
                      </motion.div>
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 15 }}
                      >
                        <Badge
                          className={`${config.bg} ${config.color} border ${config.border} text-lg font-bold px-5 py-1.5 transition-transform duration-150 hover:scale-105`}
                          variant="outline"
                        >
                          {result.decision === 'REQUIRE_APPROVAL' ? 'REQUIRE APPROVAL' : result.decision}
                        </Badge>
                      </motion.div>
                    </div>

                    <Separator className="my-4 opacity-30" />

                    {/* Matched Policy Details */}
                    {result.matchedPolicy && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">Policy:</span>
                          <span className="font-medium">{result.matchedPolicy.name}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground">Priority:</span>
                            <Badge variant="outline" className="font-mono tabular-nums text-[10px] px-1.5">
                              {result.matchedPolicy.priority}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground">Action:</span>
                            <Badge variant="outline" className="text-[10px] px-1.5">
                              {result.matchedPolicy.action}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground">Level:</span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 ${config.color} ${config.border}`}
                            >
                              {result.matchedPolicy.permissionLevel}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground">ID:</span>
                            <span className="font-mono text-[10px] truncate max-w-[120px]">
                              {result.matchedPolicy.policyId}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Reason */}
                    {result.reason && (
                      <p className="text-xs text-muted-foreground mt-3 text-center italic">
                        {result.reason}
                      </p>
                    )}

                    {/* Latency + Trace ID */}
                    <div className="flex items-center justify-center gap-4 mt-4">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span className="font-mono tabular-nums">
                          {result.latency !== undefined ? `${result.latency.toFixed(1)}ms` : '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Fingerprint className="h-3 w-3" />
                        <span className="font-mono text-[10px]">{result.traceId}</span>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center py-12 text-muted-foreground"
                  >
                    <FlaskConical className="h-12 w-12 mb-3 opacity-20" />
                    <p className="text-sm font-medium">No simulation yet</p>
                    <p className="text-xs mt-1">Configure a scenario and click Simulate</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>

          {/* Decision Flow Visualization */}
          <Card className="glass-card glow-hover border border-border/50 rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Decision Flow
              </CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <DecisionFlow
                agentRole={agentRole}
                toolName={toolName}
                decision={result?.decision ?? null}
              />
            </CardContent>
          </Card>

          {/* What-If Analysis */}
          <Card className="glass-card glow-hover border border-border/50 rounded-xl">
            <CardContent className="pt-4">
              <WhatIfAnalysis
                currentRole={agentRole}
                currentTool={toolName}
                currentAction={actionInput}
                currentResult={result}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ─── Simulation History ─── */}
      <Card className="glass-card glow-hover border border-border/50 rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Simulation History
            {history.length > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 font-mono tabular-nums">
                {history.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-xs">No simulations yet</p>
            </div>
          ) : (
            <ScrollArea className="max-h-72">
              <div className="space-y-1.5">
                {history.map((entry, i) => {
                  const entryConfig = DECISION_CONFIG[entry.decision]
                  return (
                    <motion.button
                      key={entry.id}
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs hover:bg-muted/50 transition-colors duration-150 text-left"
                      onClick={() => handleHistoryClick(entry)}
                    >
                      {/* Timestamp */}
                      <span className="text-muted-foreground font-mono tabular-nums shrink-0 w-[52px]">
                        {entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>

                      {/* Agent Role Badge */}
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${ROLE_COLORS[entry.agentRole] ?? ''}`}>
                        {entry.agentRole}
                      </Badge>

                      {/* Tool */}
                      <span className="text-muted-foreground shrink-0">{entry.toolName}</span>

                      {/* Action */}
                      <span className="truncate flex-1 font-medium">{entry.action}</span>

                      {/* Decision Badge */}
                      {entryConfig ? (
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 shrink-0 transition-transform duration-150 hover:scale-105 ${entryConfig.color} ${entryConfig.border}`}
                        >
                          {entry.decision === 'REQUIRE_APPROVAL' ? 'APPROVAL' : entry.decision}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                          {entry.decision}
                        </Badge>
                      )}
                    </motion.button>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
