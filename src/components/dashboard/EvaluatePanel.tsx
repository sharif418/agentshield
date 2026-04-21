'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Zap, Loader2, CheckCircle, XCircle, AlertTriangle, Info, BookOpen } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

interface EvaluateResult {
  decision: string
  matchedPolicy?: { policyId: string; name: string; permissionLevel: string; priority: number; action: string } | null
  reason?: string
  traceId: string
  latency?: number
  approvalRequestId?: string
}

const decisionConfig: Record<string, { color: string; icon: React.ReactNode; bg: string; border: string }> = {
  ALLOW: {
    color: 'text-emerald-600 dark:text-emerald-400',
    icon: <CheckCircle className="h-8 w-8" />,
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    border: 'border-emerald-500/30',
  },
  BLOCK: {
    color: 'text-red-600 dark:text-red-400',
    icon: <XCircle className="h-8 w-8" />,
    bg: 'bg-red-500/10 dark:bg-red-500/20',
    border: 'border-red-500/30',
  },
  REQUIRE_APPROVAL: {
    color: 'text-amber-600 dark:text-amber-400',
    icon: <AlertTriangle className="h-8 w-8" />,
    bg: 'bg-amber-500/10 dark:bg-amber-500/20',
    border: 'border-amber-500/30',
  },
}

const ACTION_OPTIONS = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'SELECT', label: 'SELECT' },
  { value: 'INSERT', label: 'INSERT' },
  { value: 'UPDATE', label: 'UPDATE' },
  { value: 'DELETE', label: 'DELETE' },
  { value: 'DROP', label: 'DROP' },
  { value: 'READ', label: 'READ' },
  { value: 'WRITE', label: 'WRITE' },
  { value: 'ADMIN', label: 'ADMIN' },
  { value: 'SEND', label: 'SEND' },
  { value: 'POST_MESSAGE', label: 'POST_MESSAGE' },
  { value: 'PUSH', label: 'PUSH' },
  { value: 'MERGE', label: 'MERGE' },
  { value: 'REFUND', label: 'REFUND' },
]

interface ScenarioTemplate {
  label: string
  agentRole: string
  toolName: string
  arguments: Record<string, unknown>
  action: string
}

const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  {
    label: 'SQL SELECT query',
    agentRole: 'DataAgent',
    toolName: 'PostgreSQL',
    arguments: { query: 'SELECT * FROM users' },
    action: 'SELECT',
  },
  {
    label: 'SQL DROP TABLE',
    agentRole: 'DataAgent',
    toolName: 'PostgreSQL',
    arguments: { query: 'DROP TABLE users' },
    action: 'DROP',
  },
  {
    label: 'GitHub Push to main',
    agentRole: 'CodeAgent',
    toolName: 'GitHub',
    arguments: { operation: 'PUSH', branch: 'main' },
    action: 'PUSH',
  },
  {
    label: 'Stripe Refund',
    agentRole: 'FinanceAgent',
    toolName: 'Stripe',
    arguments: { operation: 'REFUND', amount: 99.99 },
    action: 'REFUND',
  },
  {
    label: 'Email Send',
    agentRole: 'SupportAgent',
    toolName: 'EmailAPI',
    arguments: { to: 'user@example.com', subject: 'Test' },
    action: 'SEND',
  },
  {
    label: 'Read .env file',
    agentRole: 'CodeAgent',
    toolName: 'FileSystem',
    arguments: { path: '/app/.env', operation: 'read' },
    action: 'READ',
  },
]

