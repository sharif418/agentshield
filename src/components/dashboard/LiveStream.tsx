'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Radio,
  Pause,
  Play,
  Trash2,
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Volume2,
  VolumeX,
  Activity,
  BarChart3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Card } from '@/components/ui/card'
import { useAppStore } from '@/lib/store'

interface StreamEvent {
  traceId: string
  timestamp: string
  agentRole: string
  toolName: string
  action: string
  evaluationResult: string
  latency: number
  intentPayload: string
  matchedPolicyId: string | null
  policy?: {
    policyId: string
    name: string
    permissionLevel: string
    action: string
    priority: number
  } | null
}

const agentColorMap: Record<string, string> = {
  DataAgent: 'text-cyan-400',
  CodeAgent: 'text-violet-400',
  FinanceAgent: 'text-amber-400',
  SupportAgent: 'text-rose-400',
}

const agentBgColorMap: Record<string, string> = {
  DataAgent: 'bg-cyan-500/10',
  CodeAgent: 'bg-violet-500/10',
  FinanceAgent: 'bg-amber-500/10',
  SupportAgent: 'bg-rose-500/10',
}

const decisionIcon: Record<string, React.ReactNode> = {
  ALLOW: <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />,
  BLOCK: <XCircle className="h-3.5 w-3.5 text-red-400" />,
  REQUIRE_APPROVAL: <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />,
}

const decisionBadgeColor: Record<string, string> = {
  ALLOW: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  BLOCK: 'bg-red-500/10 text-red-400 border-red-500/20',
  REQUIRE_APPROVAL: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
}

function extractAction(payload: string, toolName: string): string {
  try {
    const parsed = JSON.parse(payload)
    if (parsed.query) return parsed.query.length > 40 ? parsed.query.substring(0, 40) + '...' : parsed.query
    if (parsed.operation) return parsed.operation
    if (parsed.action) return parsed.action
    if (parsed.httpMethod) return `${parsed.httpMethod} ${parsed.path || ''}`
    if (parsed.text) return `Send: "${(parsed.text as string).substring(0, 25)}..."`
    if (parsed.command) return parsed.command
    if (toolName === 'GitHub' && parsed.branch) return `PUSH to ${parsed.branch}`
    if (toolName === 'Stripe' && parsed.amount) return `${parsed.operation || 'CHARGE'} $${parsed.amount}`
    return 'execute'
  } catch {
    return 'execute'
  }
}

