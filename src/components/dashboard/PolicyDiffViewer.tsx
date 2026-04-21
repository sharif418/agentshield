'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GitCompare,
  ArrowRight,
  ArrowLeft,
  Plus,
  Minus,
  AlertTriangle,
  Shield,
  Clock,
  Loader2,
  ChevronRight,
  FileText,
  Eye,
  Zap,
  BarChart3,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { formatDistanceToNow } from 'date-fns'

// ===== Types =====

interface Policy {
  policyId: string
  name: string
  description: string | null
  agentRole: string
  resource: string
  action: string
  permissionLevel: string
  conditionRules: string | null
  priority: number
  enabled: boolean
  createdAt: string
  updatedAt: string
}

interface HistoryEntry {
  id: string | number
  eventType: string
  changeType: string
  actor: string
  timestamp: string
  description: string
  details: string
}

interface AuditLogEntry {
  id: number
  eventType: string
  actor: string
  details: string
  timestamp: string
}

interface Trace {
  traceId: string
  agentRole: string
  toolName: string
  evaluationResult: string
  matchedPolicyId: string | null
  policy?: { name: string; permissionLevel: string; action: string; priority: number } | null
}

// ===== Constants =====

const DIFF_FIELDS: { key: keyof Policy; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'description', label: 'Description' },
  { key: 'agentRole', label: 'Agent Role' },
  { key: 'resource', label: 'Resource' },
  { key: 'action', label: 'Action' },
  { key: 'permissionLevel', label: 'Permission Level' },
  { key: 'conditionRules', label: 'Condition Rules' },
  { key: 'priority', label: 'Priority' },
  { key: 'enabled', label: 'Enabled' },
]

const permissionBadgeClasses: Record<string, string> = {
  ALLOW: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  BLOCK: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
  REQUIRE_APPROVAL: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
}

// ===== Skeleton Loaders =====

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

function SkeletonDiffRow() {
  return (
    <div className="flex items-center gap-4 py-2 px-3">
      <div className="h-3 w-24 bg-muted/50 animate-pulse rounded shrink-0" />
      <div className="h-3 w-32 bg-muted/50 animate-pulse rounded" />
      <div className="h-3 w-4 bg-muted/50 animate-pulse rounded" />
      <div className="h-3 w-32 bg-muted/50 animate-pulse rounded" />
    </div>
  )
}

// ===== Helper: Risk Assessment =====

function assessRisk(base: Policy, compare: Policy): { level: string; color: string; icon: React.ReactNode } {
  if (base.permissionLevel !== compare.permissionLevel) {
    return { level: 'High risk', color: 'text-red-600 dark:text-red-400', icon: <AlertTriangle className="h-3.5 w-3.5" /> }
  }
  if (base.conditionRules !== compare.conditionRules || base.action !== compare.action) {
    return { level: 'Medium risk', color: 'text-amber-600 dark:text-amber-400', icon: <Zap className="h-3.5 w-3.5" /> }
  }
  return { level: 'Low risk', color: 'text-emerald-600 dark:text-emerald-400', icon: <Info className="h-3.5 w-3.5" /> }
}

// ===== Helper: Format value for display =====

