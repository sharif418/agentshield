'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { useQuery } from '@tanstack/react-query'
import {
  Network,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Search,
  Filter,
  Maximize2,
  ChevronRight,
  X,
  Shield,
  Wrench,
  Users,
  Route,
  AlertTriangle,
  Link2,
  Target,
  CircleDot,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTheme } from 'next-themes'

// === Data Types ===

interface PolicyRecord {
  id: string
  policyId: string
  name: string
  description: string | null
  agentRole: string
  resource: string
  action: string
  permissionLevel: 'ALLOW' | 'BLOCK' | 'REQUIRE_APPROVAL'
  conditionRules: string | null
  priority: number
  enabled: boolean
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
  policy?: PolicyRecord | null
}

type NodeType = 'agent' | 'tool' | 'policy'

interface GraphNode {
  id: string
  type: NodeType
  label: string
  x: number
  y: number
  vx: number
  vy: number
  // Agent specific
  roleKey?: string
  policyCount?: number
  traceCount?: number
  riskLevel?: number
  // Tool specific
  connectedPolicies?: number
  // Policy specific
  permissionLevel?: 'ALLOW' | 'BLOCK' | 'REQUIRE_APPROVAL'
  priority?: number
  description?: string
  conditionRules?: string
  enabled?: boolean
  agentRole?: string
  resource?: string
  action?: string
  policyId?: string
}

interface GraphEdge {
  id: string
  source: string
  target: string
  type: 'agent-policy' | 'policy-tool'
}

// === Constants ===

const AGENT_ROLES = [
  { key: 'DataAgent', color: '#06b6d4', darkColor: '#22d3ee', bgLight: '#cffafe', bgDark: '#083344' },
  { key: 'CodeAgent', color: '#8b5cf6', darkColor: '#a78bfa', bgLight: '#ede9fe', bgDark: '#2e1065' },
  { key: 'FinanceAgent', color: '#f59e0b', darkColor: '#fbbf24', bgLight: '#fef3c7', bgDark: '#451a03' },
  { key: 'SupportAgent', color: '#f43f5e', darkColor: '#fb7185', bgLight: '#ffe4e6', bgDark: '#4c0519' },
]

const TOOLS = ['PostgreSQL', 'GitHub', 'Stripe', 'EmailAPI', 'FileSystem', 'Kubernetes']

const PERMISSION_COLORS: Record<string, { color: string; darkColor: string; bgLight: string; bgDark: string }> = {
  ALLOW: { color: '#10b981', darkColor: '#34d399', bgLight: '#d1fae5', bgDark: '#064e3b' },
  BLOCK: { color: '#ef4444', darkColor: '#f87171', bgLight: '#fee2e2', bgDark: '#450a0a' },
  REQUIRE_APPROVAL: { color: '#f59e0b', darkColor: '#fbbf24', bgLight: '#fef3c7', bgDark: '#451a03' },
}

const NODE_RADIUS: Record<NodeType, number> = { agent: 30, tool: 22, policy: 15 }

// === Force-Directed Layout Engine ===

function runForceSimulation(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
  iterations: number = 120
): GraphNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, { ...n, vx: 0, vy: 0 }]))
  const result = Array.from(nodeMap.values())

  // Initialize positions in a circle if they're at origin
  const needsInit = result.every((n) => n.x === 0 && n.y === 0)
  if (needsInit) {
    result.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / result.length
      const r = Math.min(width, height) * 0.35
      n.x = width / 2 + r * Math.cos(angle)
      n.y = height / 2 + r * Math.sin(angle)
    })
  }

  const edgeSet = new Set(edges.map((e) => `${e.source}-${e.target}`))
  const hasEdge = (a: string, b: string) => edgeSet.has(`${a}-${b}`) || edgeSet.has(`${b}-${a}`)

  for (let iter = 0; iter < iterations; iter++) {
    const alpha = 1 - iter / iterations
    const repulsionStrength = 8000 * alpha
    const springStrength = 0.005 * alpha
    const centerStrength = 0.01 * alpha
    const damping = 0.6

    // Repulsion between all pairs
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const a = result[i]
        const b = result[j]
        let dx = b.x - a.x
        let dy = b.y - a.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const force = repulsionStrength / (dist * dist)
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        a.vx -= fx
        a.vy -= fy
        b.vx += fx
        b.vy += fy
      }
    }

    // Spring forces for connected nodes
    for (const edge of edges) {
      const a = nodeMap.get(edge.source) ?? result.find((n) => n.id === edge.source)
      const b = nodeMap.get(edge.target) ?? result.find((n) => n.id === edge.target)
      if (!a || !b) continue
      const idealLength = 140
      let dx = b.x - a.x
      let dy = b.y - a.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const displacement = dist - idealLength
      const fx = (dx / dist) * displacement * springStrength
      const fy = (dy / dist) * displacement * springStrength
      a.vx += fx
      a.vy += fy
      b.vx -= fx
      b.vy -= fy
    }

    // Center gravity
    for (const node of result) {
      node.vx += (width / 2 - node.x) * centerStrength
      node.vy += (height / 2 - node.y) * centerStrength
    }

    // Apply velocity with damping and update positions
    for (const node of result) {
      node.vx *= damping
      node.vy *= damping
      node.x += node.vx
      node.y += node.vy
      // Keep in bounds with padding
      const pad = 60
      node.x = Math.max(pad, Math.min(width - pad, node.x))
      node.y = Math.max(pad, Math.min(height - pad, node.y))
    }
  }

  return result
}