export function EvaluatePanel() {
  const [agentRole, setAgentRole] = useState('DataAgent')
  const [toolName, setToolName] = useState('')
  const [action, setAction] = useState('auto')
  const [arguments_, setArguments] = useState('{}')
  const [result, setResult] = useState<EvaluateResult | null>(null)

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
      toast.success(`Decision: ${data.decision}`)
    },
    onError: () => {
      toast.error('Evaluation failed')
    },
  })

  const handleEvaluate = () => {
    if (!toolName.trim()) {
      toast.error('Tool name is required')
      return
    }
    let parsedArgs = {}
    try {
      parsedArgs = JSON.parse(arguments_)
    } catch {
      toast.error('Invalid JSON in arguments')
      return
    }
    const body: { agentRole: string; toolName: string; arguments: unknown; action?: string } = {
      agentRole,
      toolName,
      arguments: parsedArgs,
    }
    if (action !== 'auto') {
      body.action = action
    }
    evaluateMutation.mutate(body)
  }

  const handleScenarioSelect = (scenarioLabel: string) => {
    const scenario = SCENARIO_TEMPLATES.find((s) => s.label === scenarioLabel)
    if (!scenario) return
    setAgentRole(scenario.agentRole)
    setToolName(scenario.toolName)
    setAction(scenario.action)
    setArguments(JSON.stringify(scenario.arguments, null, 2))
    setResult(null)
  }

  const config = result ? decisionConfig[result.decision] : null

  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-all duration-300 glow-hover glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Zap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Quick Evaluate
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Scenario Templates */}
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            Scenario Templates
          </Label>
          <Select onValueChange={handleScenarioSelect}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Pick a test scenario..." />
            </SelectTrigger>
            <SelectContent>
              {SCENARIO_TEMPLATES.map((s) => (
                <SelectItem key={s.label} value={s.label}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Agent Role</Label>
          <Select value={agentRole} onValueChange={setAgentRole}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DataAgent">DataAgent</SelectItem>
              <SelectItem value="CodeAgent">CodeAgent</SelectItem>
              <SelectItem value="FinanceAgent">FinanceAgent</SelectItem>
              <SelectItem value="SupportAgent">SupportAgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Tool Name</Label>
          <Input
            className="h-8 text-sm"
            placeholder="e.g. PostgreSQL, GitHub"
            value={toolName}
            onChange={(e) => setToolName(e.target.value)}
          />
        </div>

        {/* Action Field */}
        <div className="space-y-1.5">
          <Label className="text-xs">Action</Label>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Info className="h-3 w-3 shrink-0" />
            {action === 'auto'
              ? 'Auto-detect will infer the action from your arguments (e.g., SQL keyword, operation field).'
              : 'A specific action is set — the engine will match policies for this action.'}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Arguments (JSON)</Label>
          <Textarea
            className="text-xs font-mono min-h-[60px] overflow-x-auto"
            value={arguments_}
            onChange={(e) => setArguments(e.target.value)}
          />
        </div>
        <Button
          className="w-full h-8 text-sm bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98] transition-transform"
          onClick={handleEvaluate}
          disabled={evaluateMutation.isPending}
        >
          {evaluateMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <Zap className="h-3 w-3 mr-1" />
          )}
          Evaluate
        </Button>

        <AnimatePresence mode="wait">
          {result && config && (
            <motion.div
              key={result.traceId}
              initial={{ opacity: 0, scale: 0.95, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 4 }}
              transition={{ duration: 0.2 }}
              className={`space-y-3 p-3 rounded-lg ${config.bg} border ${config.border}`}
            >
              {/* Prominent Decision Badge */}
              <div className="flex flex-col items-center gap-2 py-2">
                <div className={config.color}>
                  {config.icon}
                </div>
                <Badge
                  className={`${config.bg} ${config.color} border ${config.border} text-sm font-bold px-3 py-1 transition-transform duration-150 hover:scale-105`}
                  variant="outline"
                >
                  {result.decision === 'REQUIRE_APPROVAL' ? 'REQUIRE APPROVAL' : result.decision}
                </Badge>
                {result.latency !== undefined && (
                  <span className="text-xs text-muted-foreground font-mono tabular-nums">{result.latency.toFixed(1)}ms</span>
                )}
              </div>

              {result.reason && (
                <p className="text-xs text-muted-foreground text-center">{result.reason}</p>
              )}
              {result.matchedPolicy && (
                <div className="text-xs text-muted-foreground text-center">
                  Policy: <span className="font-medium text-foreground">{result.matchedPolicy.name}</span>
                  <span className="ml-1">(Priority: <span className="font-mono tabular-nums">{result.matchedPolicy.priority}</span>)</span>
                </div>
              )}
              <div className="text-xs text-muted-foreground text-center font-mono">
                {result.traceId}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}
