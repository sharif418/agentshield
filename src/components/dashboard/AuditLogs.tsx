'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useQuery } from '@tanstack/react-query'
import { FileText, Lock, ChevronLeft, ChevronRight, Shield, ShieldCheck, ShieldX, Activity, CheckSquare, ChevronDown, ChevronRight as ChevronR, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import { DataExport } from './DataExport'

interface AuditLog {
  id: string
  eventType: string
  actor: string
  details: string
  timestamp: string
  immutable: boolean
}

const eventTypeColors: Record<string, string> = {
  POLICY_CREATED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  POLICY_UPDATED: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  POLICY_DELETED: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  TRACE_EVALUATED: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
  APPROVAL_DECISION: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
}

const eventTypeIcons: Record<string, React.ReactNode> = {
  POLICY_CREATED: <ShieldCheck className="h-3.5 w-3.5" />,
  POLICY_UPDATED: <Shield className="h-3.5 w-3.5" />,
  POLICY_DELETED: <ShieldX className="h-3.5 w-3.5" />,
  TRACE_EVALUATED: <Activity className="h-3.5 w-3.5" />,
  APPROVAL_DECISION: <CheckSquare className="h-3.5 w-3.5" />,
}

// Left border colors for table rows based on event type
const eventTypeBorder: Record<string, string> = {
  POLICY_CREATED: 'border-l-3 border-l-emerald-500/50',
  POLICY_UPDATED: 'border-l-3 border-l-violet-500/50',
  POLICY_DELETED: 'border-l-3 border-l-red-500/50',
  TRACE_EVALUATED: 'border-l-3 border-l-cyan-500/50',
  APPROVAL_DECISION: 'border-l-3 border-l-amber-500/50',
}

function formatJsonSafe(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2)
  } catch {
    return str
  }
}

