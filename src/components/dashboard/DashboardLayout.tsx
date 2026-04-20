'use client'

import { useAppStore, sectionLabels, type SectionId } from '@/lib/store'
import { Sidebar } from './Sidebar'
import { DashboardOverview } from './DashboardOverview'
import { PolicyManager } from './PolicyManager'
import { ApprovalQueue } from './ApprovalQueue'
import { ExecutionTraces } from './ExecutionTraces'
import { ReasoningGraph } from './ReasoningGraph'
import { AuditLogs } from './AuditLogs'
import { WebhookConfig } from './WebhookConfig'
import { SDKIntegration } from './SDKIntegration'
import { LiveStream } from './LiveStream'
import { AgentRoles } from './AgentRoles'
import { PolicySimulator } from './PolicySimulator'
import { RateAnalytics } from './RateAnalytics'
import { PolicyDiffViewer } from './PolicyDiffViewer'
import { ThemeToggle } from './ThemeToggle'
import { NotificationCenter } from './NotificationCenter'
import { GlobalTimeRange } from './GlobalTimeRange'
import { useWebSocket } from '@/lib/use-websocket'
import { Shield, WifiOff, Menu, Search, LayoutDashboard, Activity, CheckSquare, GitBranch, FileText, Webhook, Code2, Clock, Database, ChevronRight, Radio, Bot, FlaskConical, Gauge, GitCompare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AnimatePresence, motion } from 'framer-motion'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useEffect, useCallback, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'

const sectionComponents: Record<string, React.ComponentType> = {
  dashboard: DashboardOverview,
  policies: PolicyManager,
  approvals: ApprovalQueue,
  traces: ExecutionTraces,
  reasoning: ReasoningGraph,
  livestream: LiveStream,
  agents: AgentRoles,
  simulator: PolicySimulator,
  rateanalytics: RateAnalytics,
  policydiff: PolicyDiffViewer,
  audit: AuditLogs,
  webhooks: WebhookConfig,
  sdk: SDKIntegration,
}

const sectionIcons: Record<SectionId, React.ReactNode> = {
  dashboard: <LayoutDashboard className="h-4 w-4" />,
  policies: <Shield className="h-4 w-4" />,
  approvals: <CheckSquare className="h-4 w-4" />,
  traces: <Activity className="h-4 w-4" />,
  reasoning: <GitBranch className="h-4 w-4" />,
  livestream: <Radio className="h-4 w-4" />,
  agents: <Bot className="h-4 w-4" />,
  simulator: <FlaskConical className="h-4 w-4" />,
  rateanalytics: <Gauge className="h-4 w-4" />,
  policydiff: <GitCompare className="h-4 w-4" />,
  audit: <FileText className="h-4 w-4" />,
  webhooks: <Webhook className="h-4 w-4" />,
  sdk: <Code2 className="h-4 w-4" />,
}

const sectionKeys: SectionId[] = ['dashboard', 'policies', 'approvals', 'traces', 'reasoning', 'livestream', 'agents', 'simulator', 'rateanalytics', 'policydiff', 'audit', 'webhooks', 'sdk']

