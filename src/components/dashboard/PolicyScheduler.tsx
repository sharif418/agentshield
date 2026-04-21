'use client'

import { useState, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  CalendarClock,
  Calendar,
  Clock,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
  Edit,
  AlertTriangle,
  Shield,
  ArrowRight,
  Repeat,
  Timer,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Policy {
  id: string
  policyId: string
  name: string
  description?: string
  agentRole: string
  resource: string
  action: string
  permissionLevel: string
  priority: number
  enabled: boolean
}

type ScheduleAction = 'Enable' | 'Disable'
type ScheduleRecurrence = 'One-time' | 'Daily' | 'Weekly' | 'Monthly'
type ScheduleStatus = 'Pending' | 'Active' | 'Completed' | 'Failed'

interface ScheduledItem {
  id: string
  policyName: string
  policyId: string
  action: ScheduleAction
  scheduledTime: Date
  recurrence: ScheduleRecurrence
  status: ScheduleStatus
  createdBy: string
  description?: string
}

// ─── Color Maps ──────────────────────────────────────────────────────────────

const ACTION_COLORS: Record<ScheduleAction, string> = {
  Enable:
    'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  Disable:
    'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
}

const ACTION_DOT_COLORS: Record<ScheduleAction, string> = {
  Enable: 'bg-emerald-500',
  Disable: 'bg-red-500',
}

const STATUS_COLORS: Record<ScheduleStatus, string> = {
  Pending:
    'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  Active:
    'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  Completed:
    'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
  Failed:
    'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
}

const STATUS_DOT_COLORS: Record<ScheduleStatus, string> = {
  Pending: 'bg-amber-500',
  Active: 'bg-emerald-500',
  Completed: 'bg-cyan-500',
  Failed: 'bg-red-500',
}

const RECURRENCE_COLORS: Record<ScheduleRecurrence, string> = {
  'One-time':
    'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/25',
  Daily:
    'bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-500/25',
  Weekly:
    'bg-violet-500/10 text-violet-600 dark:text-violet-300 border-violet-500/25',
  Monthly:
    'bg-orange-500/10 text-orange-600 dark:text-orange-300 border-orange-500/25',
}

const RECURRENCE_ICONS: Record<ScheduleRecurrence, React.ReactNode> = {
  'One-time': <Timer className="h-3 w-3" />,
  Daily: <Calendar className="h-3 w-3" />,
  Weekly: <Repeat className="h-3 w-3" />,
  Monthly: <CalendarClock className="h-3 w-3" />,
}

// ─── Quick Schedule Presets ──────────────────────────────────────────────────

interface QuickSchedulePreset {
  label: string
  description: string
  action: ScheduleAction
  recurrence: ScheduleRecurrence
  color: string
  icon: React.ReactNode
}

const QUICK_SCHEDULE_PRESETS: QuickSchedulePreset[] = [
  {
    label: 'Disable All on Weekend',
    description: 'All policies disabled Saturday 00:00, weekly',
    action: 'Disable',
    recurrence: 'Weekly',
    color:
      'bg-red-600 hover:bg-red-700 text-white',
    icon: <Pause className="h-4 w-4" />,
  },
  {
    label: 'Enable During Business Hours',
    description: 'All policies enabled 9AM weekdays, daily',
    action: 'Enable',
    recurrence: 'Daily',
    color:
      'bg-emerald-600 hover:bg-emerald-700 text-white',
    icon: <Play className="h-4 w-4" />,
  },
  {
    label: 'Emergency Lockdown',
    description: 'Disable all policies immediately',
    action: 'Disable',
    recurrence: 'One-time',
    color:
      'bg-red-700 hover:bg-red-800 text-white',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
]

// ─── Helper: Generate mock schedule data ─────────────────────────────────────

function generateMockSchedules(policies: Policy[]): ScheduledItem[] {
  const now = new Date()
  const schedules: ScheduledItem[] = []

  const creators = ['admin@agentshield.io', 'security-team', 'ops-automation', 'ciso']

  // Past schedules
  const pastOffsets = [
    { h: -6, m: 0 },
    { h: -2, m: 30 },
    { h: -1, m: 15 },
  ]
  pastOffsets.forEach((offset, i) => {
    const policy = policies[i % policies.length]
    if (!policy) return
    const scheduledTime = new Date(now.getTime() + offset.h * 3600000 + offset.m * 60000)
    schedules.push({
      id: `sch-past-${i}`,
      policyName: policy.name,
      policyId: policy.policyId,
      action: i % 2 === 0 ? 'Disable' : 'Enable',
      scheduledTime,
      recurrence: i === 0 ? 'One-time' : i === 1 ? 'Daily' : 'Weekly',
      status: i === 2 ? 'Failed' : 'Completed',
      createdBy: creators[i % creators.length],
      description: i === 2 ? 'Failed: policy not found at execution time' : undefined,
    })
  })

  // Active / current schedules
  schedules.push({
    id: 'sch-active-1',
    policyName: policies[0]?.name ?? 'DataAgent PostgreSQL Block',
    policyId: policies[0]?.policyId ?? 'POL-xxx',
    action: 'Enable',
    scheduledTime: new Date(now.getTime() - 60000),
    recurrence: 'Daily',
    status: 'Active',
    createdBy: 'ops-automation',
    description: 'Daily morning enable cycle',
  })

  // Future schedules (8-9 more)
  const futureConfigs = [
    { offsetH: 2, action: 'Enable' as ScheduleAction, recurrence: 'Daily' as ScheduleRecurrence, status: 'Pending' as ScheduleStatus },
    { offsetH: 5, action: 'Disable' as ScheduleAction, recurrence: 'Weekly' as ScheduleRecurrence, status: 'Pending' as ScheduleStatus },
    { offsetH: 12, action: 'Enable' as ScheduleAction, recurrence: 'Daily' as ScheduleRecurrence, status: 'Pending' as ScheduleStatus },
    { offsetH: 24, action: 'Disable' as ScheduleAction, recurrence: 'Monthly' as ScheduleRecurrence, status: 'Pending' as ScheduleStatus },
    { offsetH: 48, action: 'Enable' as ScheduleAction, recurrence: 'Weekly' as ScheduleRecurrence, status: 'Pending' as ScheduleStatus },
    { offsetH: 72, action: 'Disable' as ScheduleAction, recurrence: 'One-time' as ScheduleRecurrence, status: 'Pending' as ScheduleStatus },
    { offsetH: 96, action: 'Enable' as ScheduleAction, recurrence: 'Daily' as ScheduleRecurrence, status: 'Pending' as ScheduleStatus },
    { offsetH: 168, action: 'Disable' as ScheduleAction, recurrence: 'Weekly' as ScheduleRecurrence, status: 'Pending' as ScheduleStatus },
  ]

  futureConfigs.forEach((cfg, i) => {
    const policy = policies[(i + 1) % Math.max(policies.length, 1)]
    if (!policy) return
    const scheduledTime = new Date(now.getTime() + cfg.offsetH * 3600000)
    schedules.push({
      id: `sch-future-${i}`,
      policyName: policy.name,
      policyId: policy.policyId,
      action: cfg.action,
      scheduledTime,
      recurrence: cfg.recurrence,
      status: cfg.status,
      createdBy: creators[(i + 2) % creators.length],
    })
  })

  return schedules
}

// ─── Create Schedule Dialog ──────────────────────────────────────────────────

function CreateScheduleDialog({
  open,
  onOpenChange,
  policies,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  policies: Policy[]
  onCreate: (item: Omit<ScheduledItem, 'id' | 'status'>) => void
}) {
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>('')
  const [action, setAction] = useState<ScheduleAction>('Enable')
  const [dateTime, setDateTime] = useState<string>('')
  const [recurrence, setRecurrence] = useState<ScheduleRecurrence>('One-time')
  const [description, setDescription] = useState('')

  const handleCreate = useCallback(() => {
    const policy = policies.find((p) => p.policyId === selectedPolicyId)
    if (!policy) {
      toast.error('Please select a policy')
      return
    }
    if (!dateTime) {
      toast.error('Please select a date and time')
      return
    }
    onCreate({
      policyName: policy.name,
      policyId: policy.policyId,
      action,
      scheduledTime: new Date(dateTime),
      recurrence,
      createdBy: 'admin@agentshield.io',
      description: description || undefined,
    })
    // Reset
    setSelectedPolicyId('')
    setAction('Enable')
    setDateTime('')
    setRecurrence('One-time')
    setDescription('')
    onOpenChange(false)
  }, [policies, selectedPolicyId, action, dateTime, recurrence, description, onCreate, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-fullscreen-mobile max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 tracking-tight">
            <CalendarClock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            New Schedule
          </DialogTitle>
          <DialogDescription>
            Schedule a policy activation or deactivation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Policy Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Policy</Label>
            <Select value={selectedPolicyId} onValueChange={setSelectedPolicyId}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select a policy..." />
              </SelectTrigger>
              <SelectContent>
                {policies.map((p) => (
                  <SelectItem key={p.policyId} value={p.policyId}>
                    <span className="flex items-center gap-2">
                      <Shield className="h-3 w-3 text-emerald-500" />
                      {p.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Action: Enable / Disable */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Action</Label>
            <div className="flex gap-3">
              <button
                type="button"
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all duration-150 active:scale-[0.98] ${
                  action === 'Enable'
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted/50'
                }`}
                onClick={() => setAction('Enable')}
              >
                <Play className="h-3.5 w-3.5" />
                Enable
              </button>
              <button
                type="button"
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all duration-150 active:scale-[0.98] ${
                  action === 'Disable'
                    ? 'border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300'
                    : 'border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted/50'
                }`}
                onClick={() => setAction('Disable')}
              >
                <Pause className="h-3.5 w-3.5" />
                Disable
              </button>
            </div>
          </div>

          {/* Date/Time Picker */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Scheduled Time</Label>
            <Input
              type="datetime-local"
              className="h-9 text-sm"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
            />
          </div>

          {/* Recurrence */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Recurrence</Label>
            <Select
              value={recurrence}
              onValueChange={(v) => setRecurrence(v as ScheduleRecurrence)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['One-time', 'Daily', 'Weekly', 'Monthly'] as ScheduleRecurrence[]).map(
                  (r) => (
                    <SelectItem key={r} value={r}>
                      <span className="flex items-center gap-2">
                        {RECURRENCE_ICONS[r]}
                        {r}
                      </span>
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Notes (optional)</Label>
            <Textarea
              className="text-xs min-h-[60px] resize-none"
              placeholder="Add a description or reason for this schedule..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Create Button */}
          <Button
            className="w-full h-10 text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white active:scale-[0.98] transition-transform font-medium"
            onClick={handleCreate}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Schedule
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Schedule Timeline ───────────────────────────────────────────────────────

function ScheduleTimeline({ schedules }: { schedules: ScheduledItem[] }) {
  const now = new Date()
  const upcomingSchedules = [...schedules]
    .filter((s) => s.status !== 'Completed' && s.status !== 'Failed')
    .sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime())

  const pastSchedules = [...schedules]
    .filter((s) => s.status === 'Completed' || s.status === 'Failed')
    .sort((a, b) => b.scheduledTime.getTime() - a.scheduledTime.getTime())
    .slice(0, 3)

  return (
    <Card className="glass-card glow-hover corner-accent border border-border/50 rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ArrowRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Schedule Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-96">
          <div className="relative pl-6">
            {/* Now Indicator */}
            <div className="absolute left-[7px] top-0 bottom-0 w-0.5 bg-border" />
            <div className="relative flex items-center gap-2 mb-4 -ml-6">
              <div className="h-4 w-4 rounded-full bg-emerald-500 ring-pulse shrink-0 z-10" />
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Now
                </span>
                <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                  {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            {/* Upcoming */}
            <AnimatePresence>
              {upcomingSchedules.map((schedule, i) => (
                <motion.div
                  key={schedule.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ delay: i * 0.05, duration: 0.2 }}
                  className="relative flex items-start gap-3 mb-4"
                >
                  {/* Timeline dot */}
                  <div
                    className={`absolute left-[-21px] top-1.5 h-3 w-3 rounded-full shrink-0 z-10 ${ACTION_DOT_COLORS[schedule.action]}`}
                  />
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium truncate">
                        {schedule.policyName}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1 py-0 shrink-0 ${ACTION_COLORS[schedule.action]}`}
                      >
                        {schedule.action}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <Clock className="h-2.5 w-2.5" />
                      <span className="font-mono tabular-nums">
                        {schedule.scheduledTime.toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="opacity-60">
                        ({formatDistanceToNow(schedule.scheduledTime, { addSuffix: true })})
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Past (grayed out) */}
            {pastSchedules.length > 0 && (
              <>
                <Separator className="my-3 opacity-30" />
                <p className="text-[10px] text-muted-foreground mb-2 -ml-6">Past</p>
                {pastSchedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className="relative flex items-start gap-3 mb-3 opacity-40"
                  >
                    <div className="absolute left-[-21px] top-1.5 h-3 w-3 rounded-full shrink-0 z-10 bg-gray-400 dark:bg-gray-600" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium truncate">
                          {schedule.policyName}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[9px] px-1 py-0 shrink-0 ${ACTION_COLORS[schedule.action]}`}
                        >
                          {schedule.action}
                        </Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono tabular-nums">
                        {schedule.scheduledTime.toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {upcomingSchedules.length === 0 && pastSchedules.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground -ml-6">
                <CalendarClock className="h-8 w-8 mb-2 opacity-20" />
                <p className="text-xs">No schedules</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

// ─── Schedule Statistics Card ────────────────────────────────────────────────

function ScheduleStats({ schedules }: { schedules: ScheduledItem[] }) {
  const stats = useMemo(() => {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 3600000)
    return {
      total: schedules.length,
      active: schedules.filter((s) => s.status === 'Active').length,
      completedThisWeek: schedules.filter(
        (s) => s.status === 'Completed' && s.scheduledTime >= weekAgo
      ).length,
      failed: schedules.filter((s) => s.status === 'Failed').length,
    }
  }, [schedules])

  const statItems = [
    {
      label: 'Total Scheduled',
      value: stats.total,
      icon: <CalendarClock className="h-4 w-4" />,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Active Now',
      value: stats.active,
      icon: <Play className="h-4 w-4" />,
      color: 'text-cyan-600 dark:text-cyan-400',
      bg: 'bg-cyan-500/10',
    },
    {
      label: 'Completed This Week',
      value: stats.completedThisWeek,
      icon: <CheckCircle className="h-4 w-4" />,
      color: 'text-violet-600 dark:text-violet-400',
      bg: 'bg-violet-500/10',
    },
    {
      label: 'Failed',
      value: stats.failed,
      icon: <XCircle className="h-4 w-4" />,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-500/10',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {statItems.map((item) => (
        <Card
          key={item.label}
          className="glass-card glow-hover border border-border/50 rounded-xl p-4"
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${item.bg} ${item.color}`}>
              {item.icon}
            </div>
            <div>
              <p className="text-lg font-bold font-mono tabular-nums">{item.value}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">
                {item.label}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function PolicyScheduler() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [schedules, setSchedules] = useState<ScheduledItem[]>([])

  // Fetch policies from API
  const { data: policies = [] } = useQuery<Policy[]>({
    queryKey: ['policies'],
    queryFn: async () => {
      const res = await fetch('/api/policies')
      if (!res.ok) throw new Error('Failed to fetch policies')
      return res.json() as Promise<Policy[]>
    },
  })

  // Generate mock schedule data from policies
  const mockSchedules = useMemo(
    () => generateMockSchedules(policies),
    [policies]
  )

  // Merge mock + user-created schedules
  const allSchedules = useMemo(
    () => [...mockSchedules, ...schedules],
    [mockSchedules, schedules]
  )

  const handleCreateSchedule = useCallback(
    (item: Omit<ScheduledItem, 'id' | 'status'>) => {
      const newItem: ScheduledItem = {
        ...item,
        id: `sch-user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        status: 'Pending',
      }
      setSchedules((prev) => [...prev, newItem])
      toast.success(`Schedule created: ${item.action} "${item.policyName}"`)
    },
    []
  )

  const handleDeleteSchedule = useCallback((id: string) => {
    setSchedules((prev) => prev.filter((s) => s.id !== id))
    toast.success('Schedule deleted')
  }, [])

  const handleQuickSchedule = useCallback(
    (preset: QuickSchedulePreset) => {
      if (policies.length === 0) {
        toast.error('No policies available to schedule')
        return
      }
      // Create a schedule for each policy
      const newSchedules: ScheduledItem[] = policies.map((policy, i) => {
        const now = new Date()
        let scheduledTime: Date
        switch (preset.recurrence) {
          case 'Weekly':
            // Next Saturday
            scheduledTime = new Date(now)
            const daysUntilSat = (6 - now.getDay() + 7) % 7 || 7
            scheduledTime.setDate(now.getDate() + daysUntilSat)
            scheduledTime.setHours(0, 0, 0, 0)
            break
          case 'Daily':
            // Next 9AM
            scheduledTime = new Date(now)
            if (now.getHours() >= 9) scheduledTime.setDate(now.getDate() + 1)
            scheduledTime.setHours(9, 0, 0, 0)
            break
          default:
            // Immediate (1 minute from now, offset by index for visual variety)
            scheduledTime = new Date(now.getTime() + (i + 1) * 60000)
        }
        return {
          id: `sch-quick-${Date.now()}-${i}`,
          policyName: policy.name,
          policyId: policy.policyId,
          action: preset.action,
          scheduledTime,
          recurrence: preset.recurrence,
          status: 'Pending',
          createdBy: 'admin@agentshield.io',
          description: preset.description,
        }
      })
      setSchedules((prev) => [...prev, ...newSchedules])
      toast.success(`${preset.label}: ${newSchedules.length} schedules created`)
    },
    [policies]
  )

  return (
    <div className="p-4 md:p-6 space-y-4 dot-grid">
      {/* Section Header */}
      <div className="section-header-gradient section-header-accent rounded-xl px-4 py-3 -mx-4 -mt-2 md:-mx-6 md:-mt-4 mb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <span className="gradient-text-shimmer">Policy Scheduler</span>
            </h2>
            <p className="text-sm text-muted-foreground">
              Schedule policy activation and deactivation
            </p>
          </div>
          <Button
            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98] transition-transform"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Schedule
          </Button>
        </div>
      </div>

      {/* Ephemeral State Warning */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span>Schedules are stored in browser memory and will be lost on page refresh. Persistent scheduling is coming in a future release.</span>
      </div>

      {/* Schedule Statistics */}
      <ScheduleStats schedules={allSchedules} />

      {/* Main Grid: Table + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Active Schedules Table */}
        <div className="lg:col-span-2">
          <Card className="glass-card glow-hover corner-accent border border-border/50 rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Scheduled Policy Changes
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 font-mono tabular-nums"
                >
                  {allSchedules.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {allSchedules.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <CalendarClock className="h-12 w-12 mb-3 opacity-20" />
                  <p className="text-sm font-medium">No scheduled changes</p>
                  <p className="text-xs mt-1">
                    Create a new schedule to automate policy activation
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[11px]">Policy Name</TableHead>
                        <TableHead className="text-[11px]">Action</TableHead>
                        <TableHead className="text-[11px]">Scheduled Time</TableHead>
                        <TableHead className="text-[11px]">Recurrence</TableHead>
                        <TableHead className="text-[11px]">Status</TableHead>
                        <TableHead className="text-[11px]">Created By</TableHead>
                        <TableHead className="text-[11px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence>
                        {allSchedules.map((schedule) => (
                          <motion.tr
                            key={schedule.id}
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                            transition={{ duration: 0.15 }}
                            className="table-row-hover transition-colors duration-150"
                          >
                            <TableCell className="text-xs font-medium py-2.5">
                              <div className="flex items-center gap-2">
                                <Shield className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                <span className="truncate max-w-[180px]">
                                  {schedule.policyName}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="py-2.5">
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 transition-transform duration-150 hover:scale-105 ${ACTION_COLORS[schedule.action]}`}
                              >
                                {schedule.action}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs py-2.5">
                              <div className="space-y-0.5">
                                <div className="font-mono tabular-nums">
                                  {schedule.scheduledTime.toLocaleString([], {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {formatDistanceToNow(schedule.scheduledTime, {
                                    addSuffix: true,
                                  })}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-2.5">
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 transition-transform duration-150 hover:scale-105 ${RECURRENCE_COLORS[schedule.recurrence]}`}
                              >
                                <span className="flex items-center gap-1">
                                  {RECURRENCE_ICONS[schedule.recurrence]}
                                  {schedule.recurrence}
                                </span>
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2.5">
                              <div className="flex items-center gap-1.5">
                                <div
                                  className={`h-2 w-2 rounded-full shrink-0 ${STATUS_DOT_COLORS[schedule.status]} ${schedule.status === 'Active' ? 'ring-pulse' : ''}`}
                                />
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0 transition-transform duration-150 hover:scale-105 ${STATUS_COLORS[schedule.status]}`}
                                >
                                  {schedule.status}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground py-2.5">
                              <span className="truncate max-w-[120px] block">
                                {schedule.createdBy}
                              </span>
                            </TableCell>
                            <TableCell className="py-2.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground active:scale-95 transition-transform duration-150"
                                  onClick={() =>
                                    toast.info('Edit schedule: coming soon')
                                  }
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500 active:scale-95 transition-transform duration-150"
                                  onClick={() => handleDeleteSchedule(schedule.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Schedule Timeline */}
        <div>
          <ScheduleTimeline schedules={allSchedules} />
        </div>
      </div>

      {/* Quick Schedule Buttons */}
      <Card className="glass-card glow-hover border border-border/50 rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Timer className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Quick Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {QUICK_SCHEDULE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                className={`flex items-start gap-3 p-3.5 rounded-xl text-left transition-all duration-150 active:scale-[0.98] border border-border/50 hover:border-border hover:shadow-sm ${preset.color}`}
                onClick={() => handleQuickSchedule(preset)}
              >
                <div className="shrink-0 mt-0.5">{preset.icon}</div>
                <div>
                  <p className="text-sm font-semibold">{preset.label}</p>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    {preset.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Create Schedule Dialog */}
      <CreateScheduleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        policies={policies}
        onCreate={handleCreateSchedule}
      />
    </div>
  )
}
