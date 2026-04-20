'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Zap, Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
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

export function EvaluatePanel() {
  const [agentRole, setAgentRole] = useState('DataAgent')
  const [toolName, setToolName] = useState('')
  const [arguments_, setArguments] = useState('{}')
  const [result, setResult] = useState<EvaluateResult | null>(null)

  const evaluateMutation = useMutation({
    mutationFn: async (body: { agentRole: string; toolName: string; arguments: unknown }) => {
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
    evaluateMutation.mutate({ agentRole, toolName, arguments: parsedArgs })
  }

  const config = result ? decisionConfig[result.decision] : null

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Zap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Quick Evaluate
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
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
        <div className="space-y-1.5">
          <Label className="text-xs">Arguments (JSON)</Label>
          <Textarea
            className="text-xs font-mono min-h-[60px]"
            value={arguments_}
            onChange={(e) => setArguments(e.target.value)}
          />
        </div>
        <Button
          className="w-full h-8 text-sm bg-emerald-600 hover:bg-emerald-700 text-white"
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
                  className={`${config.bg} ${config.color} border ${config.border} text-sm font-bold px-3 py-1`}
                  variant="outline"
                >
                  {result.decision === 'REQUIRE_APPROVAL' ? 'REQUIRE APPROVAL' : result.decision}
                </Badge>
                {result.latency !== undefined && (
                  <span className="text-xs text-muted-foreground">{result.latency.toFixed(1)}ms</span>
                )}
              </div>

              {result.reason && (
                <p className="text-xs text-muted-foreground text-center">{result.reason}</p>
              )}
              {result.matchedPolicy && (
                <div className="text-xs text-muted-foreground text-center">
                  Policy: <span className="font-medium text-foreground">{result.matchedPolicy.name}</span>
                  <span className="ml-1">(Priority: {result.matchedPolicy.priority})</span>
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
