'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import {
  Bell,
  ShieldX,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Shield,
  CheckCheck,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useAppStore } from '@/lib/store'

// ── Types ────────────────────────────────────────────────────────────────
type NotificationType =
  | 'POLICY_BLOCKED'
  | 'APPROVAL_PENDING'
  | 'APPROVAL_RESOLVED'
  | 'HIGH_RISK'
  | 'POLICY_CREATED'

interface Notification {
  id: string
  type: NotificationType
  title: string
  description: string
  timestamp: Date
  read: boolean
}

// ── Config per type ──────────────────────────────────────────────────────
const typeConfig: Record<
  NotificationType,
  { icon: React.ElementType; accent: string; iconColor: string; bgColor: string }
> = {
  POLICY_BLOCKED: {
    icon: ShieldX,
    accent: 'border-l-red-500',
    iconColor: 'text-red-500',
    bgColor: 'bg-red-500/10',
  },
  APPROVAL_PENDING: {
    icon: Clock,
    accent: 'border-l-amber-500',
    iconColor: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
  },
  APPROVAL_RESOLVED: {
    icon: CheckCircle2,
    accent: 'border-l-emerald-500',
    iconColor: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
  },
  HIGH_RISK: {
    icon: AlertTriangle,
    accent: 'border-l-red-500',
    iconColor: 'text-red-500',
    bgColor: 'bg-red-500/10',
  },
  POLICY_CREATED: {
    icon: Shield,
    accent: 'border-l-emerald-500',
    iconColor: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
  },
}

// ── Helpers ──────────────────────────────────────────────────────────────
let uidCounter = 0
function uid() {
  uidCounter++
  return `ntf-${Date.now().toString(36)}-${uidCounter}-${Math.random().toString(36).slice(2, 7)}`
}

function randomPastDate(minutesBack: number): Date {
  return new Date(Date.now() - Math.floor(Math.random() * minutesBack * 60_000))
}

// ── Mock data generation from API data ───────────────────────────────────
function generateNotifications(
  stats: Record<string, unknown> | null | undefined,
  approvals: Array<Record<string, unknown>> | null | undefined,
  traces: { traces: Array<Record<string, unknown>> } | null | undefined,
): Notification[] {
  const notifications: Notification[] = []

  // 1. POLICY_BLOCKED from traces with BLOCK result
  if (traces?.traces) {
    const blocked = traces.traces.filter(
      (t) => t.evaluationResult === 'BLOCK',
    )
    blocked.slice(0, 3).forEach((t) => {
      notifications.push({
        id: uid(),
        type: 'POLICY_BLOCKED',
        title: 'Agent Blocked',
        description: `Agent ${String(t.agentRole ?? 'Unknown')} blocked from ${String(t.toolName ?? 'unknown tool')}`,
        timestamp: t.timestamp ? new Date(t.timestamp as string) : randomPastDate(60),
        read: false,
      })
    })

    // 2. HIGH_RISK from traces
    const agentBlockCounts: Record<string, { total: number; blocked: number }> = {}
    traces.traces.forEach((t) => {
      const role = String(t.agentRole ?? 'Unknown')
      if (!agentBlockCounts[role]) agentBlockCounts[role] = { total: 0, blocked: 0 }
      agentBlockCounts[role].total++
      if (t.evaluationResult === 'BLOCK') agentBlockCounts[role].blocked++
    })
    Object.entries(agentBlockCounts).forEach(([role, counts]) => {
      const riskScore = counts.total > 0 ? Math.round((counts.blocked / counts.total) * 100) : 0
      if (riskScore >= 20) {
        notifications.push({
          id: uid(),
          type: 'HIGH_RISK',
          title: 'High Risk Detected',
          description: `High risk detected: ${role} at ${riskScore}% risk`,
          timestamp: randomPastDate(30),
          read: false,
        })
      }
    })
  }

  // 3. APPROVAL_PENDING from pending approvals
  if (approvals && Array.isArray(approvals)) {
    approvals.slice(0, 3).forEach((a) => {
      const agentCtx = a.agentContext
        ? (() => {
            try {
              const ctx = typeof a.agentContext === 'string' ? JSON.parse(a.agentContext) : a.agentContext
              return String(ctx.role ?? ctx.agentRole ?? 'Unknown')
            } catch {
              return 'Unknown'
            }
          })()
        : 'Unknown'
      notifications.push({
        id: uid(),
        type: 'APPROVAL_PENDING',
        title: 'Approval Pending',
        description: `New approval request from ${agentCtx}`,
        timestamp: a.createdAt ? new Date(a.createdAt as string) : randomPastDate(45),
        read: false,
      })
    })
  }

  // 4. APPROVAL_RESOLVED from non-pending approvals
  if (approvals && Array.isArray(approvals)) {
    const resolved = approvals.filter(
      (a) => a.status === 'APPROVED' || a.status === 'REJECTED',
    )
    resolved.slice(0, 2).forEach((a) => {
      const status = a.status === 'APPROVED' ? 'approved' : 'rejected'
      notifications.push({
        id: uid(),
        type: 'APPROVAL_RESOLVED',
        title: 'Approval Resolved',
        description: `Approval ${String(a.requestId ?? 'unknown')} ${status}`,
        timestamp: a.reviewTimestamp
          ? new Date(a.reviewTimestamp as string)
          : randomPastDate(120),
        read: true,
      })
    })
  }

  // 5. POLICY_CREATED from stats
  if (stats?.totalPolicies && Number(stats.totalPolicies) > 0) {
    const policyCount = Number(stats.totalPolicies)
    const names = [
      'DataAgent Read Only',
      'Finance Write Guard',
      'Code Agent Sandbox',
      'Support Access Control',
    ]
    for (let i = 0; i < Math.min(2, policyCount); i++) {
      notifications.push({
        id: uid(),
        type: 'POLICY_CREATED',
        title: 'Policy Created',
        description: `New policy created: ${names[i % names.length]}`,
        timestamp: randomPastDate(180),
        read: i > 0,
      })
    }
  }

  // Ensure at least 8 notifications
  if (notifications.length < 8) {
    const fillerTypes: NotificationType[] = [
      'POLICY_BLOCKED',
      'APPROVAL_PENDING',
      'HIGH_RISK',
      'POLICY_CREATED',
    ]
    const fillerDescs: Record<string, string[]> = {
      POLICY_BLOCKED: [
        'Agent DataAgent blocked from PostgreSQL',
        'Agent CodeAgent blocked from ShellExec',
        'Agent FinanceAgent blocked from WireTransfer',
      ],
      APPROVAL_PENDING: [
        'New approval request from CodeAgent',
        'New approval request from FinanceAgent',
      ],
      HIGH_RISK: [
        'High risk detected: CodeAgent at 42% risk',
        'High risk detected: DataAgent at 35% risk',
      ],
      POLICY_CREATED: [
        'New policy created: Default Block Policy',
        'New policy created: Admin Override Rule',
      ],
    }
    while (notifications.length < 8) {
      const t = fillerTypes[notifications.length % fillerTypes.length]
      const descs = fillerDescs[t]
      notifications.push({
        id: uid(),
        type: t,
        title: typeConfig[t].icon === ShieldX ? 'Agent Blocked'
          : typeConfig[t].icon === Clock ? 'Approval Pending'
          : typeConfig[t].icon === AlertTriangle ? 'High Risk Detected'
          : 'Policy Created',
        description: descs[notifications.length % descs.length],
        timestamp: randomPastDate(240),
        read: notifications.length > 5,
      })
    }
  }

  // Sort by timestamp descending
  notifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  return notifications.slice(0, 12)
}

