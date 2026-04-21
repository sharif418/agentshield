'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldAlert,
  Activity,
  ShieldCheck,
  Search,
  Clock,
  AlertTriangle,
  ShieldX,
  Zap,
  Eye,
  Bug,
  Lock,
  Unlock,
  Terminal,
  Pause,
  Play,
  Trash2,
  Filter,
  TrendingUp,
  TrendingDown,
  Plus,
  Shield,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// ===== Types =====

type ThreatSeverity = 'Critical' | 'High' | 'Medium' | 'Low'
type ThreatStatus = 'Blocked' | 'Monitored' | 'Investigating'
type ProtectionLevel = 'Fully Protected' | 'Partially Protected' | 'Not Protected'
type ThreatLevel = 'Low' | 'Moderate' | 'High' | 'Critical'

interface ThreatEvent {
  id: string
  timestamp: Date
  type: string
  source: string
  target: string
  severity: ThreatSeverity
  status: ThreatStatus
}

interface ThreatSource {
  agentRole: string
  toolName: string
  threatCount: number
  lastThreatTime: Date
  riskLevel: ThreatSeverity
  mostCommonAttack: string
}

interface ThreatCategory {
  name: string
  protectionLevel: ProtectionLevel
  activePolicies: number
  icon: React.ReactNode
  totalThreats: number
}

// ===== Constants =====

const THREAT_TYPES = [
  'SQL Injection',
  'Data Exfiltration',
  'Unauthorized Access',
  'Privilege Escalation',
  'DDoS Attempt',
  'Brute Force',
  'XSS Attack',
  'CSRF Attack',
  'Token Theft',
  'Container Escape',
]

const SOURCES = ['DataAgent', 'CodeAgent', 'FinanceAgent', 'SupportAgent']
const TARGETS = ['PostgreSQL', 'GitHub', 'Stripe', 'EmailAPI', 'FileSystem', 'Kubernetes', 'SlackAPI']

const SEVERITY_WEIGHTS: Record<ThreatSeverity, number> = {
  Critical: 40,
  High: 25,
  Medium: 15,
  Low: 5,
}

const severityColors: Record<ThreatSeverity, string> = {
  Critical: 'bg-red-500/10 text-red-400 border-red-500/30',
  High: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  Medium: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  Low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
}

const statusColors: Record<ThreatStatus, string> = {
  Blocked: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  Monitored: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  Investigating: 'bg-red-500/10 text-red-400 border-red-500/30',
}

