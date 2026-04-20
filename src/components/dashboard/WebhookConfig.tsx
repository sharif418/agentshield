'use client'

import { useState } from 'react'
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
import { Webhook as WebhookIcon, Plus, Pencil, Trash2, Loader2, Send, MessageSquare, MessagesSquare, Plane } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
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
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 flex flex-col items-center text-muted-foreground">
            <WebhookIcon className="h-12 w-12 mb-3 opacity-40" />
            <p className="text-sm font-medium">No webhooks configured</p>
            <p className="text-xs mt-1">Create one to start receiving notifications for policy events</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {webhooks.map((wh) => {
            const chConfig = getChannelConfig(wh.channel)
            const isShowingDelivery = showDelivery === wh.id

            return (
              <Card key={wh.id} className={cn('group hover:shadow-md hover:border-emerald-500/30 transition-all duration-300 border-0 shadow-sm border-l-2', chConfig.border)}>
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
