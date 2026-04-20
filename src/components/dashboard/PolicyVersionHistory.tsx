'use client'

import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { motion } from 'framer-motion'
import {
  Clock,
  GitCommit,
  Plus,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Loader2,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface PolicyVersionHistoryProps {
  policyId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface HistoryEntry {
  id: string
  eventType: string
  changeType: string
  actor: string
  timestamp: string
  description: string
  details: string
}

interface HistoryResponse {
  policyId: string
  policyName: string
  history: HistoryEntry[]
}

const changeTypeConfig: Record<string, { color: string; bgColor: string; dotColor: string; icon: typeof Plus }> = {
  Created: {
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/10 border-emerald-500/20',
    dotColor: 'bg-emerald-500',
    icon: Plus,
  },
  Updated: {
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-500/10 border-amber-500/20',
    dotColor: 'bg-amber-500',
    icon: Pencil,
  },
  Enabled: {
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/10 border-emerald-500/20',
    dotColor: 'bg-emerald-500',
    icon: ToggleRight,
  },
  Disabled: {
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-500/10 border-red-500/20',
    dotColor: 'bg-red-500',
    icon: ToggleLeft,
  },
  Deleted: {
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-500/10 border-red-500/20',
    dotColor: 'bg-red-500',
    icon: Trash2,
  },
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, x: -12 },
  show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
}

export function PolicyVersionHistory({ policyId, open, onOpenChange }: PolicyVersionHistoryProps) {
  const { data, isLoading, error } = useQuery<HistoryResponse>({
    queryKey: ['policy-history', policyId],
    queryFn: async () => {
      const res = await fetch(`/api/policies/${policyId}/history`)
      if (!res.ok) throw new Error('Failed to fetch policy history')
      return res.json()
    },
    enabled: open && !!policyId,
  })

  const history = data?.history ?? []
  const policyName = data?.policyName ?? policyId

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md w-full p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-2 border-b">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <GitCommit className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base tracking-tight">Version History</SheetTitle>
              <SheetDescription className="text-xs truncate">{policyName}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Loading history...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <Clock className="h-8 w-8 opacity-40" />
              <p className="text-sm">Failed to load history</p>
              <p className="text-xs text-muted-foreground/70">Please try again later</p>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <Clock className="h-8 w-8 opacity-40" />
              <p className="text-sm font-medium">No history available</p>
              <p className="text-xs text-muted-foreground/70">Version history will appear here</p>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="px-6 py-4">
                <motion.div
                  className="relative"
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                >
                  {/* Connecting line */}
                  <div className="absolute left-[11px] top-3 bottom-3 w-px bg-border" />

                  {history.map((entry, index) => {
                    const config = changeTypeConfig[entry.changeType] ?? changeTypeConfig.Updated
                    const Icon = config.icon
                    const versionNumber = history.length - index

                    return (
                      <motion.div
                        key={entry.id}
                        variants={itemVariants}
                        className="relative pl-8 pb-6 last:pb-0"
                      >
                        {/* Timeline dot */}
                        <div
                          className={cn(
                            'absolute left-0 top-1 flex items-center justify-center h-[23px] w-[23px] rounded-full border-2 border-background z-10',
                            config.dotColor
                          )}
                        >
                          <div className="h-1.5 w-1.5 rounded-full bg-white dark:bg-background" />
                        </div>

                        {/* Entry content */}
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px] font-medium px-1.5 py-0 h-5 hover:scale-105 transition-transform duration-150',
                                config.bgColor,
                                config.color
                              )}
                            >
                              <Icon className="h-2.5 w-2.5 mr-0.5" />
                              {entry.changeType}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                              v{versionNumber}
                            </span>
                          </div>

                          <p className="text-sm text-foreground leading-snug">
                            {entry.description}
                          </p>

                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                            </span>
                            <span className="flex items-center gap-1">
                              by <span className="font-medium text-foreground/80">{entry.actor}</span>
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </motion.div>
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Footer */}
        {data && history.length > 0 && (
          <div className="px-6 py-3 border-t text-[11px] text-muted-foreground flex items-center gap-2">
            <GitCommit className="h-3 w-3" />
            <span>{history.length} version{history.length !== 1 ? 's' : ''} recorded</span>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
