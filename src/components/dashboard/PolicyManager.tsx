'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { PolicyForm } from './PolicyForm'
import { PolicyVersionHistory } from './PolicyVersionHistory'
import { PolicyConflictDetector } from './PolicyConflictDetector'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Pencil, Trash2, Shield, Download, Upload, Clock, ToggleLeft, ToggleRight, X, Target, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/lib/store'

interface Policy {
  id: string
  policyId: string
  name: string
  description?: string
  agentRole: string
  resource: string
  action: string
  permissionLevel: string
  conditionRules?: string | null
  priority: number
  enabled: boolean
  createdAt: string
  updatedAt: string
}

const decisionColor: Record<string, string> = {
  ALLOW: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  BLOCK: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  REQUIRE_APPROVAL: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
}

const rowBg: Record<string, string> = {
  ALLOW: 'hover:bg-emerald-500/[0.04] dark:hover:bg-emerald-500/[0.06]',
  BLOCK: 'hover:bg-red-500/[0.04] dark:hover:bg-red-500/[0.06]',
  REQUIRE_APPROVAL: 'hover:bg-amber-500/[0.04] dark:hover:bg-amber-500/[0.06]',
}

const rowBorder: Record<string, string> = {
  ALLOW: 'border-l-2 border-l-emerald-500/40',
  BLOCK: 'border-l-2 border-l-red-500/40',
  REQUIRE_APPROVAL: 'border-l-2 border-l-amber-500/40',
}

// ─── Policy Impact Score Component ────────────────────────────────────────────

const IMPACT_ROLE_COLORS: Record<string, string> = {
  DataAgent: '#06b6d4',
  CodeAgent: '#8b5cf6',
  FinanceAgent: '#f59e0b',
  SupportAgent: '#f43f5e',
}

interface ImpactTrace {
  traceId: string
  agentRole: string
  toolName: string
  evaluationResult: string
  timestamp: string
  latency: number
}

interface ImpactStats {
  totalPolicies: number
  policyBreakdown: Record<string, number>
  totalTraces: number
  traceBreakdown: Record<string, number>
  pendingApprovals: number
  recentTracesCount: number
  recentTraces: ImpactTrace[]
  averageLatency: number
  auditLogCount: number
  policiesByRole: Record<string, number>
}

