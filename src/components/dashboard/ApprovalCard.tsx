'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { CheckCircle, XCircle, Edit3, Clock, Bot, Wrench, Loader2, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'

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

interface ApprovalCardProps {
  approval: ApprovalWithTrace
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  APPROVED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  REJECTED: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  MODIFIED: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
}

function formatJsonSafe(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2)
  } catch {
    return str
  }
}

// Urgency level based on wait time
type UrgencyLevel = 'normal' | 'waiting' | 'urgent'

function getUrgency(createdAt: string): { level: UrgencyLevel; label: string; pct: number } {
  const now = Date.now()
  const created = new Date(createdAt).getTime()
  const hoursElapsed = (now - created) / (1000 * 60 * 60)

  if (hoursElapsed > 4) {
    // Urgent: > 4 hours, fill percentage based on max 8h scale
    const pct = Math.min((hoursElapsed / 8) * 100, 100)
    return { level: 'urgent', label: 'Urgent', pct }
  }
  if (hoursElapsed > 1) {
    // Waiting: 1-4 hours
    const pct = (hoursElapsed / 4) * 100
    return { level: 'waiting', label: 'Waiting', pct }
  }
  // Normal: < 1 hour
  const pct = (hoursElapsed / 1) * 100
  return { level: 'normal', label: '', pct }
}

function LiveTimeWaiting({ createdAt }: { createdAt: string }) {
  const [timeStr, setTimeStr] = useState('')

  useEffect(() => {
    const update = () => {
      setTimeStr(formatDistanceToNow(new Date(createdAt), { addSuffix: true }))
    }
    update()
    const interval = setInterval(update, 15000)
    return () => clearInterval(interval)
  }, [createdAt])

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
      <Clock className="h-3 w-3" />
      {timeStr}
    </div>
  )
}

