'use client'

import { Card, CardContent } from '@/components/ui/card'
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
import { CheckSquare, Inbox, CheckCircle, XCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAppStore } from '@/lib/store'
import { useState } from 'react'
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
  MODIFIED: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
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
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
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

      {/* Batch Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
          <span className="text-xs font-medium">{selectedIds.size} selected</span>
          <Button
            size="sm"
            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => batchMutation.mutate({ ids: Array.from(selectedIds), status: 'APPROVED' })}
            disabled={batchMutation.isPending}
          >
            <CheckCircle className="h-3 w-3 mr-1" /> Batch Approve
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-7 text-xs"
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
          <Badge variant="secondary" className="text-xs">{pendingApprovals.length}</Badge>
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
            <CardContent className="py-12 flex flex-col items-center text-muted-foreground">
              <Inbox className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm font-medium">No pending approvals</p>
              <p className="text-xs">All requests have been reviewed</p>
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
                      <TableRow key={a.requestId}>
                        <TableCell className="text-xs font-mono max-w-[120px] truncate">
                          {a.requestId}
                        </TableCell>
                        <TableCell className="text-xs">{a.trace.agentRole}</TableCell>
                        <TableCell className="text-xs">{a.trace.toolName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusColors[a.status] ?? ''}>
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
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