function formatTime(ts: string): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// Mini sparkline using SVG
function Sparkline({ data, width = 120, height = 28 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const step = width / (data.length - 1)
  const points = data.map((v, i) => `${i * step},${height - (v / max) * (height - 4) - 2}`).join(' ')
  const areaPoints = `0,${height} ${points} ${width},${height}`

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#sparkGrad)" />
      <polyline points={points} fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

export function LiveStream() {
  const { wsConnected, timeRange } = useAppStore()
  const [events, setEvents] = useState<StreamEvent[]>([])
  const [paused, setPaused] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [filterRole, setFilterRole] = useState<string>('all')
  const [filterDecision, setFilterDecision] = useState<string>('all')
  const [selectedEvent, setSelectedEvent] = useState<StreamEvent | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [rateHistory, setRateHistory] = useState<number[]>([])
  const [totalReceived, setTotalReceived] = useState(0)
  const seenIds = useRef<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Create a simple beep sound
  useEffect(() => {
    if (typeof window !== 'undefined' && !audioRef.current) {
      const ctx = new AudioContext()
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.connect(gain)
      gain.connect(ctx.destination)
      oscillator.frequency.value = 880
      oscillator.type = 'sine'
      gain.gain.value = 0.05
      audioRef.current = { play: () => { oscillator.start(); oscillator.stop(ctx.currentTime + 0.05) } } as unknown as HTMLAudioElement
    }
  }, [])

  // Fetch traces for initial data and polling
  const { data: tracesData } = useQuery({
    queryKey: ['livestream-traces', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/traces?limit=50&timeRange=${timeRange}`)
      if (!res.ok) return { traces: [] }
      return res.json() as Promise<{ traces: StreamEvent[] }>
    },
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  })

  // Process new traces using a deferred callback to avoid cascading renders
  const processNewTraces = useCallback((data: { traces: StreamEvent[] } | undefined) => {
    if (!data?.traces || paused) return

    const newEvents: StreamEvent[] = []
    for (const trace of data.traces) {
      if (!seenIds.current.has(trace.traceId)) {
        seenIds.current.add(trace.traceId)
        newEvents.push(trace)
      }
    }

    if (newEvents.length > 0) {
      setEvents(prev => [...newEvents, ...prev].slice(0, 500))
      setTotalReceived(prev => prev + newEvents.length)
      if (soundEnabled && audioRef.current) {
        try { (audioRef.current as unknown as { play: () => void }).play() } catch { /* ignore */ }
      }
    }
  }, [paused, soundEnabled])

  useEffect(() => {
    if (tracesData) {
      // Defer to avoid synchronous setState in effect
      const id = requestAnimationFrame(() => processNewTraces(tracesData))
      return () => cancelAnimationFrame(id)
    }
  }, [tracesData, processNewTraces])

  // Auto-scroll to top when new events arrive
  useEffect(() => {
    if (!paused && containerRef.current) {
      containerRef.current.scrollTop = 0
    }
  }, [events, paused])

  // Event rate calculation (events per minute, updated every 10s)
  useEffect(() => {
    const interval = setInterval(() => {
      setRateHistory(prev => {
        const last10sCount = events.filter(e => {
          const age = Date.now() - new Date(e.timestamp).getTime()
          return age < 10000
        }).length
        const rate = last10sCount * 6 // extrapolate to per minute
        const next = [...prev, rate].slice(-30) // last 5 minutes at 10s intervals
        return next
      })
    }, 10000)
    return () => clearInterval(interval)
  }, [events])

  // Clear stream
  const handleClear = useCallback(() => {
    setEvents([])
    seenIds.current.clear()
    setTotalReceived(0)
    setRateHistory([])
  }, [])

  // Click event to open detail
  const handleEventClick = useCallback((event: StreamEvent) => {
    setSelectedEvent(event)
    setSheetOpen(true)
  }, [])

  // Filter events
  const filteredEvents = events.filter(e => {
    if (filterRole !== 'all' && e.agentRole !== filterRole) return false
    if (filterDecision !== 'all' && e.evaluationResult !== filterDecision) return false
    return true
  })

  // Compute current rate
  const currentRate = rateHistory.length > 0 ? rateHistory[rateHistory.length - 1] : 0

  // Unique agent roles for filter
  const agentRoles = [...new Set(events.map(e => e.agentRole))].sort()

  return (
    <div className="h-full flex flex-col p-4 md:p-6 gap-4">
      {/* Header */}
      <div className="section-header-gradient rounded-xl px-4 py-3 -mx-4 -mt-2 md:-mx-6 md:-mt-4 mb-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2 bg-gradient-to-r from-emerald-700 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
              <Radio className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Live Stream
            </h2>
            <p className="text-sm text-muted-foreground">Real-time policy evaluation feed</p>
          </div>

          {/* Stats Row */}
          <div className="flex items-center gap-3 flex-wrap">
          {/* Connected indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-muted/50 text-xs">
            <span className={`h-2 w-2 rounded-full ${wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-400'}`} />
            <span className={wsConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-400'}>
              {wsConnected ? 'Connected' : 'Offline'}
            </span>
          </div>

          {/* Event count */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-muted/50 text-xs">
            <Activity className="h-3 w-3 text-muted-foreground" />
            <span>{totalReceived} events</span>
          </div>

          {/* Rate */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-muted/50 text-xs">
            <BarChart3 className="h-3 w-3 text-muted-foreground" />
            <span>{currentRate}/min</span>
          </div>
        </div>
        </div>
      </div>

      {/* Sparkline */}
      {rateHistory.length > 1 && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">Rate (5m)</span>
          <Sparkline data={rateHistory} width={200} height={24} />
        </div>
      )}

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
        {/* Filter dropdowns */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue placeholder="Agent Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {agentRoles.map(role => (
                <SelectItem key={role} value={role}>{role}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterDecision} onValueChange={setFilterDecision}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue placeholder="Decision" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Decisions</SelectItem>
              <SelectItem value="ALLOW">✅ ALLOW</SelectItem>
              <SelectItem value="BLOCK">🚫 BLOCK</SelectItem>
              <SelectItem value="REQUIRE_APPROVAL">⚠️ REQUIRE_APPROVAL</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 ml-auto">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Mute notifications' : 'Enable sound notifications'}
          >
            {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant={paused ? 'default' : 'ghost'}
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setPaused(!paused)}
          >
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            {paused ? 'Resume' : 'Pause'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-red-500"
            onClick={handleClear}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      </div>

      {/* Event Stream Console */}
      <Card className="flex-1 min-h-0 bg-gray-950 dark:bg-gray-950 border-gray-800 overflow-hidden">
        <div
          ref={containerRef}
          className="h-full overflow-y-auto custom-scrollbar font-mono text-xs leading-relaxed"
        >
          {filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
              <Radio className="h-10 w-10 opacity-20" />
              <div className="text-center">
                <p className="text-sm font-medium text-gray-400">Waiting for events...</p>
                <p className="text-[10px] mt-1">New policy evaluations will appear here in real-time</p>
              </div>
              {!paused && (
                <div className="flex items-center gap-1 mt-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] text-emerald-500">Polling every 5s</span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 space-y-0.5">
              <AnimatePresence initial={false}>
                {filteredEvents.map((event, index) => (
                  <motion.div
                    key={event.traceId}
                    initial={{ opacity: 0, x: -12, height: 0 }}
                    animate={{ opacity: 1, x: 0, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, delay: index < 5 ? index * 0.03 : 0 }}
                    className="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-800/60 cursor-pointer transition-colors"
                    onClick={() => handleEventClick(event)}
                  >
                    {/* Timestamp */}
                    <span className="text-gray-500 whitespace-nowrap">[{formatTime(event.timestamp)}]</span>

                    {/* Agent Role - color coded */}
                    <span className={`whitespace-nowrap font-semibold ${agentColorMap[event.agentRole] ?? 'text-gray-300'}`}>
                      {event.agentRole}
                    </span>

                    {/* Arrow */}
                    <span className="text-gray-600">→</span>

                    {/* Tool Name */}
                    <span className="text-gray-300 whitespace-nowrap">{event.toolName}</span>

                    {/* Separator */}
                    <span className="text-gray-700">|</span>

                    {/* Action */}
                    <span className="text-gray-400 truncate max-w-[200px]">
                      {extractAction(event.intentPayload, event.toolName)}
                    </span>

                    {/* Separator */}
                    <span className="text-gray-700">|</span>

                    {/* Decision Badge */}
                    <Badge
                      variant="outline"
                      className={`text-[10px] h-5 px-1.5 border font-semibold ${decisionBadgeColor[event.evaluationResult] ?? 'text-gray-400'}`}
                    >
                      <span className="mr-1">{decisionIcon[event.evaluationResult]}</span>
                      {event.evaluationResult === 'REQUIRE_APPROVAL' ? 'REVIEW' : event.evaluationResult}
                    </Badge>

                    {/* Separator */}
                    <span className="text-gray-700">|</span>

                    {/* Latency */}
                    <span className={`whitespace-nowrap ${event.latency > 10 ? 'text-amber-400' : 'text-gray-500'}`}>
                      {event.latency.toFixed(1)}ms
                    </span>

                    {/* Expand indicator on hover */}
                    <span className="ml-auto text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity text-[10px]">
                      →
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3 text-emerald-400" /> ALLOW
        </span>
        <span className="flex items-center gap-1">
          <XCircle className="h-3 w-3 text-red-400" /> BLOCK
        </span>
        <span className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3 text-amber-400" /> REQUIRE_APPROVAL
        </span>
        <span className="text-gray-500">|</span>
        {Object.entries(agentColorMap).map(([role, color]) => (
          <span key={role} className={`flex items-center gap-1 ${color}`}>
            <span className={`h-2 w-2 rounded-full ${agentBgColorMap[role]}`} />
            {role}
          </span>
        ))}
      </div>

      {/* Trace Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-lg w-full overflow-y-auto custom-scrollbar">
          <SheetHeader>
            <SheetTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Event Detail
            </SheetTitle>
          </SheetHeader>

          {selectedEvent && (
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                {[
                  { label: 'Trace ID', value: selectedEvent.traceId, mono: true },
                  { label: 'Timestamp', value: new Date(selectedEvent.timestamp).toLocaleString(), mono: false },
                  { label: 'Agent Role', value: selectedEvent.agentRole, mono: false },
                  { label: 'Tool', value: selectedEvent.toolName, mono: false },
                  { label: 'Action', value: extractAction(selectedEvent.intentPayload, selectedEvent.toolName), mono: false },
                  { label: 'Latency', value: `${selectedEvent.latency.toFixed(3)}ms`, mono: true },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{row.label}</span>
                    <span className={`text-xs ${row.mono ? 'font-mono' : 'font-medium'}`}>{row.value}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Decision</span>
                  <Badge variant="outline" className={decisionBadgeColor[selectedEvent.evaluationResult] ?? ''}>
                    {decisionIcon[selectedEvent.evaluationResult]}
                    <span className="ml-1">{selectedEvent.evaluationResult}</span>
                  </Badge>
                </div>
              </div>

              <div className="border-t border-border" />

              {/* Intent Payload */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold">Intent Payload</h4>
                <pre className="text-xs font-mono bg-muted/50 dark:bg-muted/30 rounded-md p-3 overflow-x-auto max-h-48 custom-scrollbar">
                  {(() => {
                    try { return JSON.stringify(JSON.parse(selectedEvent.intentPayload), null, 2) }
                    catch { return selectedEvent.intentPayload }
                  })()}
                </pre>
              </div>

              {/* Matched Policy */}
              {selectedEvent.policy && (
                <>
                  <div className="border-t border-border" />
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-semibold">Matched Policy</h4>
                    <div className="space-y-1.5 p-3 rounded-md bg-muted/50 dark:bg-muted/30">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Name</span>
                        <span className="text-xs font-medium">{selectedEvent.policy.name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Permission</span>
                        <Badge variant="outline" className={decisionBadgeColor[selectedEvent.policy.permissionLevel] ?? ''}>
                          {selectedEvent.policy.permissionLevel}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Action</span>
                        <span className="text-xs">{selectedEvent.policy.action}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Priority</span>
                        <span className="text-xs font-mono">{selectedEvent.policy.priority}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
