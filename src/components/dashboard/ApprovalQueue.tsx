'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ApprovalCard } from './ApprovalCard'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckSquare, CheckCircle, XCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAppStore } from '@/lib/store'
import { useState, useMemo } from 'react'
import { toast } from 'sonner'

interface ApprovalWithTrace {
  id: string
  requestId: string
  traceId: string
  agentContext: string
  requestedAction: string
  status: string
  humanReviewerId?: string | null
  reviewNotes?: string | null
  modifiedAction?: string | null
  reviewTimestamp?: string | null
  createdAt: string
  trace: {
    traceId: string
    agentRole: string
    toolName: string
    intentPayload: string
    evaluationResult: string
    timestamp: string
    policy?: {
      policyId: string
      name: string
      permissionLevel: string
    } | null
  }
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  APPROVED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  REJECTED: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  MODIFIED: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
}

export function ApprovalQueue() {
  const wsConnected = useAppStore((s) => s.wsConnected)
  const queryClient = useQueryClient()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const { data: pendingApprovals = [], isLoading: pendingLoading } = useQuery<ApprovalWithTrace[]>({
    queryKey: ['approvals', 'PENDING'],
    queryFn: async () => {
      const res = await fetch('/api/approvals?status=PENDING')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    refetchInterval: 15000,
  })

  const { data: allApprovals = [], isLoading: allLoading } = useQuery<ApprovalWithTrace[]>({
    queryKey: ['approvals', 'ALL'],
    queryFn: async () => {
      const res = await fetch('/api/approvals')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    refetchInterval: 30000,
  })

  const historyApprovals = allApprovals.filter((a) => a.status !== 'PENDING')

  // Batch actions
  const batchMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      const results = await Promise.all(
        ids.map(async (requestId) => {
          const res = await fetch(`/api/approvals/${requestId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, humanReviewerId: 'current-user' }),
          })
          return res.ok
        })
      )
      return results
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      setSelectedIds(new Set())
      toast.success(`Batch ${variables.status.toLowerCase()}: ${variables.ids.length} approvals`)
    },
    onError: () => toast.error('Batch action failed'),
  })

  const toggleSelect = (requestId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(requestId)) next.delete(requestId)
      else next.add(requestId)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === pendingApprovals.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pendingApprovals.map((a) => a.requestId)))
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 relative">
      <div className="absolute inset-0 dot-grid opacity-30 pointer-events-none rounded-xl" />

      <div className="section-header-gradient section-header-accent rounded-xl px-4 py-3 -mx-4 -mt-2 md:-mx-6 md:-mt-4 mb-2 relative overflow-hidden">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2 gradient-text-shimmer">
              <CheckSquare className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Approval Queue
            </h2>
            <p className="text-sm text-muted-foreground">
              Review and manage human-in-the-loop approval requests
            </p>
          </div>
        <div className="flex items-center gap-3">
          {wsConnected && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Real-time
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Batch Actions - sticky on mobile */}
      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-20 flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border backdrop-blur-sm">
          <span className="text-xs font-medium tabular-nums">{selectedIds.size} selected</span>
          <Button
            size="sm"
            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98] transition-transform"
            onClick={() => batchMutation.mutate({ ids: Array.from(selectedIds), status: 'APPROVED' })}
            disabled={batchMutation.isPending}
          >
            <CheckCircle className="h-3 w-3 mr-1" /> Batch Approve
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-7 text-xs active:scale-[0.98] transition-transform"
            onClick={() => batchMutation.mutate({ ids: Array.from(selectedIds), status: 'REJECTED' })}
            disabled={batchMutation.isPending}
          >
            <XCircle className="h-3 w-3 mr-1" /> Batch Reject
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Pending Approvals */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          Pending
          <Badge variant="secondary" className="text-xs font-mono tabular-nums">{pendingApprovals.length}</Badge>
          {pendingApprovals.length > 0 && (
            <Checkbox
              checked={selectedIds.size === pendingApprovals.length && pendingApprovals.length > 0}
              onCheckedChange={toggleSelectAll}
              className="ml-2"
            />
          )}
        </h3>

        {pendingLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-3">
                  <div className="h-6 bg-muted animate-pulse rounded w-1/2" />
                  <div className="h-20 bg-muted animate-pulse rounded" />
                  <div className="h-16 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : pendingApprovals.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-16 flex flex-col items-center text-muted-foreground">
              <CheckCircle className="h-16 w-16 mb-4 text-emerald-500/20 subtle-pulse" />
              <p className="text-sm font-bold">All clear!</p>
              <p className="text-xs mt-1">All approval requests have been resolved</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pendingApprovals.map((approval) => (
              <div key={approval.requestId} className="relative">
                <Checkbox
                  checked={selectedIds.has(approval.requestId)}
                  onCheckedChange={() => toggleSelect(approval.requestId)}
                  className="absolute top-3 right-3 z-10"
                />
                <ApprovalCard approval={approval} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Response Time Distribution + Top Reviewers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Response Time Distribution */}
        <Card className="border-0 shadow-sm glass-card glow-hover">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Response Time Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {allLoading ? (
              <div className="h-32 skeleton-shimmer rounded" />
            ) : historyApprovals.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-muted-foreground text-xs">
                No completed approvals yet
              </div>
            ) : (
              <div className="space-y-3">
                {(() => {
                  // Calculate response times in hours
                  const responseTimes = historyApprovals
                    .filter(a => a.reviewTimestamp && a.createdAt)
                    .map(a => {
                      const created = new Date(a.createdAt).getTime()
                      const reviewed = new Date(a.reviewTimestamp!).getTime()
                      return (reviewed - created) / (1000 * 60 * 60) // hours
                    })

                  // Bucket into ranges
                  const buckets = [
                    { label: '< 1h', min: 0, max: 1, color: 'bg-emerald-500' },
                    { label: '1-4h', min: 1, max: 4, color: 'bg-teal-500' },
                    { label: '4-12h', min: 4, max: 12, color: 'bg-amber-500' },
                    { label: '12-24h', min: 12, max: 24, color: 'bg-orange-500' },
                    { label: '> 24h', min: 24, max: Infinity, color: 'bg-red-500' },
                  ]

                  const counts = buckets.map(b => ({
                    ...b,
                    count: responseTimes.filter(t => t >= b.min && t < b.max).length,
                  }))

                  const maxCount = Math.max(...counts.map(b => b.count), 1)

                  return (
                    <div className="flex items-end gap-2 h-32">
                      {counts.map((bucket) => (
                        <div key={bucket.label} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[10px] font-mono tabular-nums text-muted-foreground">{bucket.count}</span>
                          <div className="w-full flex items-end" style={{ height: '80px' }}>
                            <div
                              className={`w-full ${bucket.color} rounded-t transition-all duration-500 opacity-80`}
                              style={{ height: `${(bucket.count / maxCount) * 100}%`, minHeight: bucket.count > 0 ? '4px' : '0' }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground">{bucket.label}</span>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Reviewers */}
        <Card className="border-0 shadow-sm glass-card glow-hover">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top Reviewers</CardTitle>
          </CardHeader>
          <CardContent>
            {allLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-8 skeleton-shimmer rounded" />
                ))}
              </div>
            ) : historyApprovals.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-muted-foreground text-xs">
                No reviewer data yet
              </div>
            ) : (
              <div className="space-y-2">
                {(() => {
                  // Count reviewer actions
                  const reviewerMap = new Map<string, { approved: number; rejected: number }>()
                  historyApprovals.forEach(a => {
                    if (!a.humanReviewerId) return
                    const current = reviewerMap.get(a.humanReviewerId) ?? { approved: 0, rejected: 0 }
                    if (a.status === 'APPROVED' || a.status === 'MODIFIED') current.approved++
                    if (a.status === 'REJECTED') current.rejected++
                    reviewerMap.set(a.humanReviewerId, current)
                  })

                  // Sort by total actions
                  const reviewers = [...reviewerMap.entries()]
                    .map(([id, stats]) => ({ id, ...stats, total: stats.approved + stats.rejected }))
                    .sort((a, b) => b.total - a.total)
                    .slice(0, 5)

                  if (reviewers.length === 0) {
                    return (
                      <div className="h-32 flex items-center justify-center text-muted-foreground text-xs">
                        No reviewer data yet
                      </div>
                    )
                  }

                  // Color palette for avatars
                  const avatarColors = ['bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-amber-500', 'bg-violet-500']

                  return reviewers.map((reviewer, i) => (
                    <div key={reviewer.id} className="flex items-center gap-3 py-1">
                      {/* Colored circle with initials */}
                      <div className={`h-7 w-7 rounded-full ${avatarColors[i % avatarColors.length]} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                        {reviewer.id.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{reviewer.id}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400">{reviewer.approved} approved</span>
                          <span className="text-[10px] text-red-600 dark:text-red-400">{reviewer.rejected} rejected</span>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-[10px] h-5 font-mono tabular-nums">
                        {reviewer.total}
                      </Badge>
                    </div>
                  ))
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Approval History */}
      <div>
        <h3 className="text-sm font-semibold mb-3">History</h3>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            {allLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-10 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : historyApprovals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No approval history yet
              </div>
            ) : (
              <ScrollArea className="max-h-96">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Request ID</TableHead>
                        <TableHead className="text-xs">Agent</TableHead>
                        <TableHead className="text-xs">Tool</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Reviewer</TableHead>
                        <TableHead className="text-xs">Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyApprovals.map((a) => (
                        <TableRow key={a.requestId} className="transition-all duration-150 hover:bg-muted/30">
                          <TableCell className="text-xs font-mono max-w-[120px] truncate">
                            {a.requestId}
                          </TableCell>
                          <TableCell className="text-xs">{a.trace.agentRole}</TableCell>
                          <TableCell className="text-xs">{a.trace.toolName}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`transition-transform duration-150 hover:scale-105 ${statusColors[a.status] ?? ''}`}>
                              {a.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {a.humanReviewerId ?? '-'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {a.reviewTimestamp
                              ? formatDistanceToNow(new Date(a.reviewTimestamp), { addSuffix: true })
                              : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