// Radial layout: agents center ring, policies middle ring, tools outer ring
function computeRadialLayout(
  nodes: GraphNode[],
  width: number,
  height: number
): GraphNode[] {
  const cx = width / 2
  const cy = height / 2
  const maxR = Math.min(width, height) * 0.4
  const result = nodes.map((n) => ({ ...n, vx: 0, vy: 0 }))

  const agents = result.filter((n) => n.type === 'agent')
  const policies = result.filter((n) => n.type === 'policy')
  const tools = result.filter((n) => n.type === 'tool')

  const place = (items: GraphNode[], radius: number) => {
    items.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / items.length - Math.PI / 2
      n.x = cx + radius * Math.cos(angle)
      n.y = cy + radius * Math.sin(angle)
    })
  }

  place(agents, maxR * 0.3)
  place(policies, maxR * 0.65)
  place(tools, maxR * 0.95)

  return result
}

// BFS shortest path
function findShortestPath(
  nodes: GraphNode[],
  edges: GraphEdge[],
  startId: string,
  endId: string
): string[] | null {
  const adj = new Map<string, string[]>()
  for (const n of nodes) adj.set(n.id, [])
  for (const e of edges) {
    adj.get(e.source)?.push(e.target)
    adj.get(e.target)?.push(e.source)
  }

  const visited = new Set<string>()
  const queue: { id: string; path: string[] }[] = [{ id: startId, path: [startId] }]
  visited.add(startId)

  while (queue.length > 0) {
    const { id, path } = queue.shift()!
    if (id === endId) return path
    for (const neighbor of adj.get(id) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push({ id: neighbor, path: [...path, neighbor] })
      }
    }
  }

  return null
}

// === Main Component ===