export function DashboardLayout() {
  const { activeSection, wsConnected, wsReconnecting, wsReconnectAttempt, commandOpen, setCommandOpen, setActiveSection, lastRefresh, setLastRefresh, dbRecordCount, setDbRecordCount, timeRange } = useAppStore()
  useWebSocket()

  const ActiveSection = sectionComponents[activeSection] ?? DashboardOverview

  // Fetch stats for footer DB count
  const { data: statsData } = useQuery({
    queryKey: ['stats-footer', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/stats?timeRange=${timeRange}`)
      if (!res.ok) return null
      const data = await res.json()
      setLastRefresh(new Date())
      setDbRecordCount(
        (data.totalPolicies ?? 0) +
        (data.totalTraces ?? 0) +
        (data.pendingApprovals ?? 0) +
        (data.auditLogCount ?? 0)
      )
      return data
    },
    refetchInterval: 30000,
  })

  // Fetch policies and traces for command palette search
  const { data: policiesData } = useQuery({
    queryKey: ['policies-all-compact'],
    queryFn: async () => {
      const res = await fetch('/api/policies')
      if (!res.ok) return []
      return res.json() as Promise<Array<{ policyId: string; name: string; agentRole: string; permissionLevel: string }>>
    },
    enabled: commandOpen,
  })

  const { data: tracesData } = useQuery({
    queryKey: ['traces-compact'],
    queryFn: async () => {
      const res = await fetch('/api/traces?limit=20')
      if (!res.ok) return { traces: [] }
      return res.json() as Promise<{ traces: Array<{ traceId: string; agentRole: string; toolName: string }> }>
    },
    enabled: commandOpen,
  })

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Cmd+K / Ctrl+K for command palette
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setCommandOpen(!commandOpen)
      return
    }

    // Number keys 1-9,0 to switch sections (only when not in input)
    if (
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      !e.shiftKey &&
      ((e.key >= '1' && e.key <= '9') || e.key === '0') &&
      !(e.target instanceof HTMLInputElement) &&
      !(e.target instanceof HTMLTextAreaElement) &&
      !(e.target instanceof HTMLSelectElement)
    ) {
      const index = e.key === '0' ? 9 : parseInt(e.key) - 1
      if (index < sectionKeys.length) {
        setActiveSection(sectionKeys[index])
      }
    }
  }, [commandOpen, setCommandOpen, setActiveSection])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Refresh time display
  const [refreshStr, setRefreshStr] = useState('')
  useEffect(() => {
    const update = () => {
      if (lastRefresh) {
        setRefreshStr(formatDistanceToNow(lastRefresh, { addSuffix: true }))
      }
    }
    update()
    const interval = setInterval(update, 15000)
    return () => clearInterval(interval)
  }, [lastRefresh])

  return (
    <div className="min-h-screen flex flex-col bg-background mesh-bg dark-mode-enhanced">
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden md:flex">
          <Sidebar />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Bar */}
          <header className="h-14 border-b border-border bg-card/60 backdrop-blur-md flex items-center justify-between px-4 shrink-0 z-10 relative overflow-hidden">
            {/* Subtle noise texture for header */}
            <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none" />
            <div className="flex items-center gap-3">
              {/* Mobile menu */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 active:scale-95 transition-transform">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-56">
                  <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                  <Sidebar />
                </SheetContent>
              </Sheet>

              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center h-7 w-7 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm">
                  <Shield className="h-4 w-4 text-white" />
                </div>
                <h1 className="font-bold text-sm md:text-base tracking-tight bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">AgentShield</h1>
              </div>

              {/* Breadcrumb / Section indicator */}
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground ml-2">
                <ChevronRight className="h-3 w-3" />
                <span className="flex items-center gap-1">
                  {sectionIcons[activeSection]}
                  <span className="font-medium text-foreground">{sectionLabels[activeSection]}</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Search Button */}
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs text-muted-foreground gap-2 hidden sm:flex active:scale-[0.98] transition-transform"
                onClick={() => setCommandOpen(true)}
              >
                <Search className="h-3 w-3" />
                <span className="max-w-[100px]">Search...</span>
                <kbd className="ml-1 pointer-events-none inline-flex h-4 select-none items-center gap-0.5 rounded border bg-muted px-1 font-mono text-[10px] font-medium text-muted-foreground">
                  ⌘K
                </kbd>
              </Button>

              <GlobalTimeRange />

              {/* Connection status with tooltip */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 text-xs cursor-help">
                      {wsConnected ? (
                        <>
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                          </span>
                          <span className="hidden sm:inline text-emerald-600 dark:text-emerald-400">Live</span>
                        </>
                      ) : wsReconnecting ? (
                        <>
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                          </span>
                          <span className="hidden sm:inline text-amber-600 dark:text-amber-400">Reconnecting</span>
                        </>
                      ) : (
                        <>
                          <WifiOff className="h-3 w-3 text-muted-foreground" />
                          <span className="hidden sm:inline text-muted-foreground">Offline</span>
                        </>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {wsConnected
                      ? 'Connected to real-time approval notification service via WebSocket'
                      : wsReconnecting
                        ? `Reconnecting... attempt ${wsReconnectAttempt} of ∞`
                        : 'Not connected to real-time service. Approval notifications will not update automatically.'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <NotificationCenter />
              <ThemeToggle />
            </div>
          </header>

          {/* Section Content */}
          <main className="flex-1 overflow-y-auto custom-scrollbar scroll-smooth relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 12, scale: 0.995 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.998 }}
                transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="h-full"
              >
                <ActiveSection />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* Enhanced Footer */}
      <footer className="border-t border-border bg-card/60 backdrop-blur-md py-2 px-4 flex items-center justify-between text-xs text-muted-foreground shrink-0 z-10 relative overflow-hidden">
        {/* Subtle gradient accent line at top */}
        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
        <div className="flex items-center gap-3">
          <button className="hover:text-foreground transition-colors duration-200 cursor-default" type="button">
            AgentShield Policy Engine v1.0.0
          </button>
          <span className="hidden sm:inline text-border">|</span>
          <span className="hidden sm:flex items-center gap-1">
            <Database className="h-3 w-3" />
            {dbRecordCount} records
          </span>
          <span className="hidden md:inline text-border">|</span>
          <span className="hidden md:flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            Showing: {timeRange === '24h' ? '24h' : timeRange === '7d' ? '7 days' : timeRange === '30d' ? '30 days' : '90 days'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {refreshStr && (
            <span className="hidden sm:flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Updated {refreshStr}
            </span>
          )}
          <span className="hidden md:inline text-border">|</span>
          <span className="hidden md:inline">Development</span>
          <span className="hidden sm:inline text-border">|</span>
          <div className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${wsConnected ? 'bg-emerald-500' : wsReconnecting ? 'bg-amber-500' : 'bg-red-400'}`} />
            <span>{wsConnected ? 'Connected' : wsReconnecting ? 'Reconnecting' : 'Disconnected'}</span>
          </div>
        </div>
      </footer>

      {/* Command Palette */}
      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Search policies, traces, sections..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Sections">
            {sectionKeys.map((id, i) => (
              <CommandItem
                key={id}
                onSelect={() => {
                  setActiveSection(id)
                  setCommandOpen(false)
                }}
                className="flex items-center gap-2"
              >
                {sectionIcons[id]}
                <span>{sectionLabels[id]}</span>
                <span className="ml-auto text-[10px] text-muted-foreground font-mono">{i + 1}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          {policiesData && policiesData.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Policies">
                {policiesData.slice(0, 8).map((p) => (
                  <CommandItem
                    key={p.policyId}
                    onSelect={() => {
                      setActiveSection('policies')
                      setCommandOpen(false)
                    }}
                    className="flex items-center gap-2"
                  >
                    <Shield className="h-3 w-3 text-emerald-500" />
                    <span className="truncate">{p.name}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">{p.agentRole}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {tracesData && tracesData.traces.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Recent Traces">
                {tracesData.traces.slice(0, 6).map((t) => (
                  <CommandItem
                    key={t.traceId}
                    onSelect={() => {
                      setActiveSection('traces')
                      setCommandOpen(false)
                    }}
                    className="flex items-center gap-2"
                  >
                    <Activity className="h-3 w-3 text-muted-foreground" />
                    <span className="truncate font-mono text-xs">{t.traceId}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">{t.agentRole} → {t.toolName}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </div>
  )
}
