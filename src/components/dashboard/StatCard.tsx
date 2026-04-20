'use client'

import { Card, CardContent } from '@/components/ui/card'
import { type LucideIcon } from 'lucide-react'
import { useMotionValue, useMotionValueEvent, animate } from 'framer-motion'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: number
  icon: LucideIcon
  trend?: string
  trendUp?: boolean | null
  suffix?: string
  loading?: boolean
  gradient?: string
  iconBg?: string
  isPercentage?: boolean
}

function AnimatedNumber({ value, suffix = '', isPercentage = false }: { value: number; suffix?: string; isPercentage?: boolean }) {
  const motionVal = useMotionValue(0)
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    const controls = animate(motionVal, value, {
      duration: 0.8,
      ease: 'easeOut',
    })
    return controls.stop
  }, [value, motionVal])

  useMotionValueEvent(motionVal, 'change', (latest) => {
    setDisplayValue(isPercentage ? parseFloat(latest.toFixed(1)) : Math.round(latest))
  })

  return (
    <span className="text-2xl font-bold tabular-nums">
      {displayValue}{isPercentage ? '%' : ''}{suffix}
    </span>
  )
}

export function StatCard({ title, value, icon: Icon, trend, trendUp, suffix = '', loading, gradient, iconBg, isPercentage }: StatCardProps) {
  if (loading) {
    return (
      <Card className="relative overflow-hidden">
        <CardContent className="p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-3 w-20 bg-muted animate-pulse rounded" />
              <div className="h-7 w-16 bg-muted animate-pulse rounded" />
            </div>
            <div className="h-10 w-10 bg-muted animate-pulse rounded-lg" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 border-0 shadow-sm">
      {/* Gradient background */}
      <div className={cn(
        'absolute inset-0 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-300',
        gradient ?? 'bg-gradient-to-br from-emerald-500 to-teal-600'
      )} />
      <CardContent className="p-4 md:p-6 relative">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {title}
            </p>
            <AnimatedNumber value={value} suffix={suffix} isPercentage={isPercentage} />
          </div>
          <div className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg shrink-0 group-hover:scale-110 transition-transform duration-300',
            iconBg ?? 'bg-emerald-600/10 text-emerald-600 dark:text-emerald-400'
          )}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {trend && (
          <div className="mt-2 flex items-center gap-1 text-xs">
            <span
              className={
                trendUp === true
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : trendUp === false
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-muted-foreground'
              }
            >
              {trendUp === true ? '↑' : trendUp === false ? '↓' : '→'} {trend}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