// ── Component ────────────────────────────────────────────────────────────
export function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [cleared, setCleared] = useState(false)
  const { setUnreadNotificationCount } = useAppStore()
  const prevDataKeyRef = useRef('')

  // Fetch API data for notification generation
  const { data: statsData } = useQuery({
    queryKey: ['notif-stats'],
    queryFn: async () => {
      const res = await fetch('/api/stats')
      if (!res.ok) return null
      return res.json() as Promise<Record<string, unknown>>
    },
    refetchInterval: 30_000,
  })

  const { data: approvalsData } = useQuery({
    queryKey: ['notif-approvals'],
    queryFn: async () => {
      const res = await fetch('/api/approvals?status=PENDING')
      if (!res.ok) return null
      return res.json() as Promise<Array<Record<string, unknown>>>
    },
    refetchInterval: 30_000,
  })

  const { data: tracesData } = useQuery({
    queryKey: ['notif-traces'],
    queryFn: async () => {
      const res = await fetch('/api/traces?limit=20')
      if (!res.ok) return null
      return res.json() as Promise<{ traces: Array<Record<string, unknown>> }>
    },
    refetchInterval: 30_000,
  })

  // Compute data key to detect fresh data loads
  const dataKey = `${statsData ? 's' : ''}${approvalsData ? 'a' : ''}${tracesData ? 't' : ''}-${statsData?.totalPolicies ?? ''}-${approvalsData?.length ?? ''}-${tracesData?.traces?.length ?? ''}`

  // Generate base notifications from API data (memoized)
  const generatedNotifications = useMemo(
    () => generateNotifications(statsData, approvalsData, tracesData),
    [statsData, approvalsData, tracesData],
  )

  // When fresh data arrives on a poll, add new items on top
  const [extraNotifications, setExtraNotifications] = useState<Notification[]>([])
  const hasInitialized = useRef(false)

  if (dataKey !== prevDataKeyRef.current && prevDataKeyRef.current !== '') {
    // Data changed due to a poll - schedule a new notification
    const prev = prevDataKeyRef.current
    setTimeout(() => {
      if (!hasInitialized.current) return
      const newNotif: Notification = {
        id: uid(),
        type: (['POLICY_BLOCKED', 'APPROVAL_PENDING', 'HIGH_RISK', 'POLICY_CREATED'] as NotificationType[])[Math.floor(Math.random() * 4)],
        title: 'New Activity Detected',
        description: 'Fresh data detected from the latest system poll',
        timestamp: new Date(),
        read: false,
      }
      setExtraNotifications((prev2) => [newNotif, ...prev2].slice(0, 5))
    }, 0)
  }
  prevDataKeyRef.current = dataKey

  // Mark as initialized after first data load
  if (generatedNotifications.length > 0 && !hasInitialized.current) {
    hasInitialized.current = true
  }

  // Merge generated + extra, then apply read state
  const notifications = useMemo(() => {
    if (cleared) return []
    const all = [...extraNotifications, ...generatedNotifications]
    // Deduplicate by id
    const seen = new Set<string>()
    const deduped = all.filter((n) => {
      if (seen.has(n.id)) return false
      seen.add(n.id)
      return true
    })
    // Apply read state
    return deduped.map((n) => ({
      ...n,
      read: readIds.has(n.id) ? true : n.read,
    }))
  }, [generatedNotifications, extraNotifications, readIds, cleared])

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  )

  // Sync unread count to global store (deferred to avoid cascading renders)
  const unreadCountRef = useRef(unreadCount)
  useEffect(() => {
    unreadCountRef.current = unreadCount
    const timer = setTimeout(() => {
      setUnreadNotificationCount(unreadCountRef.current)
    }, 0)
    return () => clearTimeout(timer)
  }, [unreadCount, setUnreadNotificationCount])

  // ── Actions ──────────────────────────────────────────────────────────
  const markAsRead = useCallback((id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  const markAllRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev)
      notifications.forEach((n) => next.add(n.id))
      return next
    })
  }, [notifications])

  const clearAll = useCallback(() => {
    setCleared(true)
    setExtraNotifications([])
  }, [])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 active:scale-95 transition-transform"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-80 sm:w-96 p-0 gap-0"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500/15 px-1.5 text-[10px] font-bold text-red-600 dark:text-red-400 leading-none">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {notifications.length > 0 && unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground active:scale-[0.98] transition-transform"
                onClick={markAllRead}
              >
                <CheckCheck className="h-3 w-3" />
                <span className="hidden sm:inline">Mark all read</span>
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground active:scale-[0.98] transition-transform"
                onClick={clearAll}
              >
                <Trash2 className="h-3 w-3" />
                <span className="hidden sm:inline">Clear</span>
              </Button>
            )}
          </div>
        </div>

        {/* Notification list */}
        <ScrollArea className="max-h-96">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <div className="rounded-full bg-muted p-3 mb-3">
                <Bell className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No notifications</p>
              <p className="text-xs text-muted-foreground/70 mt-1">You&apos;re all caught up!</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {notifications.map((notification) => {
                const config = typeConfig[notification.type]
                const Icon = config.icon

                return (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    layout
                  >
                    <button
                      type="button"
                      className={`
                        w-full text-left flex items-start gap-3 px-4 py-3
                        border-l-[3px] transition-colors duration-150
                        hover:bg-muted/50 cursor-pointer
                        ${
                          notification.read
                            ? 'border-l-transparent bg-transparent'
                            : `${config.accent} bg-muted/20`
                        }
                      `}
                      onClick={() => markAsRead(notification.id)}
                    >
                      {/* Icon */}
                      <div
                        className={`mt-0.5 shrink-0 rounded-md p-1.5 ${config.bgColor}`}
                      >
                        <Icon className={`h-3.5 w-3.5 ${config.iconColor}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-xs font-medium truncate ${
                              notification.read
                                ? 'text-muted-foreground'
                                : 'text-foreground'
                            }`}
                          >
                            {notification.title}
                          </span>
                          {!notification.read && (
                            <span className="shrink-0 h-2 w-2 rounded-full bg-red-500" />
                          )}
                        </div>
                        <p
                          className={`text-xs mt-0.5 leading-relaxed line-clamp-2 ${
                            notification.read
                              ? 'text-muted-foreground/70'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {notification.description}
                        </p>
                        <p className="text-[10px] text-muted-foreground/50 mt-1">
                          {formatDistanceToNow(notification.timestamp, {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </button>
                    <Separator className="last:hidden" />
                  </motion.div>
                )
              })}
            </AnimatePresence>
          )}
        </ScrollArea>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="border-t border-border px-4 py-2">
            <p className="text-[10px] text-muted-foreground/60 text-center">
              Auto-refreshes every 30s
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
