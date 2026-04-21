'use client'

import { Card, CardContent } from '@/components/ui/card'
import { type LucideIcon } from 'lucide-react'
import { useMotionValue, useMotionValueEvent, animate, motion } from 'framer-motion'
import { useEffect, useState, useRef, useMemo } from 'react'
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
  sparklineData?: number[]
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
    <span className="text-[1.65rem] font-extrabold tabular-nums leading-tight">
      {displayValue}{isPercentage ? '%' : ''}{suffix}
    </span>
  )
}

// Mini sparkline SVG with 5 data points
function MiniSparkline({ data, color = '#10b981' }: { data: number[]; color?: string }) {
  const width = 60
  const height = 20
  const padding = 2

  const points = useMemo(() => {
    if (data.length < 2) return []
    const max = Math.max(...data, 1)
    const min = Math.min(...data, 0)
    const range = max - min || 1
    return data.map((v, i) => {
      const x = padding + (i / (data.length - 1)) * (width - padding * 2)
      const y = padding + (1 - (v - min) / range) * (height - padding * 2)
      return `${x},${y}`
    }).join(' ')
  }, [data])

  if (data.length < 2) return null

  return (
    <svg width={width} height={height} className="opacity-50 group-hover:opacity-80 transition-opacity duration-300">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function StatCard({ title, value, icon: Icon, trend, trendUp, suffix = '', loading, gradient, iconBg, isPercentage, sparklineData }: StatCardProps) {
  const [prevValue, setPrevValue] = useState(value)
  const [pulseIcon, setPulseIcon] = useState(false)
  const iconRef = useRef<HTMLDivElement>(null)

  // Detect value changes for icon pulse
  useEffect(() => {
    if (prevValue !== value && prevValue !== 0) {
      const timer1 = setTimeout(() => setPulseIcon(true), 0)
      const timer2 = setTimeout(() => setPulseIcon(false), 500)
      return () => { clearTimeout(timer1); clearTimeout(timer2) }
    }
    const timer = setTimeout(() => setPrevValue(value), 0)
    return () => clearTimeout(timer)
  }, [value, prevValue])

  // Generate fake sparkline data if not provided
  const sparkPoints = useMemo(() => {
    if (sparklineData) return sparklineData
    // Generate 5 pseudo-random points based on value
    const base = value || 1
    return [
      base * 0.6,
      base * 0.8,
      base * 0.7,
      base * 0.9,
      base * 1.0,
    ]
  }, [sparklineData, value])

  // Determine sparkline color from gradient
  const sparkColor = gradient?.includes('violet') ? '#8b5cf6'
    : gradient?.includes('amber') ? '#f59e0b'
    : gradient?.includes('cyan') ? '#06b6d4'
    : gradient?.includes('teal') ? '#14b8a6'
    : '#10b981'

  if (loading) {
    return (
      <Card className="relative overflow-hidden shadow-sm">
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
    <Card className="relative overflow-hidden group hover:shadow-md transition-all duration-300 border-0 shadow-sm gradient-border-hover shimmer-hover card-shine hover-lift animated-border neon-glow stat-accent-top">
      {/* Inner shadow at top for depth */}
      <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-black/[0.03] to-transparent dark:from-white/[0.02] dark:to-transparent pointer-events-none" />
      {/* Dot grid pattern for subtle texture */}
      <div className="absolute inset-0 dot-grid opacity-40 pointer-events-none" />
      {/* Diagonal lines background pattern */}
      <div className="absolute inset-0 opacity-[0.015] pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, currentColor 10px, currentColor 11px)',
      }} />

      {/* Gradient background */}
      <div className={cn(
        'absolute inset-0 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity duration-300',
        gradient ?? 'bg-gradient-to-br from-emerald-500 to-teal-600'
      )} />

      {/* Gradient accent bar at bottom - animated on hover */}
      <motion.div
        className={cn(
          'absolute bottom-0 inset-x-0 h-[3px] rounded-b-xl',
          gradient ?? 'bg-gradient-to-r from-emerald-500 to-teal-600'
        )}
        initial={{ opacity: 0.3, scaleX: 0.8 }}
        animate={{ opacity: 0.3, scaleX: 0.8 }}
        whileHover={{ opacity: 0.8, scaleX: 1 }}
        transition={{ duration: 0.3 }}
        style={{ transformOrigin: 'left' }}
      />

      <CardContent className="p-4 md:p-6 relative">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {title}
            </p>
            <AnimatedNumber value={value} suffix={suffix} isPercentage={isPercentage} />
            <span className="sr-only number-display">{value}{isPercentage ? '%' : ''}{suffix}</span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div
              ref={iconRef}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg shrink-0 group-hover:scale-110 transition-transform duration-300',
                iconBg ?? 'bg-emerald-600/10 text-emerald-600 dark:text-emerald-400',
                pulseIcon && 'icon-pulse'
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <MiniSparkline data={sparkPoints} color={sparkColor} />
          </div>
        </div>
        {trend && (
          <div className="mt-2 flex items-center gap-1.5 text-xs">
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
            {/* Mini trend indicator */}
            {trendUp === true && (
              <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 6L4 2L7 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                +{Math.round(Math.abs((value || 1) * 0.12))}%
              </span>
            )}
            {trendUp === false && (
              <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
                <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 2L4 6L7 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                -{Math.round(Math.abs((value || 1) * 0.08))}%
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
