'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useQuery } from '@tanstack/react-query'
import { GitBranch, ZoomIn, ZoomOut, Maximize2, ChevronDown, ChevronUp } from 'lucide-react'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'framer-motion'

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
}

const COLORS: Record<string, string> = {
  ALLOW: '#10b981',
  BLOCK: '#ef4444',
  REQUIRE_APPROVAL: '#f59e0b',
}

const DARK_COLORS: Record<string, string> = {
  ALLOW: '#34d399',
  BLOCK: '#f87171',
  REQUIRE_APPROVAL: '#fbbf24',
}

const LIGHT_BG: Record<string, string> = {
  ALLOW: '#d1fae5',
  BLOCK: '#fee2e2',
  REQUIRE_APPROVAL: '#fef3c7',
}

const DARK_BG: Record<string, string> = {
  ALLOW: '#064e3b',
  BLOCK: '#450a0a',
  REQUIRE_APPROVAL: '#451a03',
}

type NodeType = 'goal' | 'tool' | 'policy' | 'result'

interface GraphNode {
  id: string
  type: NodeType
  label: string
  sublabel?: string
  result?: string
  x: number
  y: number
  traceId?: string
}

interface GraphEdge {
  from: string
  to: string
  color: string
  animated?: boolean
}

export function ReasoningGraph() {
  const [selectedSession, setSelectedSession] = useState<string>('all')
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [legendCollapsed, setLegendCollapsed] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const { resolvedTheme } = useTheme()

  const isDark = resolvedTheme === 'dark'

  const { data: tracesData, isLoading } = useQuery<{ traces: TraceRecord[]; total: number }>({
    queryKey: ['traces-graph'],
    queryFn: async () => {
      const res = await fetch('/api/traces?limit=200')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
  })

  const traces = tracesData?.traces ?? []

  const sessions = useMemo(() => {
    const s = new Set(traces.map((t) => t.sessionId))
    return Array.from(s)
  }, [traces])

  const filteredTraces = useMemo(() => {
    if (selectedSession === 'all') return traces
    return traces.filter((t) => t.sessionId === selectedSession)
  }, [traces, selectedSession])

  const getColor = (result: string) => isDark ? (DARK_COLORS[result] ?? '#94a3b8') : (COLORS[result] ?? '#94a3b8')
  const getBg = (result?: string) => result ? (isDark ? (DARK_BG[result] ?? '#1f2937') : (LIGHT_BG[result] ?? '#f3f4f6')) : (isDark ? '#1f2937' : '#f3f4f6')

  const { nodes, edges } = useMemo(() => {
    const graphNodes: GraphNode[] = []
    const graphEdges: GraphEdge[] = []
    let y = 40

    const sessionGroups: Record<string, TraceRecord[]> = {}
    for (const t of filteredTraces) {
      if (!sessionGroups[t.sessionId]) sessionGroups[t.sessionId] = []
      sessionGroups[t.sessionId].push(t)
    }

    for (const sid of Object.keys(sessionGroups)) {
      sessionGroups[sid].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    }

    const sessionIds = Object.keys(sessionGroups).slice(0, 6)

    for (const sid of sessionIds) {
      const group = sessionGroups[sid]

      const goalId = `goal-${sid}`
      graphNodes.push({
        id: goalId,
        type: 'goal',
        label: 'Agent Goal',
        sublabel: sid.substring(0, 12) + '...',
        x: 160,
        y,
      })

      let prevId = goalId
      y += 70

      for (let i = 0; i < Math.min(group.length, 5); i++) {
        const trace = group[i]
        const toolNodeId = `tool-${trace.traceId}`
        const policyNodeId = `policy-${trace.traceId}`
        const resultNodeId = `result-${trace.traceId}`

        graphNodes.push({
          id: toolNodeId,
          type: 'tool',
          label: trace.toolName,
          sublabel: trace.agentRole,
          x: 160,
          y,
          traceId: trace.traceId,
        })
        graphEdges.push({ from: prevId, to: toolNodeId, color: isDark ? '#64748b' : '#94a3b8' })
        y += 60

        graphNodes.push({
          id: policyNodeId,
          type: 'policy',
          label: trace.evaluationResult === 'REQUIRE_APPROVAL' ? 'APPROVAL' : trace.evaluationResult,
          result: trace.evaluationResult,
          x: 160,
          y,
          traceId: trace.traceId,
        })
        graphEdges.push({
          from: toolNodeId,
          to: policyNodeId,
          color: getColor(trace.evaluationResult),
          animated: true,
        })
        y += 50

        graphNodes.push({
          id: resultNodeId,
          type: 'result',
          label: trace.evaluationResult === 'BLOCK' ? 'Blocked' : trace.evaluationResult === 'REQUIRE_APPROVAL' ? 'Pending Review' : 'Executed',
          result: trace.evaluationResult,
          x: 160,
          y,
          traceId: trace.traceId,
        })
        graphEdges.push({
          from: policyNodeId,
          to: resultNodeId,
          color: getColor(trace.evaluationResult),
        })
        y += 70

        prevId = resultNodeId
      }

      y += 30
    }

    return { nodes: graphNodes, edges: graphEdges }
  }, [filteredTraces, isDark, getColor])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }, [pan])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
  }, [isDragging, dragStart])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Touch event handlers for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true)
      setDragStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y })
    }
  }, [pan])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return
    setPan({ x: e.touches[0].clientX - dragStart.x, y: e.touches[0].clientY - dragStart.y })
  }, [isDragging, dragStart])

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  const textColor = isDark ? '#e2e8f0' : '#374151'
  const subTextColor = isDark ? '#94a3b8' : '#6b7280'

  const renderNode = (node: GraphNode) => {
    const isSelected = selectedNode?.id === node.id
    const isHovered = hoveredNode === node.id
    const resultColor = node.result ? getColor(node.result) : (isDark ? '#64748b' : '#6b7280')
    const bgColor = getBg(node.result)
    const highlight = isSelected || isHovered

    switch (node.type) {
      case 'goal':
        return (
          <g
            key={node.id}
            transform={`translate(${node.x}, ${node.y})`}
            onClick={() => setSelectedNode(node)}
            onMouseEnter={() => setHoveredNode(node.id)}
            onMouseLeave={() => setHoveredNode(null)}
            className="cursor-pointer"
          >
            <polygon
              points="0,-22 55,0 0,22 -55,0"
              fill={bgColor}
              stroke={highlight ? '#10b981' : resultColor}
              strokeWidth={highlight ? 3 : 2}
              style={{ transition: 'all 0.2s ease', filter: highlight ? 'drop-shadow(0 0 6px rgba(16,185,129,0.3))' : 'none' }}
            />
            <text textAnchor="middle" y={-4} className="text-[10px] font-semibold" fill={textColor}>
              {node.label}
            </text>
            <text textAnchor="middle" y={8} className="text-[8px]" fill={subTextColor}>
              {node.sublabel}
            </text>
          </g>
        )
      case 'tool':
        return (
          <g
            key={node.id}
            transform={`translate(${node.x}, ${node.y})`}
            onClick={() => setSelectedNode(node)}
            onMouseEnter={() => setHoveredNode(node.id)}
            onMouseLeave={() => setHoveredNode(null)}
            className="cursor-pointer"
          >
            <rect
              x={-60} y={-16} width={120} height={32} rx={6}
              fill={bgColor}
              stroke={highlight ? '#10b981' : (isDark ? '#475569' : '#94a3b8')}
              strokeWidth={highlight ? 3 : 1.5}
              style={{ transition: 'all 0.2s ease', filter: highlight ? 'drop-shadow(0 0 6px rgba(16,185,129,0.3))' : 'none' }}
            />
            <text textAnchor="middle" y={-3} className="text-[10px] font-semibold" fill={textColor}>
              {node.label}
            </text>
            <text textAnchor="middle" y={8} className="text-[8px]" fill={subTextColor}>
              {node.sublabel}
            </text>
          </g>
        )
      case 'policy':
        return (
          <g
            key={node.id}
            transform={`translate(${node.x}, ${node.y})`}
            onClick={() => setSelectedNode(node)}
            onMouseEnter={() => setHoveredNode(node.id)}
            onMouseLeave={() => setHoveredNode(null)}
            className="cursor-pointer"
          >
            <circle
              r={20}
              fill={bgColor}
              stroke={resultColor}
              strokeWidth={highlight ? 3 : 2}
              style={{ transition: 'all 0.2s ease', filter: highlight ? `drop-shadow(0 0 8px ${resultColor}40)` : 'none' }}
            />
            <text textAnchor="middle" y={3} className="text-[8px] font-bold" fill={resultColor}>
              {node.label}
            </text>
          </g>
        )
      case 'result':
        return (
          <g
            key={node.id}
            transform={`translate(${node.x}, ${node.y})`}
            onClick={() => setSelectedNode(node)}
            onMouseEnter={() => setHoveredNode(node.id)}
            onMouseLeave={() => setHoveredNode(null)}
            className="cursor-pointer"
          >
            <rect
              x={-48} y={-13} width={96} height={26} rx={13}
              fill={resultColor}
              fillOpacity={highlight ? 0.25 : 0.15}
              stroke={resultColor}
              strokeWidth={highlight ? 3 : 1.5}
              style={{ transition: 'all 0.2s ease', filter: highlight ? `drop-shadow(0 0 6px ${resultColor}40)` : 'none' }}
            />
            <text textAnchor="middle" y={3} className="text-[9px] font-semibold" fill={resultColor}>
              {node.label}
            </text>
          </g>
        )
    }
  }

  const maxH = nodes.length > 0 ? Math.max(...nodes.map((n) => n.y)) + 80 : 400

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Visual Reasoning Graph
          </h2>
          <p className="text-sm text-muted-foreground">Agent reasoning flow and policy decisions</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedSession} onValueChange={setSelectedSession}>
            <SelectTrigger className="h-8 text-sm w-full sm:w-48">
              <SelectValue placeholder="Select Session" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sessions</SelectItem>
              {sessions.map((s) => (
                <SelectItem key={s} value={s}>{s.substring(0, 20)}...</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7 active:scale-95 transition-transform" onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}>
              <ZoomOut className="h-3 w-3" />
            </Button>
            <span className="text-xs text-muted-foreground w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
            <Button variant="outline" size="icon" className="h-7 w-7 active:scale-95 transition-transform" onClick={() => setZoom(Math.min(2, zoom + 0.1))}>
              <ZoomIn className="h-3 w-3" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7 active:scale-95 transition-transform" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}>
              <Maximize2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Collapsible Legend */}
      <div className="border border-border rounded-lg">
        <button
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors duration-200"
          onClick={() => setLegendCollapsed(!legendCollapsed)}
        >
          <span>Legend</span>
          {legendCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
        </button>
        {!legendCollapsed && (
          <div className="px-3 pb-2 flex items-center gap-4 text-xs flex-wrap border-t border-border pt-2">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-emerald-500" /> Allow
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-red-500" /> Block
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-amber-500" /> Approval
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="12" height="12"><polygon points="6,0 12,6 6,12 0,6" fill={subTextColor} /></svg> Goal
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="12" height="12"><rect x="1" y="2" width="10" height="8" rx="2" fill={subTextColor} /></svg> Tool Call
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="12" height="12"><circle cx="6" cy="6" r="5" fill={subTextColor} /></svg> Decision
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="12" height="12"><rect x="1" y="2" width="10" height="8" rx="4" fill={subTextColor} /></svg> Result
            </div>
          </div>
        )}
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-96 text-muted-foreground text-sm">
              <div className="space-y-3 text-center">
                <div className="h-8 w-8 bg-muted animate-pulse rounded mx-auto" />
                <p>Loading graph data...</p>
              </div>
            </div>
          ) : nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-96 text-muted-foreground text-sm">
              <GitBranch className="h-10 w-10 mb-3 opacity-40" />
              <p className="font-medium">No trace data available</p>
              <p className="text-xs mt-1">Graph visualization requires execution trace data</p>
            </div>
          ) : (
            <div
              className="overflow-auto custom-scrollbar cursor-grab active:cursor-grabbing"
              style={{ maxHeight: '70vh' }}
            >
              <svg
                ref={svgRef}
                width={320 * zoom}
                height={maxH * zoom}
                viewBox={`0 0 320 ${maxH}`}
                className="select-none w-full sm:w-auto"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ transform: `translate(${pan.x}px, ${pan.y}px)`, touchAction: 'none' }}
              >
                <defs>
                  <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill={isDark ? '#64748b' : '#94a3b8'} />
                  </marker>
                  <marker id="arrowhead-green" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#10b981" />
                  </marker>
                  <marker id="arrowhead-red" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#ef4444" />
                  </marker>
                  <marker id="arrowhead-amber" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#f59e0b" />
                  </marker>
                </defs>

                {edges.map((edge, i) => {
                  const fromNode = nodes.find((n) => n.id === edge.from)
                  const toNode = nodes.find((n) => n.id === edge.to)
                  if (!fromNode || !toNode) return null

                  const markerId = edge.color === '#10b981' || edge.color === '#34d399'
                    ? 'arrowhead-green'
                    : edge.color === '#ef4444' || edge.color === '#f87171'
                    ? 'arrowhead-red'
                    : edge.color === '#f59e0b' || edge.color === '#fbbf24'
                    ? 'arrowhead-amber'
                    : 'arrowhead'

                  return (
                    <line
                      key={`edge-${i}`}
                      x1={fromNode.x}
                      y1={fromNode.y + 15}
                      x2={toNode.x}
                      y2={toNode.y - 15}
                      stroke={edge.color}
                      strokeWidth={1.5}
                      strokeDasharray={edge.animated ? '6 3' : 'none'}
                      markerEnd={`url(#${markerId})`}
                      style={edge.animated ? { animation: 'dashFlow 1s linear infinite' } : undefined}
                    />
                  )
                })}

                {nodes.map(renderNode)}
              </svg>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Node Details */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="border-0 shadow-sm hover:border-emerald-500/30 transition-colors duration-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge variant="outline" className="text-xs capitalize">{selectedNode.type}</Badge>
                  <span className="font-medium text-sm">{selectedNode.label}</span>
                  {selectedNode.sublabel && (
                    <span className="text-xs text-muted-foreground">{selectedNode.sublabel}</span>
                  )}
                  {selectedNode.result && (
                    <Badge
                      variant="outline"
                      className="text-xs transition-transform duration-150 hover:scale-105"
                      style={{ color: getColor(selectedNode.result), borderColor: getColor(selectedNode.result) }}
                    >
                      {selectedNode.result}
                    </Badge>
                  )}
                  {selectedNode.traceId && (
                    <span className="text-xs font-mono text-muted-foreground ml-auto">{selectedNode.traceId}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
