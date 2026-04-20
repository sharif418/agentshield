'use client'

import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Activity, Shield, Clock, CheckSquare } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface TraceDetailProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trace: TraceRecord | null
}

interface TraceRecord {
  id: string
  traceId: string
  sessionId: string
  agentRole: string
  toolName: string
  intentPayload: string
  evaluationResult: string
  matchedPolicyId: string | null
  latency: number
  timestamp: string
  policy?: {
    policyId: string
    name: string
    permissionLevel: string
    action: string
    priority: number
  } | null
  approval?: {
    requestId: string
    status: string
    humanReviewerId?: string | null
    reviewNotes?: string | null
    modifiedAction?: string | null
    reviewTimestamp?: string | null
    createdAt: string
  } | null
}

const decisionColor: Record<string, string> = {
  ALLOW: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  BLOCK: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  REQUIRE_APPROVAL: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
}

const approvalStatusColors: Record<string, string> = {
  PENDING: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  APPROVED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  REJECTED: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  MODIFIED: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
}

function formatJsonSafe(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2)
  } catch {
    return str
  }
}

export function TraceDetail({ open, onOpenChange, trace }: TraceDetailProps) {
  if (!trace) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg w-full overflow-y-auto custom-scrollbar">
        <SheetHeader>
          <SheetTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Trace Detail
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* Trace Info */}
          <div className="space-y-2">
            {[
              { label: 'Trace ID', value: trace.traceId, mono: true },
              { label: 'Session', value: trace.sessionId, mono: true },
              { label: 'Agent Role', value: trace.agentRole, mono: false },
              { label: 'Tool', value: trace.toolName, mono: false },
              { label: 'Latency', value: `${trace.latency.toFixed(3)}ms`, mono: true },
              { label: 'Timestamp', value: formatDistanceToNow(new Date(trace.timestamp), { addSuffix: true }), mono: false },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{row.label}</span>
                <span className={`text-xs ${row.mono ? 'font-mono' : 'font-medium'}`}>{row.value}</span>
              </div>
            ))}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Result</span>
              <Badge variant="outline" className={decisionColor[trace.evaluationResult] ?? ''}>
                {trace.evaluationResult}
              </Badge>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Intent Payload */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold flex items-center gap-1.5">
              <Activity className="h-3 w-3" /> Intent Payload
            </h4>
            <pre className="text-xs font-mono bg-muted/50 dark:bg-muted/30 rounded-md p-3 overflow-x-auto max-h-48 custom-scrollbar">
              {formatJsonSafe(trace.intentPayload)}
            </pre>
          </div>

          <div className="border-t border-border" />

          {/* Matched Policy */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold flex items-center gap-1.5">
              <Shield className="h-3 w-3" /> Matched Policy
            </h4>
            {trace.policy ? (
              <div className="space-y-1.5 p-3 rounded-md bg-muted/50 dark:bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Name</span>
                  <span className="text-xs font-medium">{trace.policy.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Permission</span>
                  <Badge variant="outline" className={decisionColor[trace.policy.permissionLevel] ?? ''}>
                    {trace.policy.permissionLevel}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Action</span>
                  <span className="text-xs">{trace.policy.action}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Priority</span>
                  <span className="text-xs font-mono">{trace.policy.priority}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No matched policy</p>
            )}
          </div>

          {/* Approval Status */}
          {trace.approval && (
            <>
              <div className="border-t border-border" />
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold flex items-center gap-1.5">
                  <CheckSquare className="h-3 w-3" /> Approval Request
                </h4>
                <div className="space-y-1.5 p-3 rounded-md bg-muted/50 dark:bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Request ID</span>
                    <span className="text-xs font-mono">{trace.approval.requestId}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Status</span>
                    <Badge variant="outline" className={approvalStatusColors[trace.approval.status] ?? ''}>
                      {trace.approval.status}
                    </Badge>
                  </div>
                  {trace.approval.humanReviewerId && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Reviewer</span>
                      <span className="text-xs">{trace.approval.humanReviewerId}</span>
                    </div>
                  )}
                  {trace.approval.reviewNotes && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Notes: {trace.approval.reviewNotes}
                    </div>
                  )}
                  {trace.approval.modifiedAction && (
                    <div className="mt-1">
                      <span className="text-xs text-muted-foreground">Modified Action:</span>
                      <pre className="text-xs font-mono bg-muted/50 rounded p-2 mt-1 overflow-x-auto">
                        {formatJsonSafe(trace.approval.modifiedAction)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Timeline */}
          <div className="border-t border-border" />
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold flex items-center gap-1.5">
              <Clock className="h-3 w-3" /> Timeline
            </h4>
            <div className="space-y-2 pl-3 border-l-2 border-emerald-500/30">
              <div className="relative">
                <div className="absolute -left-[13px] top-1 h-2 w-2 rounded-full bg-emerald-500" />
                <div className="text-xs">
                  <span className="font-medium">Trace Created</span>
                  <span className="text-muted-foreground ml-2">
                    {formatDistanceToNow(new Date(trace.timestamp), { addSuffix: true })}
                  </span>
                </div>
              </div>
              {trace.approval && (
                <div className="relative">
                  <div className="absolute -left-[13px] top-1 h-2 w-2 rounded-full bg-amber-500" />
                  <div className="text-xs">
                    <span className="font-medium">Approval Requested</span>
                    <span className="text-muted-foreground ml-2">
                      {formatDistanceToNow(new Date(trace.approval.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              )}
              {trace.approval?.reviewTimestamp && (
                <div className="relative">
                  <div className="absolute -left-[13px] top-1 h-2 w-2 rounded-full bg-cyan-500" />
                  <div className="text-xs">
                    <span className="font-medium">Reviewed</span>
                    <span className="text-muted-foreground ml-2">
                      {formatDistanceToNow(new Date(trace.approval.reviewTimestamp), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