function formatFieldValue(key: keyof Policy, value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (key === 'enabled') return value ? 'Enabled' : 'Disabled'
  if (key === 'conditionRules') {
    if (!value) return 'None'
    try {
      return JSON.stringify(JSON.parse(value as string), null, 2)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

// ===== Sub-Component: Condition Rules Diff =====

function ConditionRulesDiff({ baseRules, compareRules }: { baseRules: string | null; compareRules: string | null }) {
  const parsed = useMemo(() => {
    let baseObj: Record<string, unknown> = {}
    let compareObj: Record<string, unknown> = {}
    try { baseObj = baseRules ? JSON.parse(baseRules) : {} } catch { /* empty */ }
    try { compareObj = compareRules ? JSON.parse(compareRules) : {} } catch { /* empty */ }

    const allKeys = Array.from(new Set([...Object.keys(baseObj), ...Object.keys(compareObj)])).sort()
    return allKeys.map((key) => {
      const inBase = key in baseObj
      const inCompare = key in compareObj
      const baseVal = baseObj[key]
      const compareVal = compareObj[key]
      const baseStr = JSON.stringify(baseVal)
      const compareStr = JSON.stringify(compareVal)

      if (inBase && !inCompare) return { key, status: 'removed' as const, baseVal: baseStr, compareVal: null }
      if (!inBase && inCompare) return { key, status: 'added' as const, baseVal: null, compareVal: compareStr }
      if (baseStr !== compareStr) return { key, status: 'changed' as const, baseVal: baseStr, compareVal: compareStr }
      return { key, status: 'unchanged' as const, baseVal: baseStr, compareVal: compareStr }
    })
  }, [baseRules, compareRules])

  if (parsed.length === 0) {
    return <p className="text-xs text-muted-foreground italic">No condition rules defined</p>
  }

  return (
    <div className="space-y-1.5">
      {parsed.map((entry) => {
        const statusClasses =
          entry.status === 'added'
            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-l-2 border-emerald-500'
            : entry.status === 'removed'
              ? 'bg-red-500/10 text-red-700 dark:text-red-400 border-l-2 border-red-500'
              : entry.status === 'changed'
                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-l-2 border-amber-500'
                : 'border-l-2 border-transparent'

        return (
          <div key={entry.key} className={`rounded-md px-3 py-1.5 ${statusClasses}`}>
            <div className="flex items-center gap-2 text-xs">
              {entry.status === 'added' && <Plus className="h-3 w-3 shrink-0" />}
              {entry.status === 'removed' && <Minus className="h-3 w-3 shrink-0" />}
              {entry.status === 'changed' && <ArrowRight className="h-3 w-3 shrink-0" />}
              {entry.status === 'unchanged' && <span className="w-3 shrink-0" />}
              <span className="font-mono font-medium">{entry.key}</span>
              {entry.status === 'added' && (
                <span className="font-mono tabular-nums text-[11px]">{entry.compareVal}</span>
              )}
              {entry.status === 'removed' && (
                <span className="font-mono tabular-nums text-[11px] line-through">{entry.baseVal}</span>
              )}
              {entry.status === 'changed' && (
                <span className="font-mono tabular-nums text-[11px]">
                  <span className="line-through text-red-600 dark:text-red-400">{entry.baseVal}</span>
                  {' → '}
                  <span className="text-emerald-600 dark:text-emerald-400">{entry.compareVal}</span>
                </span>
              )}
              {entry.status === 'unchanged' && (
                <span className="font-mono tabular-nums text-[11px] text-muted-foreground">{entry.baseVal}</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ===== Main Component =====

export function PolicyDiffViewer() {
  const [basePolicyId, setBasePolicyId] = useState<string>('')
  const [comparePolicyId, setComparePolicyId] = useState<string>('')

  // Fetch all policies
  const { data: policies, isLoading: policiesLoading } = useQuery<Policy[]>({
    queryKey: ['policies-diff'],
    queryFn: async () => {
      const res = await fetch('/api/policies')
      if (!res.ok) return []
      return res.json() as Promise<Policy[]>
    },
  })

  // Fetch history for base policy
  const { data: baseHistory } = useQuery<{ policyId: string; policyName: string; history: HistoryEntry[] }>({
    queryKey: ['policy-history-base', basePolicyId],
    queryFn: async () => {
      const res = await fetch(`/api/policies/${basePolicyId}/history`)
      if (!res.ok) return { policyId: basePolicyId, policyName: '', history: [] }
      return res.json()
    },
    enabled: !!basePolicyId,
  })

  // Fetch history for compare policy
  const { data: compareHistory } = useQuery<{ policyId: string; policyName: string; history: HistoryEntry[] }>({
    queryKey: ['policy-history-compare', comparePolicyId],
    queryFn: async () => {
      const res = await fetch(`/api/policies/${comparePolicyId}/history`)
      if (!res.ok) return { policyId: comparePolicyId, policyName: '', history: [] }
      return res.json()
    },
    enabled: !!comparePolicyId,
  })

  // Fetch traces for impact analysis
  const { data: tracesData } = useQuery<{ traces: Trace[]; total: number }>({
    queryKey: ['traces-diff'],
    queryFn: async () => {
      const res = await fetch('/api/traces?limit=200')
      if (!res.ok) return { traces: [], total: 0 }
      return res.json()
    },
    enabled: !!basePolicyId && !!comparePolicyId,
  })

  // Fetch audit logs for diff history timeline
  const { data: auditData } = useQuery<{ logs: AuditLogEntry[]; total: number }>({
    queryKey: ['audit-diff-timeline'],
    queryFn: async () => {
      const res = await fetch('/api/audit?eventType=POLICY_UPDATED&limit=20')
      if (!res.ok) return { logs: [], total: 0 }
      return res.json()
    },
  })

  // Find selected policies
  const basePolicy = useMemo(
    () => policies?.find((p) => p.policyId === basePolicyId) ?? null,
    [policies, basePolicyId]
  )
  const comparePolicy = useMemo(
    () => policies?.find((p) => p.policyId === comparePolicyId) ?? null,
    [policies, comparePolicyId]
  )

  // Compute diff
  const diffResult = useMemo(() => {
    if (!basePolicy || !comparePolicy) return null

    const changes: { field: string; key: keyof Policy; baseValue: unknown; compareValue: unknown; displayBase: string; displayCompare: string }[] = []

    for (const { key, label } of DIFF_FIELDS) {
      const baseVal = basePolicy[key]
      const compVal = comparePolicy[key]
      const baseDisplay = formatFieldValue(key, baseVal)
      const compDisplay = formatFieldValue(key, compVal)

      if (baseDisplay !== compDisplay) {
        changes.push({ field: label, key, baseValue: baseVal, compareValue: compVal, displayBase: baseDisplay, displayCompare: compDisplay })
      }
    }

    const risk = assessRisk(basePolicy, comparePolicy)

    return { changes, risk }
  }, [basePolicy, comparePolicy])

  // Impact analysis
  const impactAnalysis = useMemo(() => {
    if (!basePolicy || !comparePolicy || !tracesData?.traces) return null

    const traces = tracesData.traces
    // Traces matching the base policy's agentRole + resource
    const affectedTraces = traces.filter(
      (t) => t.agentRole === basePolicy.agentRole
    )

    const blockRate = affectedTraces.length > 0
      ? affectedTraces.filter((t) => t.evaluationResult === 'BLOCK').length / affectedTraces.length
      : 0
    const reviewRate = affectedTraces.length > 0
      ? affectedTraces.filter((t) => t.evaluationResult === 'REQUIRE_APPROVAL').length / affectedTraces.length
      : 0

    // Estimate change if permission level changed
    let blockRateDelta = 0
    let reviewRateDelta = 0

    if (basePolicy.permissionLevel !== comparePolicy.permissionLevel) {
      if (comparePolicy.permissionLevel === 'BLOCK') blockRateDelta = 0.15
      if (comparePolicy.permissionLevel === 'REQUIRE_APPROVAL') reviewRateDelta = 0.12
      if (comparePolicy.permissionLevel === 'ALLOW') { blockRateDelta = -0.1; reviewRateDelta = -0.08 }
    }

    return {
      affectedTraces: affectedTraces.length,
      blockRate: Math.round(blockRate * 100),
      reviewRate: Math.round(reviewRate * 100),
      blockRateDelta,
      reviewRateDelta,
    }
  }, [basePolicy, comparePolicy, tracesData])

  // Handle timeline click
  const handleTimelineClick = useCallback((log: AuditLogEntry) => {
    try {
      const details = JSON.parse(log.details)
      if (details.policyId) {
        if (!basePolicyId) {
          setBasePolicyId(details.policyId)
        } else if (!comparePolicyId && details.policyId !== basePolicyId) {
          setComparePolicyId(details.policyId)
        }
      }
    } catch {
      // ignore parse errors
    }
  }, [basePolicyId, comparePolicyId])

  // ===== Loading State =====

  if (policiesLoading) {
    return (
      <div className="h-full flex flex-col p-4 md:p-6 gap-4">
        <div className="section-header-gradient rounded-xl px-4 py-3 -mx-4 -mt-2 md:-mx-6 md:-mt-4 mb-2">
          <div className="h-6 w-40 bg-muted/30 animate-pulse rounded" />
          <div className="h-4 w-64 bg-muted/20 animate-pulse rounded mt-2" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <Card className="border-0 shadow-sm glass-card">
          <CardContent className="p-4 md:p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <SkeletonDiffRow key={i} />)}
          </CardContent>
        </Card>
      </div>
    )
  }

  // ===== Empty State =====

  const hasBothSelected = !!basePolicy && !!comparePolicy

  return (
    <div className="h-full flex flex-col p-4 md:p-6 gap-4 overflow-y-auto custom-scrollbar">
      {/* ===== Section Header ===== */}
      <div className="section-header-gradient rounded-xl px-4 py-3 -mx-4 -mt-2 md:-mx-6 md:-mt-4 mb-2">
        <h2 className="text-lg font-bold tracking-tight flex items-center gap-2 bg-gradient-to-r from-emerald-700 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
          <GitCompare className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          Policy Diff
        </h2>
        <p className="text-sm text-muted-foreground">Compare policy versions and track changes</p>
      </div>

      {/* ===== Version Selector Panel ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Base Version Selector */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="border-0 shadow-sm glass-card glow-hover">
            <CardHeader className="pb-2 pt-4 px-4 md:px-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-500/10">
                    <span className="text-xs font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400">A</span>
                  </div>
                  <span className="text-sm font-semibold">Base Version</span>
                </div>
                {basePolicy && (
                  <Badge variant="outline" className="text-[10px] h-5 font-mono tabular-nums">
                    {basePolicy.agentRole}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-4 md:px-6 pb-4 md:pb-6 space-y-3">
              <Select value={basePolicyId} onValueChange={setBasePolicyId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select base policy..." />
                </SelectTrigger>
                <SelectContent>
                  {policies?.map((p) => (
                    <SelectItem key={p.policyId} value={p.policyId}>
                      <span className="flex items-center gap-2">
                        <span className="truncate">{p.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono tabular-nums">P{p.priority}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Base policy quick info */}
              {basePolicy && (
                <div className="rounded-lg bg-muted/30 p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Permission</span>
                    <Badge variant="outline" className={`text-[10px] h-5 ${permissionBadgeClasses[basePolicy.permissionLevel] ?? ''}`}>
                      {basePolicy.permissionLevel}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Resource</span>
                    <span className="font-mono tabular-nums">{basePolicy.resource}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Action</span>
                    <span className="font-mono tabular-nums">{basePolicy.action}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Enabled</span>
                    <span className={basePolicy.enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                      {basePolicy.enabled ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              )}

              {/* Version history for base */}
              {baseHistory && baseHistory.history.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
                    <Clock className="h-3 w-3" />
                    Version History ({baseHistory.history.length})
                  </div>
                  <ScrollArea className="max-h-32">
                    <div className="space-y-1">
                      {baseHistory.history.slice(0, 5).map((entry) => (
                        <div key={entry.id} className="flex items-center gap-2 text-[11px] py-0.5">
                          <span className="font-mono tabular-nums text-muted-foreground shrink-0">
                            {new Date(entry.timestamp).toLocaleDateString()}
                          </span>
                          <span className="truncate">{entry.description}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Compare Version Selector */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-0 shadow-sm glass-card glow-hover">
            <CardHeader className="pb-2 pt-4 px-4 md:px-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded bg-emerald-500/10">
                    <span className="text-xs font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">B</span>
                  </div>
                  <span className="text-sm font-semibold">Compare Version</span>
                </div>
                {comparePolicy && (
                  <Badge variant="outline" className="text-[10px] h-5 font-mono tabular-nums">
                    {comparePolicy.agentRole}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-4 md:px-6 pb-4 md:pb-6 space-y-3">
              <Select value={comparePolicyId} onValueChange={setComparePolicyId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select compare policy..." />
                </SelectTrigger>
                <SelectContent>
                  {policies?.map((p) => (
                    <SelectItem key={p.policyId} value={p.policyId}>
                      <span className="flex items-center gap-2">
                        <span className="truncate">{p.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono tabular-nums">P{p.priority}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Compare policy quick info */}
              {comparePolicy && (
                <div className="rounded-lg bg-muted/30 p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Permission</span>
                    <Badge variant="outline" className={`text-[10px] h-5 ${permissionBadgeClasses[comparePolicy.permissionLevel] ?? ''}`}>
                      {comparePolicy.permissionLevel}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Resource</span>
                    <span className="font-mono tabular-nums">{comparePolicy.resource}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Action</span>
                    <span className="font-mono tabular-nums">{comparePolicy.action}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Enabled</span>
                    <span className={comparePolicy.enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                      {comparePolicy.enabled ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              )}

              {/* Version history for compare */}
              {compareHistory && compareHistory.history.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
                    <Clock className="h-3 w-3" />
                    Version History ({compareHistory.history.length})
                  </div>
                  <ScrollArea className="max-h-32">
                    <div className="space-y-1">
                      {compareHistory.history.slice(0, 5).map((entry) => (
                        <div key={entry.id} className="flex items-center gap-2 text-[11px] py-0.5">
                          <span className="font-mono tabular-nums text-muted-foreground shrink-0">
                            {new Date(entry.timestamp).toLocaleDateString()}
                          </span>
                          <span className="truncate">{entry.description}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ===== Empty State ===== */}
      {!hasBothSelected && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="border-0 shadow-sm glass-card">
            <CardContent className="py-16 flex flex-col items-center justify-center text-muted-foreground gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/30">
                <GitCompare className="h-8 w-8" />
              </div>
              <p className="text-sm font-medium">Select two policies to compare</p>
              <p className="text-xs text-muted-foreground">Choose a base and compare version above to see the diff</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ===== Side-by-Side Diff View ===== */}
      {hasBothSelected && diffResult && (
        <>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="border-0 shadow-sm glass-card glow-hover">
              <CardHeader className="pb-2 pt-4 px-4 md:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-sm font-semibold">Side-by-Side Diff</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] h-5">
                      {diffResult.changes.length} change{diffResult.changes.length !== 1 ? 's' : ''}
                    </Badge>
                    <div className={`flex items-center gap-1 text-xs font-medium ${diffResult.risk.color}`}>
                      {diffResult.risk.icon}
                      {diffResult.risk.level}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 md:px-6 pb-4 md:pb-6">
                <ScrollArea className="max-h-96">
                  <div className="space-y-1">
                    {/* Header row */}
                    <div className="grid grid-cols-[140px_1fr_24px_1fr] gap-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider pb-2 border-b border-border/50">
                      <span>Field</span>
                      <span className="flex items-center gap-1">
                        <span className="flex h-4 w-4 items-center justify-center rounded bg-blue-500/10 text-[9px] font-bold text-blue-600 dark:text-blue-400">A</span>
                        Base
                      </span>
                      <span />
                      <span className="flex items-center gap-1">
                        <span className="flex h-4 w-4 items-center justify-center rounded bg-emerald-500/10 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">B</span>
                        Compare
                      </span>
                    </div>

                    {/* Field rows */}
                    {DIFF_FIELDS.map(({ key, label }) => {
                      const baseVal = formatFieldValue(key, basePolicy[key])
                      const compVal = formatFieldValue(key, comparePolicy[key])
                      const isChanged = baseVal !== compVal

                      return (
                        <div
                          key={key}
                          className={`grid grid-cols-[140px_1fr_24px_1fr] gap-2 items-start py-2 px-3 rounded-md transition-colors duration-150 ${
                            isChanged ? 'bg-emerald-500/5' : ''
                          }`}
                        >
                          {/* Field label */}
                          <span className="text-xs font-medium text-muted-foreground">{label}</span>

                          {/* Base value */}
                          <div className={`text-xs font-mono tabular-nums break-all ${isChanged ? 'text-red-700 dark:text-red-400' : ''}`}>
                            {key === 'permissionLevel' ? (
                              <Badge variant="outline" className={`text-[10px] h-5 ${permissionBadgeClasses[basePolicy.permissionLevel] ?? ''}`}>
                                {baseVal}
                              </Badge>
                            ) : key === 'enabled' ? (
                              <span className={basePolicy.enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                                {baseVal}
                              </span>
                            ) : (
                              baseVal
                            )}
                          </div>

                          {/* Arrow indicator */}
                          <div className="flex items-center justify-center">
                            {isChanged ? (
                              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}>
                                <ArrowRight className="h-3.5 w-3.5 text-amber-500" />
                              </motion.div>
                            ) : (
                              <span className="text-muted-foreground/30">=</span>
                            )}
                          </div>

                          {/* Compare value */}
                          <div className={`text-xs font-mono tabular-nums break-all ${
                            isChanged
                              ? key === 'permissionLevel'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-emerald-700 dark:text-emerald-400'
                              : ''
                          }`}>
                            {key === 'permissionLevel' ? (
                              <Badge variant="outline" className={`text-[10px] h-5 ${permissionBadgeClasses[comparePolicy.permissionLevel] ?? ''}`}>
                                {compVal}
                              </Badge>
                            ) : key === 'enabled' ? (
                              <span className={comparePolicy.enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                                {compVal}
                              </span>
                            ) : (
                              compVal
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </motion.div>

          {/* ===== Change Summary + Condition Rules Diff ===== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Change Summary Card */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="border-0 shadow-sm glass-card glow-hover">
                <CardHeader className="pb-2 pt-4 px-4 md:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-sm font-semibold">Change Summary</span>
                    </div>
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${diffResult.risk.color}`}>
                      {diffResult.risk.icon}
                      {diffResult.risk.level}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 md:px-6 pb-4 md:pb-6">
                  {diffResult.changes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                      <Shield className="h-6 w-6" />
                      <p className="text-xs">No differences found — policies are identical</p>
                    </div>
                  ) : (
                    <ScrollArea className="max-h-72">
                      <div className="space-y-2">
                        {/* Summary stats */}
                        <div className="flex items-center gap-3 mb-3">
                          <Badge variant="outline" className="text-[10px] h-5 font-mono tabular-nums">
                            {diffResult.changes.length} field{diffResult.changes.length !== 1 ? 's' : ''} changed
                          </Badge>
                          {diffResult.changes.some((c) => c.key === 'permissionLevel') && (
                            <Badge className="text-[10px] h-5 bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20">
                              Permission change
                            </Badge>
                          )}
                        </div>

                        {/* Individual changes */}
                        {diffResult.changes.map((change) => (
                          <div
                            key={change.key}
                            className={`rounded-md px-3 py-2 text-xs ${
                              change.key === 'permissionLevel'
                                ? 'bg-red-500/10 border-l-2 border-red-500'
                                : change.key === 'conditionRules' || change.key === 'action'
                                  ? 'bg-amber-500/10 border-l-2 border-amber-500'
                                  : 'bg-emerald-500/10 border-l-2 border-emerald-500'
                            }`}
                          >
                            <div className="font-medium mb-1">{change.field}</div>
                            <div className="font-mono tabular-nums space-y-0.5">
                              <div className="text-red-700 dark:text-red-400">
                                <Minus className="h-3 w-3 inline mr-1" />
                                {change.displayBase}
                              </div>
                              <div className="text-emerald-700 dark:text-emerald-400">
                                <Plus className="h-3 w-3 inline mr-1" />
                                {change.displayCompare}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Condition Rules Diff */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <Card className="border-0 shadow-sm glass-card glow-hover">
                <CardHeader className="pb-2 pt-4 px-4 md:px-6">
                  <div className="flex items-center gap-2">
                    <GitCompare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-sm font-semibold">Condition Rules Diff</span>
                  </div>
                </CardHeader>
                <CardContent className="px-4 md:px-6 pb-4 md:pb-6">
                  <ConditionRulesDiff
                    baseRules={basePolicy.conditionRules}
                    compareRules={comparePolicy.conditionRules}
                  />
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* ===== Impact Analysis ===== */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="border-0 shadow-sm glass-card glow-hover">
              <CardHeader className="pb-2 pt-4 px-4 md:px-6">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm font-semibold">Impact Analysis</span>
                </div>
              </CardHeader>
              <CardContent className="px-4 md:px-6 pb-4 md:pb-6">
                {impactAnalysis ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Affected Traces */}
                    <div className="rounded-lg bg-muted/30 p-4 space-y-2">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Affected Traces</p>
                      <p className="text-2xl font-extrabold font-mono tabular-nums leading-tight">{impactAnalysis.affectedTraces}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Matching <span className="font-mono">{basePolicy.agentRole}</span> role
                      </p>
                    </div>

                    {/* Block Rate Change */}
                    <div className="rounded-lg bg-muted/30 p-4 space-y-2">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">BLOCK Rate</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-extrabold font-mono tabular-nums leading-tight">{impactAnalysis.blockRate}%</p>
                        {impactAnalysis.blockRateDelta !== 0 && (
                          <span className={`text-xs font-mono tabular-nums font-medium ${impactAnalysis.blockRateDelta > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {impactAnalysis.blockRateDelta > 0 ? '+' : ''}{Math.round(impactAnalysis.blockRateDelta * 100)}%
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">Estimated change in block decisions</p>
                    </div>

                    {/* Review Rate Change */}
                    <div className="rounded-lg bg-muted/30 p-4 space-y-2">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">REQUIRE_APPROVAL Rate</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-extrabold font-mono tabular-nums leading-tight">{impactAnalysis.reviewRate}%</p>
                        {impactAnalysis.reviewRateDelta !== 0 && (
                          <span className={`text-xs font-mono tabular-nums font-medium ${impactAnalysis.reviewRateDelta > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {impactAnalysis.reviewRateDelta > 0 ? '+' : ''}{Math.round(impactAnalysis.reviewRateDelta * 100)}%
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">Estimated change in review decisions</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                    <BarChart3 className="h-6 w-6" />
                    <p className="text-xs">Loading impact analysis...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}

      {/* ===== Diff History Timeline ===== */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <Card className="border-0 shadow-sm glass-card glow-hover">
          <CardHeader className="pb-2 pt-4 px-4 md:px-6">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-semibold">Diff History Timeline</span>
              {auditData && auditData.total > 0 && (
                <Badge variant="outline" className="text-[10px] h-5 font-mono tabular-nums ml-2">
                  {auditData.total}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-4 md:px-6 pb-4 md:pb-6">
            {auditData && auditData.logs.length > 0 ? (
              <ScrollArea className="max-h-64">
                <div className="relative pl-6">
                  {/* Timeline line */}
                  <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />

                  <AnimatePresence>
                    {auditData.logs.map((log, i) => {
                      let details: Record<string, unknown> = {}
                      try { details = JSON.parse(log.details) } catch { /* empty */ }

                      return (
                        <motion.div
                          key={log.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="relative flex items-start gap-3 pb-4 cursor-pointer group"
                          onClick={() => handleTimelineClick(log)}
                        >
                          {/* Timeline dot */}
                          <div className="absolute left-[-18px] top-1.5 flex h-3 w-3 items-center justify-center">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 group-hover:scale-150 transition-transform duration-200" />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0 rounded-md px-3 py-2 bg-muted/20 group-hover:bg-muted/40 transition-colors duration-150">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <Shield className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span className="text-xs font-medium truncate">
                                  {String(details.name ?? details.policyId ?? log.actor)}
                                </span>
                              </div>
                              <span className="text-[10px] text-muted-foreground font-mono tabular-nums shrink-0">
                                {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                              {(() => {
                                try {
                                  const d = JSON.parse(log.details)
                                  const fields = d.updatedFields as string[] | undefined
                                  return fields?.length ? `Updated ${fields.join(', ')}` : 'Policy was updated'
                                } catch {
                                  return 'Policy update'
                                }
                              })()}
                            </p>
                          </div>

                          {/* Click hint */}
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors duration-150 shrink-0 mt-2" />
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                <Clock className="h-6 w-6" />
                <p className="text-xs">No policy update events in audit log</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
