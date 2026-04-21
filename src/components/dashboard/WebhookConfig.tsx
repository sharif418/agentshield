'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Webhook as WebhookIcon, Plus, Pencil, Trash2, Loader2, Send, MessageSquare, MessagesSquare, Plane, BarChart3, TrendingUp, Clock, CheckCircle2, XCircle, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

interface WebhookConfigType {
  id: string
  name: string
  url: string
  channel: string
  events: string
  secret?: string | null
  enabled: boolean
  createdAt: string
  updatedAt: string
}

const channelConfig: Record<string, { icon: React.ReactNode; color: string; border: string; badge: string }> = {
  slack: {
    icon: <MessageSquare className="h-4 w-4" />,
    color: 'text-purple-600 dark:text-purple-400',
    border: 'border-l-purple-500/40',
    badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  },
  teams: {
    icon: <MessagesSquare className="h-4 w-4" />,
    color: 'text-sky-600 dark:text-sky-400',
    border: 'border-l-sky-500/40',
    badge: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
  },
  telegram: {
    icon: <Plane className="h-4 w-4" />,
    color: 'text-cyan-600 dark:text-cyan-400',
    border: 'border-l-cyan-500/40',
    badge: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
  },
}

const eventOptions = [
  'POLICY_CREATED',
  'POLICY_UPDATED',
  'POLICY_DELETED',
  'TRACE_EVALUATED',
  'APPROVAL_DECISION',
]

interface DeliveryRecord {
  id: string
  timestamp: string
  status: 'success' | 'failed'
  statusCode: number
}

const mockDeliveryHistory: Record<string, DeliveryRecord[]> = {
  slack: [
    { id: '1', timestamp: new Date(Date.now() - 300000).toISOString(), status: 'success', statusCode: 200 },
    { id: '2', timestamp: new Date(Date.now() - 900000).toISOString(), status: 'success', statusCode: 200 },
    { id: '3', timestamp: new Date(Date.now() - 1800000).toISOString(), status: 'failed', statusCode: 503 },
  ],
  teams: [
    { id: '1', timestamp: new Date(Date.now() - 600000).toISOString(), status: 'success', statusCode: 200 },
  ],
  telegram: [
    { id: '1', timestamp: new Date(Date.now() - 1200000).toISOString(), status: 'success', statusCode: 200 },
    { id: '2', timestamp: new Date(Date.now() - 3600000).toISOString(), status: 'failed', statusCode: 401 },
  ],
}

// ─── Delivery Analytics Component ─────────────────────────────────────────────

function DeliveryAnalyticsCard() {
  // Simulated delivery data for analytics
  const analyticsData = useMemo(() => {
    const allDeliveries = Object.values(mockDeliveryHistory).flat()
    const totalSent = 42
    const successCount = 38
    const failedCount = totalSent - successCount
    const successRate = Math.round((successCount / totalSent) * 100)
    const avgLatency = 245

    // Generate 24h success rate data for line chart
    const chartData: Array<{ hour: string; rate: number }> = []
    for (let i = 23; i >= 0; i--) {
      const h = new Date()
      h.setHours(h.getHours() - i)
      const hourLabel = h.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      // Simulate varying success rate
      const baseRate = 85 + Math.random() * 15
      const rate = i < 3 ? baseRate - Math.random() * 20 : baseRate
      chartData.push({ hour: hourLabel, rate: Math.min(Math.round(rate), 100) })
    }

    return { totalSent, successCount, failedCount, successRate, avgLatency, chartData }
  }, [])

  const { totalSent, successCount, failedCount, successRate, avgLatency, chartData } = analyticsData

  // SVG chart
  const chartWidth = 400
  const chartHeight = 80
  const padding = { top: 8, right: 8, bottom: 4, left: 8 }

  const linePoints = useMemo(() => {
    const cW = chartWidth - padding.left - padding.right
    const cH = chartHeight - padding.top - padding.bottom
    return chartData.map((d, i) => {
      const x = padding.left + (i / Math.max(chartData.length - 1, 1)) * cW
      const y = padding.top + cH - (d.rate / 100) * cH
      return { x, y }
    })
  }, [chartData, chartWidth, chartHeight, padding])

  const polylineStr = linePoints.map(p => `${p.x},${p.y}`).join(' ')

  const areaPath = useMemo(() => {
    if (linePoints.length === 0) return ''
    const cH = chartHeight - padding.top - padding.bottom
    let d = `M ${linePoints[0].x} ${padding.top + cH}`
    linePoints.forEach(p => { d += ` L ${p.x} ${p.y}` })
    d += ` L ${linePoints[linePoints.length - 1].x} ${padding.top + cH} Z`
    return d
  }, [linePoints, chartHeight, padding])

  const miniStatBoxes = [
    { label: 'Total Sent', value: totalSent, icon: Send, color: 'text-teal-600 dark:text-teal-400' },
    { label: 'Success Rate', value: `${successRate}%`, icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Avg Latency', value: `${avgLatency}ms`, icon: Clock, color: 'text-cyan-600 dark:text-cyan-400' },
    { label: 'Failed', value: failedCount, icon: XCircle, color: 'text-red-600 dark:text-red-400' },
  ]

  return (
    <Card className="border-0 shadow-sm glass-card glow-hover corner-accent">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Delivery Analytics
          <Badge variant="outline" className="text-[10px] font-mono tabular-nums ml-auto">Last 24h</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mini stat boxes */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {miniStatBoxes.map((box) => (
            <div key={box.label} className="rounded-lg border border-border/50 bg-muted/30 p-3 flex flex-col items-center gap-1">
              <box.icon className={`h-4 w-4 ${box.color}`} />
              <span className="font-mono tabular-nums text-sm font-bold">{box.value}</span>
              <span className="text-[10px] text-muted-foreground text-center leading-tight">{box.label}</span>
            </div>
          ))}
        </div>

        {/* Success rate line chart */}
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            Delivery Success Rate
          </div>
          <svg
            width="100%"
            height={chartHeight}
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            preserveAspectRatio="none"
            className="min-w-[300px]"
          >
            <defs>
              <linearGradient id="deliveryGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            {/* 80% baseline */}
            {(() => {
              const cH = chartHeight - padding.top - padding.bottom
              const y80 = padding.top + cH - 0.8 * cH
              return (
                <line
                  x1={padding.left}
                  y1={y80}
                  x2={chartWidth - padding.right}
                  y2={y80}
                  stroke="currentColor"
                  strokeOpacity={0.08}
                  strokeDasharray="3 3"
                />
              )
            })()}
            <path d={areaPath} fill="url(#deliveryGrad)" />
            <polyline
              points={polylineStr}
              fill="none"
              stroke="#10b981"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {linePoints.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={1.5}
                fill="#10b981"
                opacity={0.6}
              />
            ))}
          </svg>
        </div>
      </CardContent>
    </Card>
  )
}

