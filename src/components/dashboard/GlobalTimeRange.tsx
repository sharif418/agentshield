'use client'

import { useAppStore } from '@/lib/store'
import { Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'

const timeRangeOptions = ['24h', '7d', '30d', '90d'] as const
type TimeRange = typeof timeRangeOptions[number]

export function GlobalTimeRange() {
  const { timeRange, setTimeRange } = useAppStore()

  return (
    <div className="hidden sm:flex items-center gap-0.5 rounded-md border border-border p-0.5">
      <Clock className="h-3 w-3 text-muted-foreground mr-1 ml-1.5" />
      {timeRangeOptions.map((option) => (
        <Button
          key={option}
          variant="ghost"
          size="sm"
          className={
            timeRange === option
              ? 'h-7 px-2.5 text-xs bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700 transition-all'
              : 'h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors'
          }
          onClick={() => setTimeRange(option as TimeRange)}
        >
          {option}
        </Button>
      ))}
    </div>
  )
}