function PolicyImpactScore() {
  const timeRange = useAppStore((s) => s.timeRange)

  const { data: stats } = useQuery<ImpactStats>({
    queryKey: ['stats', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/stats?timeRange=${timeRange}`)
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    refetchInterval: 30000,
  })

  const { data: tracesData } = useQuery<{ traces: ImpactTrace[] }>({
    queryKey: ['traces-impact', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/traces?limit=100&timeRange=${timeRange}`)
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    refetchInterval: 30000,
  })

  const traces = tracesData?.traces ?? []

  const impactData = useMemo(() => {
    const total = traces.length
    if (total === 0) {
      return { overallScore: 0, trendUp: true, roleScores: [] as Array<{ role: string; score: number; traces: number }> }
    }

    // Impact score = (BLOCK harmful + ALLOW safe) / total traces
    // BLOCK = correct blocking of harmful actions, ALLOW = correct allowing of safe actions
    // We treat all ALLOW and BLOCK as "correct" decisions
    const correctDecisions = traces.filter(t => t.evaluationResult === 'BLOCK' || t.evaluationResult === 'ALLOW').length
    const overallScore = Math.round((correctDecisions / total) * 100)

    // Per-role scores
    const roleMap = new Map<string, { correct: number; total: number }>()
    traces.forEach(t => {
      const existing = roleMap.get(t.agentRole) ?? { correct: 0, total: 0 }
      existing.total++
      if (t.evaluationResult === 'BLOCK' || t.evaluationResult === 'ALLOW') existing.correct++
      roleMap.set(t.agentRole, existing)
    })

    const roleScores = Array.from(roleMap.entries()).map(([role, data]) => ({
      role,
      score: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
      traces: data.total,
    })).sort((a, b) => b.score - a.score)

    return { overallScore, trendUp: overallScore >= 70, roleScores }
  }, [traces])

  const { overallScore, trendUp, roleScores } = impactData
  const scoreColor = overallScore >= 80 ? '#10b981' : overallScore >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <Card className="border-0 shadow-sm glass-card glow-hover corner-accent">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Target className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Policy Impact Score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Large score with trend */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-16 w-16 rounded-xl border border-border/50 bg-muted/30">
              <span className="text-2xl font-bold tabular-nums font-mono" style={{ color: scoreColor }}>
                {overallScore}
              </span>
            </div>
            <div>
              <div className="text-sm font-semibold">Overall Effectiveness</div>
              <div className="flex items-center gap-1 text-xs">
                {trendUp ? (
                  <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                )}
                <span className={trendUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                  {trendUp ? 'Effective' : 'Needs improvement'}
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                (BLOCK + ALLOW) / total decisions
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground">Traces analyzed</div>
            <div className="font-mono tabular-nums font-bold text-lg">{traces.length}</div>
          </div>
        </div>

        {/* Role breakdown bars */}
        <div className="space-y-2.5">
          <div className="text-xs font-medium text-muted-foreground">Impact by Agent Role</div>
          {roleScores.map((rs) => {
            const color = IMPACT_ROLE_COLORS[rs.role] ?? '#888'
            const barWidth = Math.max(rs.score, 2)
            return (
              <div key={rs.role} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span>{rs.role.replace('Agent', '')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-[10px]">{rs.traces} traces</span>
                    <span className="font-mono tabular-nums font-medium">{rs.score}%</span>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${barWidth}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: color, opacity: 0.8 }}
                  />
                </div>
              </div>
            )
          })}
          {roleScores.length === 0 && (
            <div className="text-center text-muted-foreground text-xs py-4">No trace data available</div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function PolicyManager() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [filterLevel, setFilterLevel] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editPolicy, setEditPolicy] = useState<Policy | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Policy | null>(null)
  const [historyPolicyId, setHistoryPolicyId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const queryParams = new URLSearchParams()
  if (filterRole !== 'all') queryParams.set('agentRole', filterRole)
  if (filterLevel !== 'all') queryParams.set('permissionLevel', filterLevel)

  const { data: policies = [], isLoading } = useQuery<Policy[]>({
    queryKey: ['policies', filterRole, filterLevel],
    queryFn: async () => {
      const res = await fetch(`/api/policies?${queryParams.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch policies')
      return res.json()
    },
  })

  const filteredPolicies = policies.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.agentRole.toLowerCase().includes(search.toLowerCase()) ||
      p.resource.toLowerCase().includes(search.toLowerCase())
  )

  const toggleMutation = useMutation({
    mutationFn: async ({ policyId, enabled }: { policyId: string; enabled: boolean }) => {
      const res = await fetch(`/api/policies/${policyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] })
      toast.success('Policy status updated')
    },
    onError: () => toast.error('Failed to update policy'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (policyId: string) => {
      const res = await fetch(`/api/policies/${policyId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      toast.success('Policy deleted')
      setDeleteTarget(null)
    },
    onError: () => toast.error('Failed to delete policy'),
  })

  const bulkMutation = useMutation({
    mutationFn: async ({ policyIds, action }: { policyIds: string[], action: 'enable' | 'disable' | 'delete' }) => {
      const res = await fetch('/api/policies/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policyIds, action }),
      })
      if (!res.ok) throw new Error('Bulk operation failed')
      return res.json()
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['policies'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      const label = variables.action === 'enable' ? 'enabled' : variables.action === 'disable' ? 'disabled' : 'deleted'
      toast.success(`${variables.policyIds.length} policies ${label}`)
      setSelectedIds(new Set())
    },
    onError: () => toast.error('Bulk operation failed'),
  })

  const toggleSelect = (policyId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(policyId)) next.delete(policyId)
      else next.add(policyId)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredPolicies.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredPolicies.map(p => p.policyId)))
    }
  }

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(policies, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `agentshield-policies-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${policies.length} policies`)
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const imported = JSON.parse(text)
        if (!Array.isArray(imported)) {
          toast.error('Invalid format: expected an array of policies')
          return
        }
        toast.info(`Found ${imported.length} policies in file. Import feature coming soon.`)
      } catch {
        toast.error('Failed to parse JSON file')
      }
    }
    input.click()
  }

  return (
    <div className="p-4 md:p-6 space-y-4 relative">
      {/* Dot grid background */}
      <div className="absolute inset-0 dot-grid opacity-30 pointer-events-none rounded-xl" />

      <div className="section-header-gradient section-header-accent rounded-xl px-4 py-3 -mx-4 -mt-2 md:-mx-6 md:-mt-4 mb-2 relative overflow-hidden">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight gradient-text-shimmer">Policy Management</h2>
            <Badge variant="secondary" className="text-xs font-mono tabular-nums">{policies.length}</Badge>
          </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" className="h-8 text-xs active:scale-[0.98] transition-transform" onClick={handleExport}>
            <Download className="h-3 w-3 mr-1" /> Export
          </Button>
          <Button variant="outline" className="h-8 text-xs active:scale-[0.98] transition-transform" onClick={handleImport}>
            <Upload className="h-3 w-3 mr-1" /> Import
          </Button>
          <Button
            className="h-8 text-sm bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98] transition-transform"
            onClick={() => {
              setEditPolicy(null)
              setFormOpen(true)
            }}
          >
            <Plus className="h-3 w-3 mr-1" /> New Policy
          </Button>
        </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">Create and manage AI agent governance policies</p>
      </div>

      {/* Filter Bar - wraps on mobile */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="h-8 text-sm pl-8"
            placeholder="Search policies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="h-8 text-sm w-full sm:w-36">
            <SelectValue placeholder="Agent Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="DataAgent">DataAgent</SelectItem>
            <SelectItem value="CodeAgent">CodeAgent</SelectItem>
            <SelectItem value="FinanceAgent">FinanceAgent</SelectItem>
            <SelectItem value="SupportAgent">SupportAgent</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterLevel} onValueChange={setFilterLevel}>
          <SelectTrigger className="h-8 text-sm w-full sm:w-40">
            <SelectValue placeholder="Permission Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="ALLOW">Allow</SelectItem>
            <SelectItem value="BLOCK">Block</SelectItem>
            <SelectItem value="REQUIRE_APPROVAL">Require Approval</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Action Bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="sticky top-0 z-20 flex items-center gap-2 rounded-lg border bg-card/95 backdrop-blur-sm px-4 py-2 shadow-md"
          >
            <Badge variant="secondary" className="text-xs font-mono tabular-nums">{selectedIds.size} selected</Badge>
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950/50 active:scale-[0.98] transition-transform"
              onClick={() => bulkMutation.mutate({ policyIds: Array.from(selectedIds), action: 'enable' })}
              disabled={bulkMutation.isPending}
            >
              <ToggleRight className="h-3 w-3 mr-1" /> Enable
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs text-amber-600 border-amber-200 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-950/50 active:scale-[0.98] transition-transform"
              onClick={() => bulkMutation.mutate({ policyIds: Array.from(selectedIds), action: 'disable' })}
              disabled={bulkMutation.isPending}
            >
              <ToggleLeft className="h-3 w-3 mr-1" /> Disable
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/50 active:scale-[0.98] transition-transform"
              onClick={() => {
                if (confirm(`Delete ${selectedIds.size} policies? This cannot be undone.`)) {
                  bulkMutation.mutate({ policyIds: Array.from(selectedIds), action: 'delete' })
                }
              }}
              disabled={bulkMutation.isPending}
            >
              <Trash2 className="h-3 w-3 mr-1" /> Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs active:scale-95 transition-transform"
              onClick={() => setSelectedIds(new Set())}
            >
              <X className="h-3 w-3 mr-1" /> Clear
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Policy Table - horizontally scrollable on mobile */}
      <Card className="border-0 shadow-sm glass-card corner-accent">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : filteredPolicies.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">No policies configured</p>
              <p className="text-xs mt-1">Create your first policy to start governing AI agent actions</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-10">
                      <Checkbox
                        checked={filteredPolicies.length > 0 && selectedIds.size === filteredPolicies.length}
                        onCheckedChange={toggleSelectAll}
                        className="h-3.5 w-3.5"
                      />
                    </TableHead>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Agent Role</TableHead>
                    <TableHead className="text-xs">Resource</TableHead>
                    <TableHead className="text-xs">Action</TableHead>
                    <TableHead className="text-xs">Permission</TableHead>
                    <TableHead className="text-xs">Priority</TableHead>
                    <TableHead className="text-xs">Enabled</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPolicies.map((policy) => (
                    <TableRow
                      key={policy.policyId}
                      className={cn(
                        'transition-all duration-150 table-row-hover',
                        rowBg[policy.permissionLevel] ?? '',
                        rowBorder[policy.permissionLevel] ?? ''
                      )}
                    >
                      <TableCell className="w-10 sticky-first-col bg-card">
                        <Checkbox
                          checked={selectedIds.has(policy.policyId)}
                          onCheckedChange={() => toggleSelect(policy.policyId)}
                          className="h-3.5 w-3.5"
                        />
                      </TableCell>
                      <TableCell className="text-sm font-medium max-w-[180px] truncate">
                        {policy.name}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{policy.agentRole}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{policy.resource}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{policy.action}</TableCell>
                      <TableCell>
                        <Badge className={`transition-transform duration-150 hover:scale-105 badge-glow text-xs ${decisionColor[policy.permissionLevel] ?? ''}`} variant="outline">
                          {policy.permissionLevel === 'REQUIRE_APPROVAL' ? 'APPROVAL' : policy.permissionLevel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono tabular-nums">{policy.priority}</TableCell>
                      <TableCell>
                        <Switch
                          checked={policy.enabled}
                          onCheckedChange={(checked) =>
                            toggleMutation.mutate({ policyId: policy.policyId, enabled: checked })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-muted transition-colors duration-200 active:scale-95"
                            onClick={() => {
                              setEditPolicy(policy)
                              setFormOpen(true)
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-muted transition-colors duration-200 active:scale-95"
                            onClick={() => setHistoryPolicyId(policy.policyId)}
                          >
                            <Clock className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-500/10 transition-colors duration-200 active:scale-95"
                            onClick={() => setDeleteTarget(policy)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Policy Conflict Detector */}
      <PolicyConflictDetector />

      {/* Policy Impact Score */}
      <PolicyImpactScore />

      {/* Create/Edit Dialog */}
      <PolicyForm open={formOpen} onOpenChange={setFormOpen} policy={editPolicy} />

      {/* Version History Sheet */}
      {historyPolicyId && (
        <PolicyVersionHistory
          policyId={historyPolicyId}
          open={!!historyPolicyId}
          onOpenChange={(open) => { if (!open) setHistoryPolicyId(null) }}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Policy</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This action cannot be
              undone. All associated traces will lose their policy reference.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.policyId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