export function WebhookConfigComponent() {
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editWebhook, setEditWebhook] = useState<WebhookConfigType | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<WebhookConfigType | null>(null)
  const [showDelivery, setShowDelivery] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [channel, setChannel] = useState('slack')
  const [events, setEvents] = useState<string[]>(['APPROVAL_DECISION'])
  const [secret, setSecret] = useState('')
  const [enabled, setEnabled] = useState(true)

  const { data: webhooks = [], isLoading } = useQuery<WebhookConfigType[]>({
    queryKey: ['webhooks'],
    queryFn: async () => {
      const res = await fetch('/api/webhooks')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
  })

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
      toast.success('Webhook created')
      setFormOpen(false)
      resetForm()
    },
    onError: () => toast.error('Failed to create webhook'),
  })

  const updateMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch('/api/webhooks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
      toast.success('Webhook updated')
      setFormOpen(false)
    },
    onError: () => toast.error('Failed to update webhook'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/webhooks?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
      toast.success('Webhook deleted')
      setDeleteTarget(null)
    },
    onError: () => toast.error('Failed to delete webhook'),
  })

  const resetForm = () => {
    setName('')
    setUrl('')
    setChannel('slack')
    setEvents(['APPROVAL_DECISION'])
    setSecret('')
    setEnabled(true)
  }

  const openEdit = (wh: WebhookConfigType) => {
    setEditWebhook(wh)
    setName(wh.name)
    setUrl(wh.url)
    setChannel(wh.channel)
    try {
      setEvents(JSON.parse(wh.events))
    } catch {
      setEvents([wh.events])
    }
    setSecret(wh.secret ?? '')
    setEnabled(wh.enabled)
    setFormOpen(true)
  }

  const handleSubmit = () => {
    if (!name || !url || !channel || events.length === 0) {
      toast.error('Please fill in all required fields')
      return
    }

    const body: Record<string, unknown> = { name, url, channel, events, secret, enabled }

    if (editWebhook) {
      body.id = editWebhook.id
      updateMutation.mutate(body)
    } else {
      createMutation.mutate(body)
    }
  }

  const toggleEvent = (event: string) => {
    setEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    )
  }

  const testWebhook = (wh: WebhookConfigType) => {
    toast.success(`Test event sent to ${wh.name}`, {
      description: `Channel: ${wh.channel} — Simulated delivery (200 OK)`,
    })
  }

  const getChannelConfig = (ch: string) => channelConfig[ch] ?? {
    icon: <WebhookIcon className="h-4 w-4" />,
    color: 'text-muted-foreground',
    border: 'border-l-border',
    badge: 'bg-muted text-muted-foreground border-border',
  }

  const deliveryHistory = (ch: string) => mockDeliveryHistory[ch] ?? []

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="section-header-gradient rounded-xl px-4 py-3 -mx-4 -mt-2 md:-mx-6 md:-mt-4 mb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2 bg-gradient-to-r from-emerald-700 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
              <WebhookIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Webhook Configuration
            </h2>
            <p className="text-sm text-muted-foreground">Manage notification webhooks for policy events</p>
          </div>
          <Button
            className="h-8 text-sm bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98] transition-transform"
            onClick={() => {
              setEditWebhook(null)
              resetForm()
              setFormOpen(true)
            }}
          >
            <Plus className="h-3 w-3 mr-1" /> New Webhook
          </Button>
        </div>
      </div>

      {/* Delivery Analytics */}
      <DeliveryAnalyticsCard />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-2">
                <div className="h-6 bg-muted animate-pulse rounded w-1/2" />
                <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                <div className="h-4 bg-muted animate-pulse rounded w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : webhooks.length === 0 ? (
        <Card className="border-0 shadow-sm glass-card glow-hover">
          <CardContent className="py-16 flex flex-col items-center text-muted-foreground">
            <WebhookIcon className="h-16 w-16 mb-4 opacity-20" />
            <p className="text-sm font-bold">No webhooks configured</p>
            <p className="text-xs mt-1 mb-4">Set up webhooks to receive real-time notifications</p>
            <Button
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98] transition-transform gap-1.5"
              onClick={() => {
                setEditWebhook(null)
                resetForm()
                setFormOpen(true)
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Create Webhook
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {webhooks.map((wh) => {
            const chConfig = getChannelConfig(wh.channel)
            const isShowingDelivery = showDelivery === wh.id

            return (
              <Card key={wh.id} className={cn('group glass-card glow-hover hover:shadow-md hover:border-emerald-500/30 transition-all duration-300 border-0 shadow-sm border-l-2', chConfig.border)}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50 shrink-0', chConfig.color)}>
                        {chConfig.icon}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-medium text-sm">{wh.name}</h3>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{wh.url}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant="outline" className={cn('text-xs capitalize transition-transform duration-150 hover:scale-105', chConfig.badge)}>{wh.channel}</Badge>
                      {wh.enabled ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 transition-transform duration-150 hover:scale-105" variant="outline">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Disabled</Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {(() => {
                      try {
                        return JSON.parse(wh.events).map((e: string) => (
                          <Badge key={e} variant="secondary" className="text-[10px]">{e}</Badge>
                        ))
                      } catch {
                        return <Badge variant="secondary" className="text-[10px]">{wh.events}</Badge>
                      }
                    })()}
                  </div>

                  {/* Delivery History */}
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-200"
                    onClick={() => setShowDelivery(isShowingDelivery ? null : wh.id)}
                  >
                    {isShowingDelivery ? 'Hide' : 'Show'} delivery history ({deliveryHistory(wh.channel).length})
                  </button>
                  {isShowingDelivery && (
                    <div className="space-y-1">
                      {deliveryHistory(wh.channel).map((d) => (
                        <div key={d.id} className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1">
                          <span className={d.status === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}>
                            {d.status === 'success' ? '●' : '✕'} {d.statusCode}
                          </span>
                          <span className="text-muted-foreground font-mono tabular-nums">
                            {new Date(d.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs active:scale-[0.98] transition-transform"
                      onClick={() => testWebhook(wh)}
                    >
                      <Send className="h-3 w-3 mr-1" /> Test
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs hover:bg-muted transition-colors duration-200"
                      onClick={() => openEdit(wh)}
                    >
                      <Pencil className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10 transition-colors duration-200 active:scale-95"
                      onClick={() => setDeleteTarget(wh)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create/Edit Dialog - full screen on mobile */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg dialog-fullscreen-mobile backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle className="tracking-tight">{editWebhook ? 'Edit Webhook' : 'Create Webhook'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Name *</Label>
              <Input
                className="h-8 text-sm"
                placeholder="e.g. Slack Policy Alerts"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">URL *</Label>
              <Input
                className="h-8 text-sm"
                placeholder="https://hooks.slack.com/services/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Channel *</Label>
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slack">Slack</SelectItem>
                    <SelectItem value="teams">Teams</SelectItem>
                    <SelectItem value="telegram">Telegram</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Secret</Label>
                <Input
                  className="h-8 text-sm"
                  type="password"
                  placeholder="whsec_..."
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Events *</Label>
              <div className="flex flex-wrap gap-2">
                {eventOptions.map((event) => (
                  <button
                    key={event}
                    type="button"
                    onClick={() => toggleEvent(event)}
                    className={`px-2 py-1 rounded text-xs border transition-all duration-200 active:scale-[0.98] ${
                      events.includes(event)
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                        : 'border-border text-muted-foreground hover:border-muted-foreground/30'
                    }`}
                  >
                    {event}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Enabled</Label>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} className="h-8 text-sm active:scale-[0.98] transition-transform">
              Cancel
            </Button>
            <Button
              className="h-8 text-sm bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98] transition-transform"
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              )}
              {editWebhook ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      {deleteTarget && (
        <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent className="backdrop-blur-sm">
            <DialogHeader>
              <DialogTitle>Delete Webhook</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete &quot;{deleteTarget.name}&quot;?
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)} className="h-8 text-sm active:scale-[0.98] transition-transform">
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="h-8 text-sm active:scale-[0.98] transition-transform"
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export { WebhookConfigComponent as WebhookConfig }