const threatLevelColors: Record<ThreatLevel, { bg: string; text: string; border: string }> = {
  Low: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30' },
  Moderate: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30' },
  High: { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/30' },
  Critical: { bg: 'bg-red-600/15', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/30' },
}

const sourceColorMap: Record<string, string> = {
  DataAgent: 'text-cyan-400',
  CodeAgent: 'text-violet-400',
  FinanceAgent: 'text-amber-400',
  SupportAgent: 'text-rose-400',
}

// ===== Helper Functions =====

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomSeverity(): ThreatSeverity {
  const r = Math.random()
  if (r < 0.08) return 'Critical'
  if (r < 0.28) return 'High'
  if (r < 0.62) return 'Medium'
  return 'Low'
}

function randomStatus(severity: ThreatSeverity): ThreatStatus {
  if (severity === 'Critical' || severity === 'High') {
    const r = Math.random()
    if (r < 0.6) return 'Blocked'
    if (r < 0.85) return 'Investigating'
    return 'Monitored'
  }
  const r = Math.random()
  if (r < 0.75) return 'Blocked'
  if (r < 0.92) return 'Monitored'
  return 'Investigating'
}

let threatIdCounter = 0
function generateThreatEvent(pastMinutes?: number): ThreatEvent {
  const severity = randomSeverity()
  const ts = pastMinutes !== undefined
    ? new Date(Date.now() - pastMinutes * 60000 - Math.random() * 60000)
    : new Date()
  return {
    id: `threat-${++threatIdCounter}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: ts,
    type: randomItem(THREAT_TYPES),
    source: randomItem(SOURCES),
    target: randomItem(TARGETS),
    severity,
    status: randomStatus(severity),
  }
}

function generateInitialEvents(count: number): ThreatEvent[] {
  const events: ThreatEvent[] = []
  for (let i = 0; i < count; i++) {
    events.push(generateThreatEvent(Math.random() * 1440))
  }
  events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  return events
}

function formatTimestamp(d: Date): string {
  return d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatRelativeTime(d: Date): string {
  const diff = Date.now() - d.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function computeThreatScore(events: ThreatEvent[]): number {
  if (events.length === 0) return 5
  const now = Date.now()
  const recentEvents = events.filter(e => now - e.timestamp.getTime() < 3600000)
  let score = 0
  for (const e of recentEvents) {
    score += SEVERITY_WEIGHTS[e.severity]
    if (e.status === 'Investigating') score += 5
  }
  return Math.min(100, Math.max(0, score))
}

function computeThreatLevel(score: number): ThreatLevel {
  if (score >= 80) return 'Critical'
  if (score >= 55) return 'High'
  if (score >= 30) return 'Moderate'
  return 'Low'
}

// ===== SVG Gauge Component =====

function ThreatGauge({ score, size = 140 }: { score: number; size?: number }) {
  const level = computeThreatLevel(score)
  const colorMap: Record<ThreatLevel, string> = {
    Low: '#10b981',
    Moderate: '#f59e0b',
    High: '#ef4444',
    Critical: '#ef4444',
  }
  const color = colorMap[level]
  const h = size * 0.6
  const cx = size / 2
  const cy = h - 8
  const r = (size - 40) / 2

  const arcLength = Math.PI * r
  const filledLength = (score / 100) * arcLength

  return (
    <svg width={size} height={h} viewBox={`0 0 ${size} ${h}`} className="gauge-glow">
      {/* Background arc */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.08}
        strokeWidth="10"
        strokeLinecap="round"
      />
      {/* Filled arc */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke={color}
        strokeOpacity={0.85}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${filledLength} ${arcLength}`}
      />
      {/* Tick marks */}
      {[25, 50, 75, 100].map((pct) => {
        const angle = Math.PI - (pct / 100) * Math.PI
        const outerR = r + 8
        const innerR = r + 3
        const x1 = cx + innerR * Math.cos(angle)
        const y1 = cy - innerR * Math.sin(angle)
        const x2 = cx + outerR * Math.cos(angle)
        const y2 = cy - outerR * Math.sin(angle)
        return (
          <line key={pct} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="currentColor" strokeOpacity={0.2} strokeWidth={1.5} />
        )
      })}
      {/* Score text */}
      <text x={cx} y={cy - 14} textAnchor="middle"
        className="fill-foreground text-xl font-bold tabular-nums">
        {score}
      </text>
      <text x={cx} y={cy + 2} textAnchor="middle"
        className="fill-muted-foreground text-[9px]">
        threat score
      </text>
    </svg>
  )
}

// ===== Threat Map Visualization =====

function ThreatMap({ events }: { events: ThreatEvent[] }) {
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null)

  const nodes = useMemo(() => {
    const allNodes = [...SOURCES, ...TARGETS]
    const positions: Record<string, { x: number; y: number; type: 'source' | 'target' }> = {}
    const sourceCount = SOURCES.length
    const targetCount = TARGETS.length
    const width = 500
    const height = 260

    SOURCES.forEach((s, i) => {
      positions[s] = {
        x: 70,
        y: 30 + (i / (sourceCount - 1)) * (height - 60),
        type: 'source',
      }
    })
    TARGETS.forEach((t, i) => {
      positions[t] = {
        x: width - 70,
        y: 30 + (i / (targetCount - 1)) * (height - 60),
        type: 'target',
      }
    })
    return { allNodes, positions }
  }, [])

  const connections = useMemo(() => {
    const connMap: Record<string, { source: string; target: string; count: number; severities: ThreatSeverity[] }> = {}
    const recentEvents = events.filter(e => Date.now() - e.timestamp.getTime() < 3600000)
    for (const e of recentEvents) {
      const key = `${e.source}->${e.target}`
      if (!connMap[key]) {
        connMap[key] = { source: e.source, target: e.target, count: 0, severities: [] }
      }
      connMap[key].count++
      connMap[key].severities.push(e.severity)
    }
    return Object.values(connMap)
      .filter(c => c.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
  }, [events])

  const getConnectionColor = (severities: ThreatSeverity[]): string => {
    if (severities.includes('Critical')) return '#ef4444'
    if (severities.includes('High')) return '#f97316'
    if (severities.includes('Medium')) return '#f59e0b'
    return '#10b981'
  }

  const getConnectionWidth = (count: number): number => {
    return Math.min(1 + count * 0.5, 4)
  }

  const hasActiveThreat = (conn: typeof connections[0]): boolean => {
    return conn.severities.includes('Critical') || conn.severities.includes('High')
  }

  return (
    <Card className="glass-card glow-hover border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Eye className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Threat Map
          <Badge variant="outline" className="text-[10px] ml-auto">
            {connections.length} connections
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full overflow-x-auto">
          <svg viewBox="0 0 500 260" className="w-full min-w-[360px]" style={{ maxHeight: 260 }}>
            <defs>
              <filter id="glow-red">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            {/* Connections */}
            {connections.map((conn) => {
              const sPos = nodes.positions[conn.source]
              const tPos = nodes.positions[conn.target]
              if (!sPos || !tPos) return null
              const midX = (sPos.x + tPos.x) / 2
              const color = getConnectionColor(conn.severities)
              const width = getConnectionWidth(conn.count)
              const active = hasActiveThreat(conn)
              const key = `${conn.source}->${conn.target}`
              return (
                <g key={key} onClick={() => setSelectedConnection(selectedConnection === key ? null : key)}
                  className="cursor-pointer">
                  <path
                    d={`M ${sPos.x} ${sPos.y} C ${midX} ${sPos.y}, ${midX} ${tPos.y}, ${tPos.x} ${tPos.y}`}
                    fill="none"
                    stroke={color}
                    strokeWidth={width}
                    strokeOpacity={selectedConnection && selectedConnection !== key ? 0.15 : 0.6}
                    className={active ? 'animate-pulse' : ''}
                  />
                  {/* Animated dot on active connections */}
                  {active && (
                    <circle r="3" fill={color}>
                      <animateMotion
                        dur="2s"
                        repeatCount="indefinite"
                        path={`M ${sPos.x} ${sPos.y} C ${midX} ${sPos.y}, ${midX} ${tPos.y}, ${tPos.x} ${tPos.y}`}
                      />
                    </circle>
                  )}
                </g>
              )
            })}
            {/* Source nodes */}
            {SOURCES.map((s) => {
              const pos = nodes.positions[s]
              if (!pos) return null
              return (
                <g key={s}>
                  <circle cx={pos.x} cy={pos.y} r={14} fill="currentColor" fillOpacity={0.06} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} />
                  <text x={pos.x} y={pos.y + 1} textAnchor="middle" className="fill-foreground text-[7px] font-medium">
                    {s.replace('Agent', '')}
                  </text>
                </g>
              )
            })}
            {/* Target nodes */}
            {TARGETS.map((t) => {
              const pos = nodes.positions[t]
              if (!pos) return null
              return (
                <g key={t}>
                  <circle cx={pos.x} cy={pos.y} r={14} fill="currentColor" fillOpacity={0.06} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} />
                  <text x={pos.x} y={pos.y + 1} textAnchor="middle" className="fill-foreground text-[7px] font-medium">
                    {t.length > 8 ? t.slice(0, 7) + '…' : t}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
        {/* Connection detail */}
        <AnimatePresence>
          {selectedConnection && (() => {
            const conn = connections.find(c => `${c.source}->${c.target}` === selectedConnection)
            if (!conn) return null
            return (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 p-2 rounded-md bg-muted/50 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{conn.source} → {conn.target}</span>
                  <Badge variant="outline" className="text-[10px]">{conn.count} threats</Badge>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {(['Critical', 'High', 'Medium', 'Low'] as ThreatSeverity[]).map(sev => {
                    const count = conn.severities.filter(s => s === sev).length
                    if (count === 0) return null
                    return (
                      <Badge key={sev} variant="outline" className={`text-[10px] ${severityColors[sev]}`}>
                        {sev}: {count}
                      </Badge>
                    )
                  })}
                </div>
              </motion.div>
            )
          })()}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}

// ===== Main Component =====

export function ThreatIntelFeed() {
  // State
  const [events, setEvents] = useState<ThreatEvent[]>(() => generateInitialEvents(35))
  const [paused, setPaused] = useState(false)
  const [filterSeverity, setFilterSeverity] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [minutesAgo, setMinutesAgo] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-generate new threats every 3-5 seconds
  useEffect(() => {
    if (paused) return
    const interval = setInterval(() => {
      const newEvent = generateThreatEvent()
      setEvents(prev => [newEvent, ...prev].slice(0, 500))
      setLastUpdated(new Date())
    }, 3000 + Math.random() * 2000)
    return () => clearInterval(interval)
  }, [paused])

  // Update "minutes ago" counter
  useEffect(() => {
    const interval = setInterval(() => {
      setMinutesAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 60000))
    }, 10000)
    return () => clearInterval(interval)
  }, [lastUpdated])

  // Auto-scroll
  useEffect(() => {
    if (!paused && containerRef.current) {
      containerRef.current.scrollTop = 0
    }
  }, [events, paused])

  // Computed values
  const threatScore = useMemo(() => computeThreatScore(events), [events])
  const threatLevel = useMemo(() => computeThreatLevel(threatScore), [threatScore])
  const levelStyle = threatLevelColors[threatLevel]

  const activeThreats = useMemo(() =>
    events.filter(e => e.status === 'Investigating' && Date.now() - e.timestamp.getTime() < 3600000).length,
    [events]
  )

  const blockedAttempts = useMemo(() =>
    events.filter(e => e.status === 'Blocked' && Date.now() - e.timestamp.getTime() < 86400000).length,
    [events]
  )

  const totalThreats = useMemo(() =>
    events.filter(e => Date.now() - e.timestamp.getTime() < 86400000).length,
    [events]
  )

  const avgResponseTime = useMemo(() => {
    const blocked = events.filter(e => e.status === 'Blocked')
    if (blocked.length === 0) return 0
    return Math.round(45 + Math.random() * 80)
  }, [events])

  // Filtered events for feed
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      if (filterSeverity !== 'all' && e.severity !== filterSeverity) return false
      if (filterStatus !== 'all' && e.status !== filterStatus) return false
      return true
    })
  }, [events, filterSeverity, filterStatus])

  // Threat sources for table
  const threatSources: ThreatSource[] = useMemo(() => {
    const map: Record<string, ThreatSource> = {}
    const recentEvents = events.filter(e => Date.now() - e.timestamp.getTime() < 86400000)
    for (const e of recentEvents) {
      const key = `${e.source}:${e.target}`
      if (!map[key]) {
        map[key] = {
          agentRole: e.source,
          toolName: e.target,
          threatCount: 0,
          lastThreatTime: e.timestamp,
          riskLevel: 'Low',
          mostCommonAttack: e.type,
        }
      }
      map[key].threatCount++
      if (e.timestamp > map[key].lastThreatTime) {
        map[key].lastThreatTime = e.timestamp
      }
    }
    // Compute risk level and most common attack
    for (const key of Object.keys(map)) {
      const sourceEvents = recentEvents.filter(e => `${e.source}:${e.target}` === key)
      const severityCounts: Record<string, number> = {}
      const typeCounts: Record<string, number> = {}
      for (const e of sourceEvents) {
        severityCounts[e.severity] = (severityCounts[e.severity] || 0) + 1
        typeCounts[e.type] = (typeCounts[e.type] || 0) + 1
      }
      if (severityCounts['Critical'] > 0) map[key].riskLevel = 'Critical'
      else if (severityCounts['High'] > 1) map[key].riskLevel = 'High'
      else if (severityCounts['High'] > 0 || severityCounts['Medium'] > 2) map[key].riskLevel = 'Medium'

      const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]
      if (topType) map[key].mostCommonAttack = topType[0]
    }
    return Object.values(map).sort((a, b) => b.threatCount - a.threatCount).slice(0, 8)
  }, [events])

  // Policy protection categories
  const threatCategories: ThreatCategory[] = useMemo(() => {
    const categories: ThreatCategory[] = [
      { name: 'SQL Injection', protectionLevel: 'Fully Protected', activePolicies: 3, icon: <Bug className="h-4 w-4" />, totalThreats: 0 },
      { name: 'Data Exfiltration', protectionLevel: 'Fully Protected', activePolicies: 2, icon: <ShieldX className="h-4 w-4" />, totalThreats: 0 },
      { name: 'Unauthorized Access', protectionLevel: 'Partially Protected', activePolicies: 1, icon: <Lock className="h-4 w-4" />, totalThreats: 0 },
      { name: 'Privilege Escalation', protectionLevel: 'Partially Protected', activePolicies: 1, icon: <AlertTriangle className="h-4 w-4" />, totalThreats: 0 },
      { name: 'DDoS Attempt', protectionLevel: 'Fully Protected', activePolicies: 2, icon: <Zap className="h-4 w-4" />, totalThreats: 0 },
      { name: 'Brute Force', protectionLevel: 'Fully Protected', activePolicies: 4, icon: <Shield className="h-4 w-4" />, totalThreats: 0 },
      { name: 'XSS Attack', protectionLevel: 'Not Protected', activePolicies: 0, icon: <Bug className="h-4 w-4" />, totalThreats: 0 },
      { name: 'CSRF Attack', protectionLevel: 'Not Protected', activePolicies: 0, icon: <Unlock className="h-4 w-4" />, totalThreats: 0 },
      { name: 'Token Theft', protectionLevel: 'Partially Protected', activePolicies: 1, icon: <ShieldAlert className="h-4 w-4" />, totalThreats: 0 },
      { name: 'Container Escape', protectionLevel: 'Not Protected', activePolicies: 0, icon: <Zap className="h-4 w-4" />, totalThreats: 0 },
    ]
    // Count threats per category
    const recentEvents = events.filter(e => Date.now() - e.timestamp.getTime() < 86400000)
    for (const e of recentEvents) {
      const cat = categories.find(c => c.name === e.type)
      if (cat) cat.totalThreats++
    }
    return categories
  }, [events])

  // Stat trend indicators
  const stats = useMemo(() => [
    {
      title: 'Total Threats',
      value: totalThreats,
      icon: Activity,
      trend: '+12%',
      trendUp: true,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
    },
    {
      title: 'Blocked Attempts',
      value: blockedAttempts,
      icon: ShieldCheck,
      trend: '+8%',
      trendUp: true,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    {
      title: 'Active Investigations',
      value: activeThreats,
      icon: Search,
      trend: activeThreats > 3 ? '+15%' : '-5%',
      trendUp: activeThreats <= 3,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
    },
    {
      title: 'Avg Response Time',
      value: avgResponseTime,
      suffix: 'ms',
      icon: Clock,
      trend: '-3%',
      trendUp: true,
      color: 'text-cyan-500',
      bg: 'bg-cyan-500/10',
    },
  ], [totalThreats, blockedAttempts, activeThreats, avgResponseTime])

  // Handlers
  const handleClear = useCallback(() => {
    setEvents([])
    setLastUpdated(new Date())
  }, [])

  const protectionLevelColor: Record<ProtectionLevel, string> = {
    'Fully Protected': 'text-emerald-500',
    'Partially Protected': 'text-amber-500',
    'Not Protected': 'text-red-500',
  }

  const protectionLevelBg: Record<ProtectionLevel, string> = {
    'Fully Protected': 'bg-emerald-500/10 border-emerald-500/20',
    'Partially Protected': 'bg-amber-500/10 border-amber-500/20',
    'Not Protected': 'bg-red-500/10 border-red-500/20',
  }

  return (
    <div className="h-full flex flex-col p-4 md:p-6 gap-4 md:gap-6 overflow-y-auto custom-scrollbar">
      {/* Section Header */}
      <div className="section-header-gradient section-header-accent rounded-xl px-4 py-3 -mx-4 -mt-2 md:-mx-6 md:-mt-4 mb-2 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2 gradient-text-shimmer">
              <ShieldAlert className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              Threat Intelligence
            </h2>
            <p className="text-sm text-muted-foreground">Real-time threat detection and policy protection analysis</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-muted/50 text-xs">
              <span className={`h-2 w-2 rounded-full ${threatLevel === 'Critical' ? 'bg-red-500 animate-pulse' : threatLevel === 'High' ? 'bg-red-400' : threatLevel === 'Moderate' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              <span className={levelStyle.text}>{threatLevel} Threat</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-muted/50 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span className="font-mono tabular-nums">{minutesAgo < 1 ? 'just now' : `${minutesAgo}m ago`}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Threat Level Banner */}
      <Card className={`glass-card glow-hover border-0 shadow-sm overflow-hidden`}>
        <div className={`${levelStyle.bg} border-b ${levelStyle.border} p-4 md:p-6`}>
          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
            {/* Threat Level Indicator */}
            <div className="flex flex-col items-center gap-2">
              <div className={`relative flex items-center justify-center w-20 h-20 rounded-full ${levelStyle.bg} border-2 ${levelStyle.border}`}>
                <ShieldAlert className={`h-8 w-8 ${levelStyle.text} ${threatLevel === 'Critical' ? 'animate-pulse' : ''}`} />
                {threatLevel === 'Critical' && (
                  <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 animate-ping" />
                )}
              </div>
              <span className={`text-sm font-bold ${levelStyle.text}`}>
                {threatLevel} Risk
              </span>
            </div>

            {/* Gauge Chart */}
            <div className="flex flex-col items-center">
              <ThreatGauge score={threatScore} />
              <span className="text-xs text-muted-foreground mt-1">Threat Score (0-100)</span>
            </div>

            {/* Key Metrics */}
            <div className="flex-1 grid grid-cols-2 gap-3 w-full md:w-auto">
              <div className="p-3 rounded-lg bg-background/50 backdrop-blur-sm border border-border/50">
                <div className="text-xs text-muted-foreground">Active Threats</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-red-500">{activeThreats}</div>
              </div>
              <div className="p-3 rounded-lg bg-background/50 backdrop-blur-sm border border-border/50">
                <div className="text-xs text-muted-foreground">Blocked Attempts</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-emerald-500">{blockedAttempts}</div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Threat Statistics Panel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="glass-card glow-hover border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
                <div className={`flex items-center gap-1 text-xs font-medium ${stat.trendUp ? 'text-emerald-500' : 'text-red-500'}`}>
                  {stat.trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {stat.trend}
                </div>
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums">
                {stat.value.toLocaleString()}
                {stat.suffix && <span className="text-sm text-muted-foreground ml-0.5">{stat.suffix}</span>}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{stat.title}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Live Threat Feed + Threat Map */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Live Threat Feed (2/3 width) */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          {/* Feed Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                <SelectTrigger className="h-8 w-[130px] text-xs">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severity</SelectItem>
                  <SelectItem value="Critical">🔴 Critical</SelectItem>
                  <SelectItem value="High">🟠 High</SelectItem>
                  <SelectItem value="Medium">🟡 Medium</SelectItem>
                  <SelectItem value="Low">🟢 Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Blocked">🛡 Blocked</SelectItem>
                  <SelectItem value="Monitored">👁 Monitored</SelectItem>
                  <SelectItem value="Investigating">🔍 Investigating</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              <Button
                variant={paused ? 'default' : 'ghost'}
                size="sm"
                className="h-8 gap-1.5 text-xs active:scale-[0.98]"
                onClick={() => setPaused(!paused)}
              >
                {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                {paused ? 'Resume' : 'Pause'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-red-500 active:scale-[0.98]"
                onClick={handleClear}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </Button>
            </div>
          </div>

          {/* Console Feed */}
          <Card className="flex-1 min-h-[300px] bg-gray-950 dark:bg-gray-950 border-gray-800 overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-800 flex items-center gap-2">
              <Terminal className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-xs text-gray-400 font-medium">Threat Feed</span>
              <div className="ml-auto flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${paused ? 'bg-gray-500' : 'bg-emerald-500 animate-pulse'}`} />
                <span className="text-[10px] text-gray-500 font-mono tabular-nums">{filteredEvents.length} events</span>
              </div>
            </div>
            <div
              ref={containerRef}
              className="h-[300px] overflow-y-auto custom-scrollbar font-mono text-xs leading-relaxed"
            >
              {filteredEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
                  <ShieldAlert className="h-16 w-16 opacity-20" />
                  <div className="text-center">
                    <p className="text-sm font-bold text-gray-400">
                      {paused ? 'Feed paused' : 'No threats detected'}
                    </p>
                    <p className="text-xs mt-1">
                      {paused ? 'Resume to continue monitoring' : 'Threat events will appear here in real-time'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 space-y-0.5">
                  <AnimatePresence initial={false}>
                    {filteredEvents.map((event, index) => (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, x: -12, height: 0 }}
                        animate={{ opacity: 1, x: 0, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, delay: index < 5 ? index * 0.03 : 0 }}
                        className="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-800/60 cursor-pointer transition-colors flex-wrap"
                      >
                        {/* Timestamp */}
                        <span className="text-gray-500 whitespace-nowrap font-mono tabular-nums">
                          [{formatTimestamp(event.timestamp)}]
                        </span>

                        {/* Threat Type */}
                        <span className="text-gray-300 whitespace-nowrap truncate max-w-[120px]">
                          {event.type}
                        </span>

                        <span className="text-gray-700 hidden sm:inline">|</span>

                        {/* Source → Target */}
                        <span className={`whitespace-nowrap font-semibold ${sourceColorMap[event.source] ?? 'text-gray-300'}`}>
                          {event.source}
                        </span>
                        <span className="text-gray-600">→</span>
                        <span className="text-gray-300 whitespace-nowrap">{event.target}</span>

                        <span className="text-gray-700 hidden sm:inline">|</span>

                        {/* Severity Badge */}
                        <Badge
                          variant="outline"
                          className={`text-[10px] h-5 px-1.5 border font-semibold hover:scale-105 transition-transform duration-150 ${severityColors[event.severity]}`}
                        >
                          {event.severity}
                        </Badge>

                        {/* Status Badge */}
                        <Badge
                          variant="outline"
                          className={`text-[10px] h-5 px-1.5 border font-semibold hover:scale-105 transition-transform duration-150 ${statusColors[event.status]}`}
                        >
                          {event.status}
                        </Badge>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </Card>

          {/* Feed Legend */}
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground flex-wrap">
            {Object.entries(severityColors).map(([sev, color]) => (
              <span key={sev} className="flex items-center gap-1">
                <Badge variant="outline" className={`text-[9px] h-4 px-1 ${color}`}>{sev}</Badge>
              </span>
            ))}
            <span className="text-gray-500">|</span>
            {Object.entries(statusColors).map(([status, color]) => (
              <span key={status} className="flex items-center gap-1">
                <Badge variant="outline" className={`text-[9px] h-4 px-1 ${color}`}>{status}</Badge>
              </span>
            ))}
          </div>
        </div>

        {/* Threat Map (1/3 width) */}
        <div className="flex flex-col gap-4">
          <ThreatMap events={events} />

          {/* Mini threat distribution */}
          <Card className="glass-card glow-hover border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                Severity Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(['Critical', 'High', 'Medium', 'Low'] as ThreatSeverity[]).map(sev => {
                const count = events.filter(e => e.severity === sev && Date.now() - e.timestamp.getTime() < 86400000).length
                const total = events.filter(e => Date.now() - e.timestamp.getTime() < 86400000).length || 1
                const pct = Math.round((count / total) * 100)
                const colorMap: Record<ThreatSeverity, string> = {
                  Critical: 'bg-red-500',
                  High: 'bg-orange-500',
                  Medium: 'bg-amber-500',
                  Low: 'bg-emerald-500',
                }
                return (
                  <div key={sev} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{sev}</span>
                      <span className="font-mono tabular-nums">{count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${colorMap[sev]}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Top Threat Sources Table */}
      <Card className="glass-card glow-hover border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Bug className="h-4 w-4 text-red-500" />
            Top Threat Sources
            <Badge variant="outline" className="text-[10px] ml-auto font-mono tabular-nums">
              {threatSources.length} sources
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Agent Role</TableHead>
                  <TableHead className="text-xs">Tool Name</TableHead>
                  <TableHead className="text-xs">Threat Count</TableHead>
                  <TableHead className="text-xs">Last Threat</TableHead>
                  <TableHead className="text-xs">Risk Level</TableHead>
                  <TableHead className="text-xs">Most Common Attack</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {threatSources.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground text-xs py-8">
                      No threat sources detected
                    </TableCell>
                  </TableRow>
                ) : (
                  threatSources.map((source) => (
                    <TableRow key={`${source.agentRole}-${source.toolName}`} className="table-row-hover transition-all duration-150">
                      <TableCell>
                        <span className={`text-xs font-medium ${sourceColorMap[source.agentRole] ?? ''}`}>
                          {source.agentRole}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">{source.toolName}</TableCell>
                      <TableCell>
                        <span className="text-xs font-mono tabular-nums font-medium">{source.threatCount}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-mono tabular-nums text-muted-foreground">
                          {formatRelativeTime(source.lastThreatTime)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] hover:scale-105 transition-transform duration-150 ${severityColors[source.riskLevel]}`}
                        >
                          {source.riskLevel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{source.mostCommonAttack}</span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Policy Protection Coverage */}
      <Card className="glass-card glow-hover border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Policy Protection Coverage
            <Badge variant="outline" className="text-[10px] ml-auto">
              {threatCategories.filter(c => c.protectionLevel === 'Fully Protected').length}/{threatCategories.length} covered
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {threatCategories.map((category) => (
              <motion.div
                key={category.name}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className={`p-3 rounded-lg border ${protectionLevelBg[category.protectionLevel]} transition-all duration-200 hover:shadow-md`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`${protectionLevelColor[category.protectionLevel]}`}>
                    {category.icon}
                  </div>
                  <span className="text-xs font-medium truncate flex-1">{category.name}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] font-semibold ${protectionLevelColor[category.protectionLevel]}`}>
                    {category.protectionLevel}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                    {category.totalThreats} threats
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    {category.activePolicies} {category.activePolicies === 1 ? 'policy' : 'policies'}
                  </span>
                  {category.protectionLevel !== 'Fully Protected' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 text-[10px] px-1.5 gap-0.5 active:scale-[0.98] text-emerald-600 dark:text-emerald-400 hover:text-emerald-700"
                    >
                      <Plus className="h-2.5 w-2.5" />
                      Add Policy
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