export function PolicyDependencyGraph() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Data fetching
  const { data: policiesData, isLoading: policiesLoading } = useQuery<PolicyRecord[]>({
    queryKey: ['policies-depgraph'],
    queryFn: async () => {
      const res = await fetch('/api/policies')
      if (!res.ok) return []
      return res.json()
    },
  })

  const { data: tracesData, isLoading: tracesLoading } = useQuery<{ traces: TraceRecord[]; total: number }>({
    queryKey: ['traces-depgraph'],
    queryFn: async () => {
      const res = await fetch('/api/traces?limit=200')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
  })

  const policies = policiesData ?? []
  const traces = tracesData?.traces ?? []
  const isLoading = policiesLoading || tracesLoading

  // State
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [layoutMode, setLayoutMode] = useState<'force' | 'radial'>('force')
  const [showDisabled, setShowDisabled] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterAgents, setFilterAgents] = useState<Set<string>>(new Set(AGENT_ROLES.map((r) => r.key)))
  const [filterTools, setFilterTools] = useState<Set<string>>(new Set(TOOLS))
  const [filterPermissions, setFilterPermissions] = useState<Set<string>>(new Set(['ALLOW', 'BLOCK', 'REQUIRE_APPROVAL']))
  const [showFilters, setShowFilters] = useState(false)
  const [pathStart, setPathStart] = useState<string>('')
  const [pathEnd, setPathEnd] = useState<string>('')
  const [highlightedPath, setHighlightedPath] = useState<string[] | null>(null)

  // Drag state
  const svgRef = useRef<SVGSVGElement>(null)
  const [isDraggingNode, setIsDraggingNode] = useState(false)
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [nodePositions, setNodePositions] = useState<Map<string, { x: number; y: number }>>(new Map())

  // Graph dimensions
  const graphWidth = 900
  const graphHeight = 600

  // Build graph data
  const { nodes, edges } = useMemo(() => {
    const graphNodes: GraphNode[] = []
    const graphEdges: GraphEdge[] = []

    // Filter policies
    const filteredPolicies = policies.filter((p) => {
      if (!showDisabled && !p.enabled) return false
      if (!filterAgents.has(p.agentRole)) return false
      if (!filterPermissions.has(p.permissionLevel)) return false
      if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
      return true
    })

    // Compute stats per agent from traces
    const agentStats = new Map<string, { traceCount: number; blockCount: number }>()
    for (const t of traces) {
      const existing = agentStats.get(t.agentRole) ?? { traceCount: 0, blockCount: 0 }
      existing.traceCount++
      if (t.evaluationResult === 'BLOCK') existing.blockCount++
      agentStats.set(t.agentRole, existing)
    }

    // Add agent nodes
    for (const role of AGENT_ROLES) {
      if (!filterAgents.has(role.key)) continue
      const rolePolicies = filteredPolicies.filter((p) => p.agentRole === role.key)
      const stats = agentStats.get(role.key)
      graphNodes.push({
        id: `agent-${role.key}`,
        type: 'agent',
        label: role.key,
        roleKey: role.key,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        policyCount: rolePolicies.length,
        traceCount: stats?.traceCount ?? 0,
        riskLevel: stats ? Math.round((stats.blockCount / (stats.traceCount || 1)) * 100) : 0,
      })
    }

    // Add tool nodes
    for (const tool of TOOLS) {
      if (!filterTools.has(tool)) continue
      const toolPolicies = filteredPolicies.filter((p) => p.resource === tool)
      const toolTraces = traces.filter((t) => t.toolName === tool)
      graphNodes.push({
        id: `tool-${tool}`,
        type: 'tool',
        label: tool,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        connectedPolicies: toolPolicies.length,
        traceCount: toolTraces.length,
      })
    }

    // Add policy nodes
    for (const policy of filteredPolicies) {
      graphNodes.push({
        id: `policy-${policy.policyId}`,
        type: 'policy',
        label: policy.name,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        permissionLevel: policy.permissionLevel,
        priority: policy.priority,
        description: policy.description ?? undefined,
        conditionRules: policy.conditionRules ?? undefined,
        enabled: policy.enabled,
        agentRole: policy.agentRole,
        resource: policy.resource,
        action: policy.action,
        policyId: policy.policyId,
      })
    }

    // Add edges: Agent → Policy
    for (const policy of filteredPolicies) {
      const agentNodeId = `agent-${policy.agentRole}`
      const policyNodeId = `policy-${policy.policyId}`
      if (graphNodes.some((n) => n.id === agentNodeId) && graphNodes.some((n) => n.id === policyNodeId)) {
        graphEdges.push({
          id: `edge-${agentNodeId}-${policyNodeId}`,
          source: agentNodeId,
          target: policyNodeId,
          type: 'agent-policy',
        })
      }
    }

    // Add edges: Policy → Tool
    for (const policy of filteredPolicies) {
      const policyNodeId = `policy-${policy.policyId}`
      const toolNodeId = `tool-${policy.resource}`
      if (graphNodes.some((n) => n.id === toolNodeId) && graphNodes.some((n) => n.id === policyNodeId)) {
        graphEdges.push({
          id: `edge-${policyNodeId}-${toolNodeId}`,
          source: policyNodeId,
          target: toolNodeId,
          type: 'policy-tool',
        })
      }
    }

    return { nodes: graphNodes, edges: graphEdges }
  }, [policies, traces, showDisabled, filterAgents, filterTools, filterPermissions, searchQuery])

  // Compute layout - no side effects, just pure computation
  const computedNodes = useMemo(() => {
    if (layoutMode === 'radial') {
      return computeRadialLayout(nodes, graphWidth, graphHeight)
    }
    return runForceSimulation(nodes, edges, graphWidth, graphHeight)
  }, [nodes, edges, layoutMode])

  // Get node position (may be overridden by drag)
  const getNodePos = useCallback(
    (nodeId: string) => {
      // Use dragged position if user has manually moved this node
      if (nodePositions.has(nodeId)) {
        return nodePositions.get(nodeId)!
      }
      const computed = computedNodes.find((n) => n.id === nodeId)
      return computed ? { x: computed.x, y: computed.y } : { x: 0, y: 0 }
    },
    [computedNodes, nodePositions]
  )

  // Connected nodes/edges for selected node
  const connectedNodeIds = useMemo(() => {
    if (!selectedNodeId) return new Set<string>()
    const connected = new Set<string>()
    connected.add(selectedNodeId)
    for (const e of edges) {
      if (e.source === selectedNodeId) connected.add(e.target)
      if (e.target === selectedNodeId) connected.add(e.source)
    }
    return connected
  }, [selectedNodeId, edges])

  const selectedNode = useMemo(
    () => computedNodes.find((n) => n.id === selectedNodeId) ?? null,
    [computedNodes, selectedNodeId]
  )

  // Graph statistics
  const stats = useMemo(() => {
    const totalNodes = nodes.length
    const totalEdges = edges.length
    const agentNodes = nodes.filter((n) => n.type === 'agent')
    const avgPoliciesPerAgent = agentNodes.length > 0
      ? agentNodes.reduce((sum, n) => sum + (n.policyCount ?? 0), 0) / agentNodes.length
      : 0

    // Most connected node (hub)
    const connectionCount = new Map<string, number>()
    for (const e of edges) {
      connectionCount.set(e.source, (connectionCount.get(e.source) ?? 0) + 1)
      connectionCount.set(e.target, (connectionCount.get(e.target) ?? 0) + 1)
    }
    let hubId = ''
    let hubCount = 0
    for (const [id, count] of connectionCount) {
      if (count > hubCount) {
        hubId = id
        hubCount = count
      }
    }
    const hubNode = nodes.find((n) => n.id === hubId)

    // Orphan policies: policies with no agent or tool connections
    const policyNodeIds = new Set(nodes.filter((n) => n.type === 'policy').map((n) => n.id))
    const connectedPolicyIds = new Set<string>()
    for (const e of edges) {
      if (policyNodeIds.has(e.source)) connectedPolicyIds.add(e.source)
      if (policyNodeIds.has(e.target)) connectedPolicyIds.add(e.target)
    }
    const orphanCount = policyNodeIds.size - connectedPolicyIds.size

    // Density: actual edges / possible edges
    const maxEdges = totalNodes * (totalNodes - 1) / 2
    const density = maxEdges > 0 ? totalEdges / maxEdges : 0

    return { totalNodes, totalEdges, avgPoliciesPerAgent, hubNode, hubCount, orphanCount, density }
  }, [nodes, edges])

  // Path finder
  const computedPath = useMemo(() => {
    if (!pathStart || !pathEnd) return null
    return findShortestPath(nodes, edges, pathStart, pathEnd)
  }, [pathStart, pathEnd, nodes, edges])

  // Drag handlers for nodes
  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation()
      e.preventDefault()
      setIsDraggingNode(true)
      setDraggingNodeId(nodeId)
      setSelectedNodeId(nodeId)
    },
    []
  )

  // Pan handlers
  const handleBgMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === svgRef.current || (e.target as Element).tagName === 'rect' && (e.target as Element).classList.contains('graph-bg')) {
        setIsPanning(true)
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
        setSelectedNodeId(null)
      }
    },
    [pan]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDraggingNode && draggingNodeId) {
        const svgRect = svgRef.current?.getBoundingClientRect()
        if (!svgRect) return
        const svgX = (e.clientX - svgRect.left) / zoom - pan.x / zoom
        const svgY = (e.clientY - svgRect.top) / zoom - pan.y / zoom
        // Convert to viewBox coordinates
        const vbX = (svgX / svgRect.width) * graphWidth
        const vbY = (svgY / svgRect.height) * graphHeight
        setNodePositions((prev) => {
          const next = new Map(prev)
          next.set(draggingNodeId, { x: vbX, y: vbY })
          return next
        })
      } else if (isPanning) {
        setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y })
      }
    },
    [isDraggingNode, draggingNodeId, isPanning, panStart, zoom, pan]
  )

  const handleMouseUp = useCallback(() => {
    setIsDraggingNode(false)
    setDraggingNodeId(null)
    setIsPanning(false)
  }, [])

  // Touch handlers
  const handleTouchStart = useCallback(
    (e: React.TouchEvent, nodeId?: string) => {
      if (nodeId) {
        e.stopPropagation()
        setIsDraggingNode(true)
        setDraggingNodeId(nodeId)
        setSelectedNodeId(nodeId)
      } else if (e.touches.length === 1) {
        setIsPanning(true)
        setPanStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y })
      }
    },
    [pan]
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (isDraggingNode && draggingNodeId && e.touches.length === 1) {
        const svgRect = svgRef.current?.getBoundingClientRect()
        if (!svgRect) return
        const touch = e.touches[0]
        const svgX = (touch.clientX - svgRect.left) / zoom - pan.x / zoom
        const svgY = (touch.clientY - svgRect.top) / zoom - pan.y / zoom
        const vbX = (svgX / svgRect.width) * graphWidth
        const vbY = (svgY / svgRect.height) * graphHeight
        setNodePositions((prev) => {
          const next = new Map(prev)
          next.set(draggingNodeId, { x: vbX, y: vbY })
          return next
        })
      } else if (isPanning && e.touches.length === 1) {
        setPan({ x: e.touches[0].clientX - panStart.x, y: e.touches[0].clientY - panStart.y })
      }
    },
    [isDraggingNode, draggingNodeId, isPanning, panStart, zoom, pan]
  )

  const handleTouchEnd = useCallback(() => {
    setIsDraggingNode(false)
    setDraggingNodeId(null)
    setIsPanning(false)
  }, [])

  // Reset view
  const resetView = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setNodePositions(new Map())
  }, [])

  // Clear path
  const clearPath = useCallback(() => {
    setPathStart('')
    setPathEnd('')
    setHighlightedPath(null)
  }, [])

  // Compute highlighted path edges
  const highlightedEdgeIds = useMemo(() => {
    const path = highlightedPath ?? computedPath
    if (!path || path.length < 2) return new Set<string>()
    const edgeIds = new Set<string>()
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i]
      const b = path[i + 1]
      const fwd = edges.find((e) => (e.source === a && e.target === b))
      const rev = edges.find((e) => (e.source === b && e.target === a))
      if (fwd) edgeIds.add(fwd.id)
      if (rev) edgeIds.add(rev.id)
    }
    return edgeIds
  }, [highlightedPath, computedPath, edges])

  // Colors
  const getAgentColor = (roleKey: string) => {
    const role = AGENT_ROLES.find((r) => r.key === roleKey)
    return isDark ? (role?.darkColor ?? '#94a3b8') : (role?.color ?? '#64748b')
  }

  const getAgentBg = (roleKey: string) => {
    const role = AGENT_ROLES.find((r) => r.key === roleKey)
    return isDark ? (role?.bgDark ?? '#1f2937') : (role?.bgLight ?? '#f3f4f6')
  }

  const getPermColor = (perm: string) => {
    const c = PERMISSION_COLORS[perm]
    return isDark ? (c?.darkColor ?? '#94a3b8') : (c?.color ?? '#64748b')
  }

  const getPermBg = (perm: string) => {
    const c = PERMISSION_COLORS[perm]
    return isDark ? (c?.bgDark ?? '#1f2937') : (c?.bgLight ?? '#f3f4f6')
  }

  const textColor = isDark ? '#e2e8f0' : '#374151'
  const subTextColor = isDark ? '#94a3b8' : '#6b7280'
  const edgeColor = isDark ? '#334155' : '#cbd5e1'
  const gridDotColor = isDark ? 'rgba(148, 163, 184, 0.06)' : 'rgba(100, 116, 139, 0.08)'

  // Render node
  const renderNode = (node: GraphNode) => {
    const pos = getNodePos(node.id)
    const isSelected = selectedNodeId === node.id
    const isConnected = connectedNodeIds.has(node.id) && selectedNodeId !== null
    const isDimmed = selectedNodeId !== null && !isConnected
    const isInPath = highlightedPath?.includes(node.id) ?? false

    const opacity = isDimmed ? 0.25 : 1

    switch (node.type) {
      case 'agent': {
        const r = NODE_RADIUS.agent
        const color = getAgentColor(node.roleKey ?? '')
        const bg = getAgentBg(node.roleKey ?? '')
        return (
          <g
            key={node.id}
            transform={`translate(${pos.x}, ${pos.y})`}
            onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
            onTouchStart={(e) => handleTouchStart(e, node.id)}
            className="cursor-grab active:cursor-grabbing"
            style={{ opacity, transition: 'opacity 0.2s ease' }}
          >
            {isSelected && (
              <circle r={r + 8} fill="none" stroke={color} strokeWidth={2} opacity={0.4}>
                <animate attributeName="r" from={r + 4} to={r + 12} dur="1.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" from={0.4} to={0} dur="1.5s" repeatCount="indefinite" />
              </circle>
            )}
            {isInPath && (
              <circle r={r + 6} fill="none" stroke="#10b981" strokeWidth={2.5} strokeDasharray="4 2" opacity={0.7} />
            )}
            <circle r={r} fill={bg} stroke={color} strokeWidth={isSelected ? 3 : 2} style={{ transition: 'stroke-width 0.2s' }} />
            <text textAnchor="middle" y={-4} className="text-[9px] font-bold" fill={color}>
              {node.label.replace('Agent', '')}
            </text>
            <text textAnchor="middle" y={8} className="text-[7px]" fill={subTextColor}>
              Agent
            </text>
            {/* Policy count badge */}
            <circle cx={r * 0.7} cy={-r * 0.7} r={8} fill={color} />
            <text textAnchor="middle" x={r * 0.7} y={-r * 0.7 + 3} className="text-[7px] font-bold" fill="white">
              {node.policyCount ?? 0}
            </text>
          </g>
        )
      }
      case 'tool': {
        const r = NODE_RADIUS.tool
        const toolColor = isDark ? '#64748b' : '#475569'
        const toolBg = isDark ? '#1e293b' : '#f1f5f9'
        // Diamond shape
        return (
          <g
            key={node.id}
            transform={`translate(${pos.x}, ${pos.y})`}
            onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
            onTouchStart={(e) => handleTouchStart(e, node.id)}
            className="cursor-grab active:cursor-grabbing"
            style={{ opacity, transition: 'opacity 0.2s ease' }}
          >
            {isSelected && (
              <polygon
                points={`0,${-r - 8} ${r + 8},0 0,${r + 8} ${-r - 8},0`}
                fill="none"
                stroke="#10b981"
                strokeWidth={2}
                opacity={0.5}
              />
            )}
            {isInPath && (
              <polygon
                points={`0,${-r - 6} ${r + 6},0 0,${r + 6} ${-r - 6},0`}
                fill="none"
                stroke="#10b981"
                strokeWidth={2.5}
                strokeDasharray="4 2"
                opacity={0.7}
              />
            )}
            <polygon
              points={`0,${-r} ${r},0 0,${r} ${-r},0`}
              fill={toolBg}
              stroke={isSelected ? '#10b981' : toolColor}
              strokeWidth={isSelected ? 3 : 1.5}
              style={{ transition: 'stroke-width 0.2s' }}
            />
            <text textAnchor="middle" y={1} className="text-[7px] font-semibold" fill={textColor}>
              {node.label.length > 8 ? node.label.substring(0, 7) + '…' : node.label}
            </text>
            <text textAnchor="middle" y={10} className="text-[6px]" fill={subTextColor}>
              Tool
            </text>
          </g>
        )
      }
      case 'policy': {
        const r = NODE_RADIUS.policy
        const permColor = getPermColor(node.permissionLevel ?? 'ALLOW')
        const permBg = getPermBg(node.permissionLevel ?? 'ALLOW')
        const isDisabled = node.enabled === false
        return (
          <g
            key={node.id}
            transform={`translate(${pos.x}, ${pos.y})`}
            onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
            onTouchStart={(e) => handleTouchStart(e, node.id)}
            className="cursor-grab active:cursor-grabbing"
            style={{ opacity: isDisabled ? Math.min(opacity, 0.5) : opacity, transition: 'opacity 0.2s ease' }}
          >
            {isSelected && (
              <circle r={r + 6} fill="none" stroke="#10b981" strokeWidth={2} opacity={0.5}>
                <animate attributeName="r" from={r + 3} to={r + 10} dur="1.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" from={0.5} to={0} dur="1.5s" repeatCount="indefinite" />
              </circle>
            )}
            {isInPath && (
              <circle r={r + 5} fill="none" stroke="#10b981" strokeWidth={2.5} strokeDasharray="4 2" opacity={0.7} />
            )}
            <circle
              r={r}
              fill={permBg}
              stroke={isSelected ? '#10b981' : permColor}
              strokeWidth={isSelected ? 2.5 : 1.5}
              strokeDasharray={isDisabled ? '3 2' : 'none'}
              style={{ transition: 'stroke-width 0.2s' }}
            />
            <text textAnchor="middle" y={1} className="text-[6px] font-bold" fill={permColor}>
              {node.permissionLevel === 'REQUIRE_APPROVAL' ? 'REVIEW' : node.permissionLevel?.substring(0, 5)}
            </text>
            <text textAnchor="middle" y={8} className="text-[5px]" fill={subTextColor}>
              P{node.priority ?? 0}
            </text>
          </g>
        )
      }
    }
  }

  // Render edge
  const renderEdge = (edge: GraphEdge) => {
    const sourcePos = getNodePos(edge.source)
    const targetPos = getNodePos(edge.target)
    const sourceNode = computedNodes.find((n) => n.id === edge.source)
    const targetNode = computedNodes.find((n) => n.id === edge.target)

    const isSelected = selectedNodeId !== null && (edge.source === selectedNodeId || edge.target === selectedNodeId)
    const isDimmed = selectedNodeId !== null && !isSelected
    const isHighlighted = highlightedEdgeIds.has(edge.id)

    const strokeWidth = isHighlighted ? 3 : isSelected ? 2 : 1
    const strokeColor = isHighlighted
      ? '#10b981'
      : isSelected
        ? (isDark ? '#475569' : '#94a3b8')
        : edgeColor

    // Calculate direction for offset from node edge
    const dx = targetPos.x - sourcePos.x
    const dy = targetPos.y - sourcePos.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    const sourceR = NODE_RADIUS[sourceNode?.type ?? 'policy'] + 4
    const targetR = NODE_RADIUS[targetNode?.type ?? 'policy'] + 4

    const x1 = sourcePos.x + (dx / dist) * sourceR
    const y1 = sourcePos.y + (dy / dist) * sourceR
    const x2 = targetPos.x - (dx / dist) * targetR
    const y2 = targetPos.y - (dy / dist) * targetR

    return (
      <line
        key={edge.id}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        opacity={isDimmed ? 0.1 : isHighlighted ? 0.9 : 0.5}
        strokeDasharray={edge.type === 'agent-policy' ? 'none' : '4 2'}
        style={{ transition: 'opacity 0.2s ease' }}
        markerEnd={isHighlighted ? 'url(#arrowhead-emerald)' : isSelected ? 'url(#arrowhead-selected)' : 'url(#arrowhead-default)'}
      />
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Section Header */}
      <div className="section-header-gradient rounded-xl px-4 py-3 -mx-4 -mt-2 md:-mx-6 md:-mt-4 mb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2 bg-gradient-to-r from-emerald-700 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
              <Network className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Dependency Graph
            </h2>
            <p className="text-sm text-muted-foreground">Visualize policy relationships and dependencies</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Layout mode toggle */}
            <div className="flex items-center border border-border rounded-md overflow-hidden">
              <Button
                variant={layoutMode === 'force' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 text-xs rounded-none active:scale-[0.98]"
                onClick={() => { setLayoutMode('force'); setNodePositions(new Map()) }}
              >
                Force
              </Button>
              <Button
                variant={layoutMode === 'radial' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 text-xs rounded-none active:scale-[0.98]"
                onClick={() => { setLayoutMode('radial'); setNodePositions(new Map()) }}
              >
                Radial
              </Button>
            </div>
            {/* Zoom controls */}
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7 active:scale-95 transition-transform" onClick={() => setZoom(Math.max(0.3, zoom - 0.15))}>
                <ZoomOut className="h-3 w-3" />
              </Button>
              <span className="text-xs text-muted-foreground w-10 text-center font-mono tabular-nums">{Math.round(zoom * 100)}%</span>
              <Button variant="outline" size="icon" className="h-7 w-7 active:scale-95 transition-transform" onClick={() => setZoom(Math.min(3, zoom + 0.15))}>
                <ZoomIn className="h-3 w-3" />
              </Button>
              <Button variant="outline" size="icon" className="h-7 w-7 active:scale-95 transition-transform" onClick={resetView} title="Reset View">
                <RotateCcw className="h-3 w-3" />
              </Button>
              <Button variant="outline" size="icon" className="h-7 w-7 active:scale-95 transition-transform" onClick={() => { setZoom(1.5); setPan({ x: 0, y: 0 }) }} title="Fit View">
                <Maximize2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Main Graph Area */}
        <div className="flex-1 min-w-0">
          {/* Search & Filter Bar */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search policies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 text-xs pl-8"
              />
            </div>
            <Button
              variant={showFilters ? 'secondary' : 'outline'}
              size="sm"
              className="h-8 text-xs gap-1.5 active:scale-[0.98]"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-3 w-3" />
              Filters
            </Button>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Checkbox
                id="show-disabled"
                checked={showDisabled}
                onCheckedChange={(checked) => setShowDisabled(checked === true)}
                className="h-3.5 w-3.5"
              />
              <label htmlFor="show-disabled" className="cursor-pointer">Show disabled</label>
            </div>
          </div>

          {/* Filter Panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden mb-3"
              >
                <Card className="glass-card glow-hover">
                  <CardContent className="p-3 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Agent Role Filter */}
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />Agent Roles</p>
                        {AGENT_ROLES.map((role) => (
                          <div key={role.key} className="flex items-center gap-1.5">
                            <Checkbox
                              id={`filter-agent-${role.key}`}
                              checked={filterAgents.has(role.key)}
                              onCheckedChange={(checked) => {
                                const next = new Set(filterAgents)
                                if (checked) { next.add(role.key) } else { next.delete(role.key) }
                                setFilterAgents(next)
                              }}
                              className="h-3.5 w-3.5"
                            />
                            <label htmlFor={`filter-agent-${role.key}`} className="text-xs cursor-pointer flex items-center gap-1">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: role.color }} />
                              {role.key}
                            </label>
                          </div>
                        ))}
                      </div>
                      {/* Tool Filter */}
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Wrench className="h-3 w-3" />Tools</p>
                        {TOOLS.map((tool) => (
                          <div key={tool} className="flex items-center gap-1.5">
                            <Checkbox
                              id={`filter-tool-${tool}`}
                              checked={filterTools.has(tool)}
                              onCheckedChange={(checked) => {
                                const next = new Set(filterTools)
                                if (checked) { next.add(tool) } else { next.delete(tool) }
                                setFilterTools(next)
                              }}
                              className="h-3.5 w-3.5"
                            />
                            <label htmlFor={`filter-tool-${tool}`} className="text-xs cursor-pointer">{tool}</label>
                          </div>
                        ))}
                      </div>
                      {/* Permission Level Filter */}
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Shield className="h-3 w-3" />Permission</p>
                        {(['ALLOW', 'BLOCK', 'REQUIRE_APPROVAL'] as const).map((perm) => (
                          <div key={perm} className="flex items-center gap-1.5">
                            <Checkbox
                              id={`filter-perm-${perm}`}
                              checked={filterPermissions.has(perm)}
                              onCheckedChange={(checked) => {
                                const next = new Set(filterPermissions)
                                if (checked) { next.add(perm) } else { next.delete(perm) }
                                setFilterPermissions(next)
                              }}
                              className="h-3.5 w-3.5"
                            />
                            <label htmlFor={`filter-perm-${perm}`} className="text-xs cursor-pointer flex items-center gap-1">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PERMISSION_COLORS[perm].color }} />
                              {perm === 'REQUIRE_APPROVAL' ? 'REVIEW' : perm}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Graph SVG */}
          <Card className="border-0 shadow-sm glass-card glow-hover">
            <CardContent className="p-0 overflow-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center h-[500px] text-muted-foreground text-sm">
                  <div className="space-y-3 text-center">
                    <Network className="h-10 w-10 mx-auto animate-pulse opacity-40" />
                    <p>Loading dependency graph...</p>
                  </div>
                </div>
              ) : nodes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[500px] text-muted-foreground text-sm">
                  <Network className="h-10 w-10 mb-3 opacity-40" />
                  <p className="font-medium">No policy data available</p>
                  <p className="text-xs mt-1">Create policies to see the dependency graph</p>
                </div>
              ) : (
                <div className="overflow-auto custom-scrollbar" style={{ maxHeight: '70vh' }}>
                  <svg
                    ref={svgRef}
                    width={graphWidth * zoom}
                    height={graphHeight * zoom}
                    viewBox={`0 0 ${graphWidth} ${graphHeight}`}
                    className="select-none w-full"
                    onMouseDown={handleBgMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={(e) => { if (e.touches.length === 1) handleTouchStart(e) }}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    style={{ touchAction: 'none', transform: `translate(${pan.x}px, ${pan.y}px)` }}
                  >
                    <defs>
                      <marker id="arrowhead-default" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                        <polygon points="0 0, 6 2, 0 4" fill={edgeColor} />
                      </marker>
                      <marker id="arrowhead-selected" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                        <polygon points="0 0, 6 2, 0 4" fill={isDark ? '#475569' : '#94a3b8'} />
                      </marker>
                      <marker id="arrowhead-emerald" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                        <polygon points="0 0, 6 2, 0 4" fill="#10b981" />
                      </marker>
                      {/* Dot grid pattern */}
                      <pattern id="dot-grid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                        <circle cx="10" cy="10" r="0.8" fill={gridDotColor} />
                      </pattern>
                    </defs>

                    {/* Background with dot grid */}
                    <rect className="graph-bg" x="0" y="0" width={graphWidth} height={graphHeight} fill="transparent" />
                    <rect x="0" y="0" width={graphWidth} height={graphHeight} fill="url(#dot-grid)" />

                    {/* Edges */}
                    {edges.map(renderEdge)}

                    {/* Nodes */}
                    {computedNodes.map(renderNode)}
                  </svg>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Legend */}
          <div className="mt-3 flex items-center gap-4 text-xs flex-wrap text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <svg width="14" height="14"><circle cx="7" cy="7" r="6" fill="none" stroke={getAgentColor('DataAgent')} strokeWidth="2" /></svg>
              Agent Role
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="14" height="14"><polygon points="7,1 13,7 7,13 1,7" fill="none" stroke={isDark ? '#64748b' : '#475569'} strokeWidth="1.5" /></svg>
              Tool
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="14" height="14"><circle cx="7" cy="7" r="5" fill="none" stroke={getPermColor('ALLOW')} strokeWidth="1.5" /></svg>
              Policy
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> ALLOW
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500" /> BLOCK
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> REVIEW
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#10b981" strokeWidth="2.5" /></svg>
              Path
            </div>
          </div>
        </div>

        {/* Right Panel: Details + Stats + Path Finder */}
        <div className="w-full lg:w-80 space-y-4 shrink-0">
          {/* Node Detail Panel */}
          <AnimatePresence>
            {selectedNode && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="glass-card glow-hover">
                  <CardHeader className="pb-2 pt-3 px-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                        {selectedNode.type === 'agent' && <Users className="h-3.5 w-3.5" style={{ color: getAgentColor(selectedNode.roleKey ?? '') }} />}
                        {selectedNode.type === 'tool' && <Wrench className="h-3.5 w-3.5" />}
                        {selectedNode.type === 'policy' && <Shield className="h-3.5 w-3.5" style={{ color: getPermColor(selectedNode.permissionLevel ?? 'ALLOW') }} />}
                        Node Details
                      </CardTitle>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedNodeId(null)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-3 space-y-3">
                    {selectedNode.type === 'agent' && (
                      <>
                        <div>
                          <p className="text-xs text-muted-foreground">Role</p>
                          <p className="text-sm font-semibold flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getAgentColor(selectedNode.roleKey ?? '') }} />
                            {selectedNode.label}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-xs text-muted-foreground">Policies</p>
                            <p className="text-sm font-mono tabular-nums">{selectedNode.policyCount ?? 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Traces</p>
                            <p className="text-sm font-mono tabular-nums">{selectedNode.traceCount ?? 0}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Risk Level</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min(100, selectedNode.riskLevel ?? 0)}%`,
                                  backgroundColor: (selectedNode.riskLevel ?? 0) > 50 ? '#ef4444' : (selectedNode.riskLevel ?? 0) > 20 ? '#f59e0b' : '#10b981',
                                }}
                              />
                            </div>
                            <span className="text-xs font-mono tabular-nums">{selectedNode.riskLevel ?? 0}%</span>
                          </div>
                        </div>
                      </>
                    )}

                    {selectedNode.type === 'tool' && (
                      <>
                        <div>
                          <p className="text-xs text-muted-foreground">Tool Name</p>
                          <p className="text-sm font-semibold">{selectedNode.label}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-xs text-muted-foreground">Policies</p>
                            <p className="text-sm font-mono tabular-nums">{selectedNode.connectedPolicies ?? 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Traces</p>
                            <p className="text-sm font-mono tabular-nums">{selectedNode.traceCount ?? 0}</p>
                          </div>
                        </div>
                      </>
                    )}

                    {selectedNode.type === 'policy' && (
                      <>
                        <div>
                          <p className="text-xs text-muted-foreground">Policy Name</p>
                          <p className="text-sm font-semibold">{selectedNode.label}</p>
                        </div>
                        {selectedNode.description && (
                          <div>
                            <p className="text-xs text-muted-foreground">Description</p>
                            <p className="text-xs">{selectedNode.description}</p>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-xs text-muted-foreground">Permission</p>
                            <Badge
                              variant="outline"
                              className="text-[10px] hover:scale-105 transition-transform duration-150"
                              style={{ color: getPermColor(selectedNode.permissionLevel ?? 'ALLOW'), borderColor: getPermColor(selectedNode.permissionLevel ?? 'ALLOW') }}
                            >
                              {selectedNode.permissionLevel === 'REQUIRE_APPROVAL' ? 'REVIEW' : selectedNode.permissionLevel}
                            </Badge>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Priority</p>
                            <p className="text-sm font-mono tabular-nums">{selectedNode.priority ?? 0}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-xs text-muted-foreground">Agent</p>
                            <p className="text-xs">{selectedNode.agentRole}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Resource</p>
                            <p className="text-xs">{selectedNode.resource}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Action</p>
                          <p className="text-xs font-mono">{selectedNode.action}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground">Status:</p>
                          <Badge variant={selectedNode.enabled !== false ? 'default' : 'secondary'} className="text-[10px]">
                            {selectedNode.enabled !== false ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </div>
                        {selectedNode.conditionRules && (
                          <div>
                            <p className="text-xs text-muted-foreground">Conditions</p>
                            <ScrollArea className="max-h-20">
                              <p className="text-[10px] font-mono break-all">{selectedNode.conditionRules}</p>
                            </ScrollArea>
                          </div>
                        )}
                      </>
                    )}

                    <Separator />

                    {/* Connections */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">Connections</p>
                      <div className="space-y-1">
                        {edges
                          .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
                          .map((e) => {
                            const otherId = e.source === selectedNode.id ? e.target : e.source
                            const otherNode = computedNodes.find((n) => n.id === otherId)
                            if (!otherNode) return null
                            return (
                              <button
                                key={e.id}
                                className="flex items-center gap-1.5 text-xs w-full text-left px-1.5 py-1 rounded hover:bg-muted/50 transition-colors"
                                onClick={() => setSelectedNodeId(otherId)}
                              >
                                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                <span>{otherNode.label}</span>
                                <Badge variant="outline" className="text-[9px] ml-auto capitalize">{otherNode.type}</Badge>
                              </button>
                            )
                          })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Graph Statistics Card */}
          <Card className="glass-card glow-hover">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <CircleDot className="h-3.5 w-3.5" />
                Graph Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Total Nodes</p>
                  <p className="font-mono tabular-nums font-semibold">{stats.totalNodes}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Edges</p>
                  <p className="font-mono tabular-nums font-semibold">{stats.totalEdges}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Avg Policies/Agent</p>
                  <p className="font-mono tabular-nums font-semibold">{stats.avgPoliciesPerAgent.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Density Score</p>
                  <p className="font-mono tabular-nums font-semibold">{(stats.density * 100).toFixed(1)}%</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Hub Node</p>
                  <p className="font-semibold truncate">
                    {stats.hubNode ? (
                      <span className="flex items-center gap-1">
                        <Target className="h-3 w-3 text-emerald-500 shrink-0" />
                        {stats.hubNode.label}
                        <span className="text-muted-foreground font-mono tabular-nums">({stats.hubCount} connections)</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </p>
                </div>
                {stats.orphanCount > 0 && (
                  <div className="col-span-2 flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    <span className="font-mono tabular-nums">{stats.orphanCount}</span>
                    <span className="text-muted-foreground">orphan polic{stats.orphanCount === 1 ? 'y' : 'ies'}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Dependency Path Finder */}
          <Card className="glass-card glow-hover">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Route className="h-3.5 w-3.5" />
                Path Finder
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-2">
              <div>
                <label className="text-xs text-muted-foreground">Start Policy</label>
                <select
                  className="w-full h-7 text-xs rounded-md border border-input bg-background px-2 mt-0.5"
                  value={pathStart}
                  onChange={(e) => {
                    setPathStart(e.target.value)
                    if (e.target.value && pathEnd) setHighlightedPath(null)
                  }}
                >
                  <option value="">Select start...</option>
                  {nodes.filter((n) => n.type === 'policy').map((n) => (
                    <option key={n.id} value={n.id}>{n.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">End Policy</label>
                <select
                  className="w-full h-7 text-xs rounded-md border border-input bg-background px-2 mt-0.5"
                  value={pathEnd}
                  onChange={(e) => {
                    setPathEnd(e.target.value)
                    if (pathStart && e.target.value) setHighlightedPath(null)
                  }}
                >
                  <option value="">Select end...</option>
                  {nodes.filter((n) => n.type === 'policy').map((n) => (
                    <option key={n.id} value={n.id}>{n.label}</option>
                  ))}
                </select>
              </div>

              {pathStart && pathEnd && computedPath && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Link2 className="h-3 w-3 text-emerald-500" />
                    <span>Path length: <span className="font-mono tabular-nums font-semibold">{computedPath.length - 1}</span> hops</span>
                  </div>
                  <ScrollArea className="max-h-24">
                    <div className="space-y-0.5">
                      {computedPath.map((nodeId, i) => {
                        const n = computedNodes.find((nd) => nd.id === nodeId)
                        return (
                          <div key={nodeId} className="flex items-center gap-1 text-[10px]">
                            {i > 0 && <ChevronRight className="h-2.5 w-2.5 text-emerald-500" />}
                            <Badge variant="outline" className="text-[9px] capitalize py-0">{n?.type ?? ''}</Badge>
                            <span className="truncate">{n?.label ?? nodeId}</span>
                          </div>
                        )
                      })}
                    </div>
                  </ScrollArea>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-7 text-xs active:scale-[0.98]"
                    onClick={() => setHighlightedPath(computedPath)}
                  >
                    Highlight Path
                  </Button>
                </div>
              )}

              {pathStart && pathEnd && !computedPath && (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  No path found between these policies
                </p>
              )}

              {(pathStart || pathEnd || highlightedPath) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs text-muted-foreground active:scale-[0.98]"
                  onClick={clearPath}
                >
                  Clear Path
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