export function ApprovalCard({ approval }: ApprovalCardProps) {
  const queryClient = useQueryClient()
  const [modifyOpen, setModifyOpen] = useState(false)
  const [contextOpen, setContextOpen] = useState(false)
  const [modifiedAction, setModifiedAction] = useState(() => {
    if (approval.requestedAction) {
      try {
        return JSON.stringify(JSON.parse(approval.requestedAction), null, 2)
      } catch {
        return approval.requestedAction
      }
    }
    return '{}'
  })

  const actionMutation = useMutation({
    mutationFn: async ({ requestId, status, modifiedAction: ma }: { requestId: string; status: string; modifiedAction?: string }) => {
      const body: Record<string, unknown> = {
        status,
        humanReviewerId: 'current-user',
      }
      if (ma) {
        try {
          body.modifiedAction = JSON.parse(ma)
        } catch {
          body.modifiedAction = ma
        }
      }
      const res = await fetch(`/api/approvals/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      toast.success('Decision submitted')
      setModifyOpen(false)
    },
    onError: () => toast.error('Failed to submit decision'),
  })

  const isPending = approval.status === 'PENDING'

  // Calculate urgency for pending approvals
  const urgency = isPending ? getUrgency(approval.createdAt) : null

  return (
    <>
      <Card className="group hover:shadow-md hover:border-emerald-500/30 transition-all duration-300 border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 shrink-0">
                <Bot className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{approval.trace.agentRole}</span>
                  <Badge variant="outline" className={`transition-transform duration-150 hover:scale-105 ${statusColors[approval.status] ?? ''}`}>
                    {approval.status}
                  </Badge>
                  {/* Urgency badge */}
                  {urgency && urgency.level !== 'normal' && (
                    <Badge
                      variant="outline"
                      className={
                        urgency.level === 'urgent'
                          ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 text-[10px] gap-1 urgency-pulse'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] gap-1'
                      }
                    >
                      {urgency.level === 'urgent' ? (
                        <AlertTriangle className="h-3 w-3" />
                      ) : (
                        <Clock className="h-3 w-3" />
                      )}
                      {urgency.label}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Wrench className="h-3 w-3" />
                  {approval.trace.toolName}
                </div>
              </div>
            </div>
            <LiveTimeWaiting createdAt={approval.createdAt} />
          </div>

          {/* Wait time progress bar */}
          {urgency && (
            <div className="space-y-0.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">Wait time</span>
                <span className={
                  urgency.level === 'urgent' ? 'text-red-500 font-medium'
                  : urgency.level === 'waiting' ? 'text-amber-500 font-medium'
                  : 'text-muted-foreground'
                }>
                  {urgency.level === 'urgent' ? '>4h' : urgency.level === 'waiting' ? '1-4h' : '<1h'}
                </span>
              </div>
              <div className="h-1 bg-muted/50 rounded-full overflow-hidden">
                <div
                  className={
                    urgency.level === 'urgent' ? 'h-full bg-red-500 rounded-full transition-all duration-500'
                    : urgency.level === 'waiting' ? 'h-full bg-amber-500 rounded-full transition-all duration-500'
                    : 'h-full bg-emerald-500 rounded-full transition-all duration-500'
                  }
                  style={{ width: `${urgency.pct}%` }}
                />
              </div>
            </div>
          )}

          {/* Requested Action */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Requested Action</Label>
            <pre className="text-xs font-mono bg-muted/50 dark:bg-muted/30 rounded-md p-2 overflow-x-auto max-h-24 custom-scrollbar">
              {formatJsonSafe(approval.requestedAction)}
            </pre>
          </div>

          {/* Collapsible Agent Context */}
          <Collapsible open={contextOpen} onOpenChange={setContextOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 text-xs w-full justify-center hover:bg-muted transition-colors duration-200">
                {contextOpen ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                {contextOpen ? 'Hide' : 'Show'} Agent Context
              </Button>
            </CollapsibleTrigger>
            <AnimatePresence>
              {contextOpen && (
                <CollapsibleContent asChild>
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <pre className="text-xs font-mono bg-muted/50 dark:bg-muted/30 rounded-md p-2 overflow-x-auto max-h-32 custom-scrollbar mt-2">
                      {formatJsonSafe(approval.agentContext)}
                    </pre>
                  </motion.div>
                </CollapsibleContent>
              )}
            </AnimatePresence>
          </Collapsible>

          {/* Matched Policy */}
          {approval.trace.policy && (
            <div className="text-xs text-muted-foreground">
              Policy: <span className="font-medium text-foreground">{approval.trace.policy.name}</span>
            </div>
          )}

          {/* Review Notes */}
          {approval.reviewNotes && (
            <div className="text-xs text-muted-foreground">
              Review: {approval.reviewNotes}
              {approval.humanReviewerId && (
                <span className="ml-1">by {approval.humanReviewerId}</span>
              )}
            </div>
          )}

          {/* Actions */}
          {isPending && (
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex-1 active:scale-[0.98] transition-transform"
                onClick={() => actionMutation.mutate({ requestId: approval.requestId, status: 'APPROVED' })}
                disabled={actionMutation.isPending}
              >
                <CheckCircle className="h-3 w-3 mr-1" /> Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-xs flex-1 active:scale-[0.98] transition-transform"
                onClick={() => actionMutation.mutate({ requestId: approval.requestId, status: 'REJECTED' })}
                disabled={actionMutation.isPending}
              >
                <XCircle className="h-3 w-3 mr-1" /> Reject
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 flex-1 active:scale-[0.98] transition-transform"
                onClick={() => setModifyOpen(true)}
              >
                <Edit3 className="h-3 w-3 mr-1" /> Modify
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modify Dialog - full screen on mobile */}
      <Dialog open={modifyOpen} onOpenChange={setModifyOpen}>
        <DialogContent className="sm:max-w-lg dialog-fullscreen-mobile backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle className="tracking-tight">Modify Action</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Original Action</Label>
              <pre className="text-xs font-mono bg-muted/50 dark:bg-muted/30 rounded-md p-2 overflow-x-auto max-h-32 custom-scrollbar opacity-50">
                {formatJsonSafe(approval.requestedAction)}
              </pre>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Modified Action (JSON)</Label>
              <Textarea
                className="text-xs font-mono min-h-[100px]"
                value={modifiedAction}
                onChange={(e) => setModifiedAction(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModifyOpen(false)} className="h-8 text-sm active:scale-[0.98] transition-transform">
              Cancel
            </Button>
            <Button
              className="h-8 text-sm bg-amber-600 hover:bg-amber-700 text-white active:scale-[0.98] transition-transform"
              onClick={() => actionMutation.mutate({ requestId: approval.requestId, status: 'MODIFIED', modifiedAction })}
              disabled={actionMutation.isPending}
            >
              {actionMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              Submit Modified
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
