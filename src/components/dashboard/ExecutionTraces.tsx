'use client'

import { useState, useMemo } from 'react'
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
import { TraceDetail } from './TraceDetail'
import { DataExport } from './DataExport'
import { useQuery } from '@tanstack/react-query'
import { Activity, ChevronLeft, ChevronRight, Search, BarChart3 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts'

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

const rowBorder: Record<string, string> = {
  ALLOW: 'border-l-2 border-l-emerald-500/40',
  BLOCK: 'border-l-2 border-l-red-500/40',
  REQUIRE_APPROVAL: 'border-l-2 border-l-amber-500/40',
}

export function ExecutionTraces() {
  const [page, setPage] = useState(0)
  const pageSize = 20
  const [filterRole, setFilterRole] = useState('all')
  const [filterResult, setFilterResult] = useState('all')
  const [filterTool, setFilterTool] = useState('')
  const [filterSession, setFilterSession] = useState('')
  const [selectedTrace, setSelectedTrace] = useState<TraceRecord | null>(null)
  const [showHistogram, setShowHistogram] = useState(false)

  const timeRange = useAppStore((s) => s.timeRange)

  const queryParams = new URLSearchParams()
  queryParams.set('limit', String(pageSize))
  queryParams.set('offset', String(page * pageSize))
  queryParams.set('timeRange', timeRange)
  if (filterRole !== 'all') queryParams.set('agentRole', filterRole)
  if (filterResult !== 'all') queryParams.set('evaluationResult', filterResult)
  if (filterTool) queryParams.set('toolName', filterTool)
  if (filterSession) queryParams.set('sessionId', filterSession)

  const { data, isLoading } = useQuery<{ traces: TraceRecord[]; total: number }>({
    queryKey: ['traces', page, filterRole, filterResult, filterTool, filterSession, timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/traces?${queryParams.toString()}`)
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
  })

  const { data: histData } = useQuery<{ traces: TraceRecord[]; total: number }>({
    queryKey: ['traces-histogram', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/traces?limit=200&timeRange=${timeRange}`)
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    enabled: showHistogram,
  })

  const latencyHistogram = useMemo(() => {
    if (!histData?.traces) return []
    const buckets = [
      { range: '0-5ms', min: 0, max: 5, count: 0 },
      { range: '5-10ms', min: 5, max: 10, count: 0 },
      { range: '10-20ms', min: 10, max: 20, count: 0 },
      { range: '20-50ms', min: 20, max: 50, count: 0 },
      { range: '50-100ms', min: 50, max: 100, count: 0 },
      { range: '100ms+', min: 100, max: Infinity, count: 0 },
    ]
    for (const t of histData.traces) {
      const b = buckets.find((b) => t.latency >= b.min && t.latency < b.max)
      if (b) b.count++
    }
    return buckets
  }, [histData])

  const sessionGroups = useMemo(() => {
    if (!data?.traces) return []
    const groups: Record<string, TraceRecord[]> = {}
    for (const t of data.traces) {
      if (!groups[t.sessionId]) groups[t.sessionId] = []
      groups[t.sessionId].push(t)
    }
    return Object.entries(groups).map(([sessionId, traces]) => ({
      sessionId,
      traces: traces.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
      count: traces.length,
    }))
  }, [data])

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="section-header-gradient rounded-xl px-4 py-3 -mx-4 -mt-2 md:-mx-6 md:-mt-4 mb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2 bg-gradient-to-r from-emerald-700 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
              <Activity className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Execution Traces
            </h2>
            <p className="text-sm text-muted-foreground">Monitor all agent tool call evaluations</p>
          </div>
          <div className="flex items-center gap-2">
            <DataExport dataType="traces" />
            {/* Histogram toggle hidden on very small screens */}
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1 hidden sm:flex active:scale-[0.98] transition-transform"
              onClick={() => setShowHistogram(!showHistogram)}
            >
              <BarChart3 className="h-3 w-3" />
              {showHistogram ? 'Hide' : 'Show'} Latency Histogram
            </Button>
          </div>
        </div>
      </div>

      {/* Latency Histogram */}
      {showHistogram && (
        <Card className="border-0 shadow-sm glass-card glow-hover">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Latency Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={latencyHistogram}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="range" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: 'hsl(var(--foreground))',
                  }}
                />
                <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Session Grouping Summary - wraps on mobile */}
      {sessionGroups.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sessionGroups.slice(0, 5).map((group) => (
            <button
              key={group.sessionId}
              className="px-2 py-1 rounded-md text-xs bg-muted/50 hover:bg-muted border border-border transition-colors duration-200 active:scale-[0.98]"
              onClick={() => { setFilterSession(group.sessionId); setPage(0) }}
            >
              <span className="font-mono">{group.sessionId.substring(0, 12)}...</span>
              <Badge variant="secondary" className="ml-1 text-[10px] h-4 tabular-nums">{group.count}</Badge>
            </button>
          ))}
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="h-8 text-sm pl-8"
            placeholder="Session ID..."
            value={filterSession}
            onChange={(e) => { setFilterSession(e.target.value); setPage(0) }}
          />
        </div>
        <Input
          className="h-8 text-sm max-w-[140px]"
          placeholder="Tool name..."
          value={filterTool}
          onChange={(e) => { setFilterTool(e.target.value); setPage(0) }}
        />
        <Select value={filterRole} onValueChange={(v) => { setFilterRole(v); setPage(0) }}>
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
        <Select value={filterResult} onValueChange={(v) => { setFilterResult(v); setPage(0) }}>
          <SelectTrigger className="h-8 text-sm w-full sm:w-40">
            <SelectValue placeholder="Result" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Results</SelectItem>
            <SelectItem value="ALLOW">Allow</SelectItem>
            <SelectItem value="BLOCK">Block</SelectItem>
            <SelectItem value="REQUIRE_APPROVAL">Require Approval</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Traces Table - horizontally scrollable */}
      <Card className="border-0 shadow-sm glass-card glow-hover">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-10 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : !data?.traces.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">No traces match your filters</p>
              <p className="text-xs mt-1">Try adjusting your search criteria or clearing filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sticky-first-col bg-card">Trace ID</TableHead>
                    <TableHead className="text-xs">Session</TableHead>
                    <TableHead className="text-xs">Agent Role</TableHead>
                    <TableHead className="text-xs">Tool</TableHead>
                    <TableHead className="text-xs">Result</TableHead>
                    <TableHead className="text-xs">Latency</TableHead>
                    <TableHead className="text-xs">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.traces.map((trace) => (
                    <TableRow
                      key={trace.traceId}
                      className={cn(
                        'cursor-pointer transition-all duration-150',
                        rowBorder[trace.evaluationResult] ?? '',
                        trace.evaluationResult === 'BLOCK' ? 'hover:bg-red-500/[0.04] dark:hover:bg-red-500/[0.06]' :
                        trace.evaluationResult === 'ALLOW' ? 'hover:bg-emerald-500/[0.04] dark:hover:bg-emerald-500/[0.06]' :
                        'hover:bg-amber-500/[0.04] dark:hover:bg-amber-500/[0.06]'
                      )}
                      onClick={() => setSelectedTrace(trace)}
                    >
                      <TableCell className="text-xs font-mono max-w-[100px] truncate sticky-first-col bg-card">
                        {trace.traceId}
                      </TableCell>
                      <TableCell className="text-xs font-mono max-w-[80px] truncate text-muted-foreground">
                        {trace.sessionId}
                      </TableCell>
                      <TableCell className="text-xs">{trace.agentRole}</TableCell>
                      <TableCell className="text-xs">{trace.toolName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`transition-transform duration-150 hover:scale-105 ${decisionColor[trace.evaluationResult] ?? ''}`}>
                          {trace.evaluationResult === 'REQUIRE_APPROVAL' ? 'APPROVAL' : trace.evaluationResult}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono tabular-nums">{trace.latency.toFixed(1)}ms</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(trace.timestamp), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  ))}
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
            Page {page + 1} of {totalPages} ({data?.total ?? 0} traces)
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

      {/* Trace Detail Sheet */}
      <TraceDetail
        open={!!selectedTrace}
        onOpenChange={(open) => !open && setSelectedTrace(null)}
        trace={selectedTrace}
      />
    </div>
  )
}