export function AuditLogs() {
  const [page, setPage] = useState(0)
  const pageSize = 20
  const [filterEventType, setFilterEventType] = useState('all')
  const [filterActor, setFilterActor] = useState('')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const queryParams = new URLSearchParams()
  queryParams.set('limit', String(pageSize))
  queryParams.set('offset', String(page * pageSize))
  if (filterEventType !== 'all') queryParams.set('eventType', filterEventType)
  if (filterActor) queryParams.set('actor', filterActor)

  const { data, isLoading } = useQuery<{ logs: AuditLog[]; total: number }>({
    queryKey: ['audit', page, filterEventType, filterActor],
    queryFn: async () => {
      const res = await fetch(`/api/audit?${queryParams.toString()}`)
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
  })

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="p-4 md:p-6 space-y-4 relative">
      <div className="absolute inset-0 dot-grid opacity-30 pointer-events-none rounded-xl" />

      <div className="section-header-gradient section-header-accent rounded-xl px-4 py-3 -mx-4 -mt-2 md:-mx-6 md:-mt-4 mb-2 relative overflow-hidden">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2 gradient-text-shimmer">
              <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Audit Logs
              <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                <Lock className="h-3 w-3 mr-1" /> Immutable
              </Badge>
            </h2>
            <p className="text-sm text-muted-foreground">Complete, immutable record of all system events</p>
          </div>
          <DataExport dataType="audit" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Select value={filterEventType} onValueChange={(v) => { setFilterEventType(v); setPage(0) }}>
          <SelectTrigger className="h-8 text-sm w-full sm:w-48">
            <SelectValue placeholder="Event Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            <SelectItem value="POLICY_CREATED">Policy Created</SelectItem>
            <SelectItem value="POLICY_UPDATED">Policy Updated</SelectItem>
            <SelectItem value="POLICY_DELETED">Policy Deleted</SelectItem>
            <SelectItem value="TRACE_EVALUATED">Trace Evaluated</SelectItem>
            <SelectItem value="APPROVAL_DECISION">Approval Decision</SelectItem>
          </SelectContent>
        </Select>
        <Input
          className="h-8 text-sm max-w-xs"
          placeholder="Filter by actor..."
          value={filterActor}
          onChange={(e) => { setFilterActor(e.target.value); setPage(0) }}
        />
      </div>

      {/* Event Timeline + Activity Heatmap */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Event Timeline Visualization */}
        <Card className="border-0 shadow-sm glass-card glow-hover">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Event Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-16 skeleton-shimmer rounded" />
            ) : !data?.logs.length ? (
              <div className="h-16 flex items-center justify-center text-muted-foreground text-xs">
                No events to display
              </div>
            ) : (
              <div className="relative h-16">
                {/* Timeline line */}
                <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-border/50" />
                {/* Event clusters */}
                <div className="relative flex items-center justify-between h-full px-2">
                  {(() => {
                    // Group events by rough time buckets
                    const now = Date.now()
                    const bucketCount = 12
                    const bucketWidth = (24 * 60 * 60 * 1000) / bucketCount // last 24h divided
                    const buckets = Array.from({ length: bucketCount }, (_, i) => ({
                      time: now - (bucketCount - 1 - i) * bucketWidth,
                      count: 0,
                      types: new Set<string>(),
                    }))

                    data.logs.forEach((log) => {
                      const logTime = new Date(log.timestamp).getTime()
                      const bucketIdx = Math.floor((logTime - (now - 24 * 60 * 60 * 1000)) / bucketWidth)
                      if (bucketIdx >= 0 && bucketIdx < bucketCount) {
                        buckets[bucketIdx].count++
                        buckets[bucketIdx].types.add(log.eventType)
                      }
                    })

                    const maxCount = Math.max(...buckets.map(b => b.count), 1)

                    return buckets.map((bucket, i) => {
                      const size = Math.max(4, (bucket.count / maxCount) * 16)
                      const dominantType = bucket.types.size > 0
                        ? [...bucket.types][Math.floor(Math.random() * bucket.types.size)]
                        : null
                      const color = dominantType
                        ? (dominantType.includes('CREATED') ? 'bg-emerald-500' :
                           dominantType.includes('DELETED') ? 'bg-red-500' :
                           dominantType.includes('UPDATED') ? 'bg-violet-500' :
                           dominantType.includes('TRACE') ? 'bg-cyan-500' :
                           'bg-amber-500')
                        : 'bg-muted-foreground/20'

                      return (
                        <div key={i} className="flex flex-col items-center gap-1" title={`${bucket.count} events`}>
                          <span className="text-[8px] text-muted-foreground tabular-nums">
                            {bucket.count > 0 ? bucket.count : ''}
                          </span>
                          <div
                            className={`rounded-full ${bucket.count > 0 ? color : 'bg-muted-foreground/10'} transition-all duration-300`}
                            style={{ width: `${size}px`, height: `${size}px` }}
                          />
                        </div>
                      )
                    })
                  })()}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity Heatmap */}
        <Card className="border-0 shadow-sm glass-card glow-hover">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Activity Heatmap (7d × 24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-24 skeleton-shimmer rounded" />
            ) : !data?.logs.length ? (
              <div className="h-24 flex items-center justify-center text-muted-foreground text-xs">
                No activity data
              </div>
            ) : (
              <div className="space-y-1">
                {/* Day labels */}
                <div className="flex items-center gap-0.5">
                  <div className="w-6" />
                  {Array.from({ length: 7 }, (_, i) => (
                    <div key={i} className="flex-1 text-center text-[8px] text-muted-foreground">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}
                    </div>
                  ))}
                </div>
                {/* Hour rows */}
                {Array.from({ length: 4 }, (_, hourGroup) => {
                  const hours = [hourGroup * 6, hourGroup * 6 + 1, hourGroup * 6 + 2, hourGroup * 6 + 3, hourGroup * 6 + 4, hourGroup * 6 + 5]
                  return (
                    <div key={hourGroup} className="flex items-center gap-0.5">
                      <div className="w-6 text-[8px] text-muted-foreground text-right pr-1 tabular-nums">
                        {`${hours[0]}h`}
                      </div>
                      {Array.from({ length: 7 }, (_, dayIdx) => {
                        // Calculate activity intensity for this cell
                        const cellHour = hours[0]
                        const now = new Date()
                        const dayOffset = 6 - dayIdx
                        const cellDate = new Date(now)
                        cellDate.setDate(cellDate.getDate() - dayOffset)
                        cellDate.setHours(cellHour, 0, 0, 0)

                        const cellEnd = new Date(cellDate.getTime() + 6 * 60 * 60 * 1000)
                        const count = data.logs.filter(log => {
                          const t = new Date(log.timestamp)
                          return t >= cellDate && t < cellEnd
                        }).length

                        const maxLogCount = Math.max(data.logs.length / 28, 1)
                        const intensity = Math.min(count / maxLogCount, 1)

                        return (
                          <div
                            key={dayIdx}
                            className="flex-1 h-4 rounded-sm transition-all duration-300"
                            style={{
                              backgroundColor: count === 0
                                ? 'hsl(var(--muted) / 0.3)'
                                : `rgba(16, 185, 129, ${0.15 + intensity * 0.65})`,
                            }}
                            title={`${count} events`}
                          />
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Table - horizontally scrollable */}
      <Card className="border-0 shadow-sm glass-card glow-hover">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-10 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : !data?.logs.length ? (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-sm font-bold">No audit entries yet</p>
              <p className="text-xs mt-1">Audit entries appear when policies are created or modified</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-8" />
                    <TableHead className="text-xs">Timestamp</TableHead>
                    <TableHead className="text-xs">Event Type</TableHead>
                    <TableHead className="text-xs">Actor</TableHead>
                    <TableHead className="text-xs min-w-[200px]">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.logs.map((log) => {
                    const isExpanded = expandedRows.has(log.id)
                    return (
                      <TableRow key={log.id} className={`transition-all duration-150 hover:bg-muted/30 ${eventTypeBorder[log.eventType] ?? ''}`}>
                        <TableCell className="w-8">
                          <div className={eventTypeColors[log.eventType] ?? 'text-muted-foreground'}>
                            {eventTypeIcons[log.eventType] ?? <FileText className="h-3.5 w-3.5" />}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                          {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`transition-transform duration-150 hover:scale-105 gap-1 ${eventTypeColors[log.eventType] ?? 'bg-gray-500/10 text-gray-600 border-gray-500/20'}`}
                          >
                            {eventTypeIcons[log.eventType] && (
                              <span className="inline-flex">{eventTypeIcons[log.eventType]}</span>
                            )}
                            {log.eventType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono">{log.actor}</TableCell>
                        <TableCell className="max-w-[300px]">
                          <button
                            className="text-xs text-left text-muted-foreground hover:text-foreground transition-colors duration-200 truncate flex items-center gap-1 w-full"
                            onClick={() => toggleRow(log.id)}
                          >
                            {isExpanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronR className="h-3 w-3 shrink-0" />}
                            <span className="truncate">{log.details.substring(0, 50)}...</span>
                          </button>
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.pre
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="text-xs font-mono bg-muted/50 dark:bg-muted/30 rounded p-2 mt-1 overflow-x-auto max-h-32 custom-scrollbar overflow-hidden"
                              >
                                {formatJsonSafe(log.details)}
                              </motion.pre>
                            )}
                          </AnimatePresence>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground tabular-nums">
            Page {page + 1} of {totalPages} ({data?.total ?? 0} logs)
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 active:scale-95 transition-transform"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 active:scale-95 transition-transform"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
