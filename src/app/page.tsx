'use client'

import { ThemeProvider } from '@/components/dashboard/ThemeProvider'
import { QueryProvider } from '@/lib/query-provider'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'

export default function Home() {
  return (
    <ThemeProvider>
      <QueryProvider>
        <DashboardLayout />
      </QueryProvider>
    </ThemeProvider>
  )
}
