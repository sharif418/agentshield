'use client'

import { cn } from '@/lib/utils'
import { useAppStore, type SectionId } from '@/lib/store'
import {
  LayoutDashboard,
  Shield,
  CheckSquare,
  Activity,
  GitBranch,
  FileText,
  Webhook,
  Code2,
  Radio,
  Bot,
  FlaskConical,
  Gauge,
  GitCompare,
  Network,
  FileCheck,
  BookOpen,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useQuery } from '@tanstack/react-query'

const navItems: { id: SectionId; label: string; icon: React.ReactNode; shortcut: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" />, shortcut: '1' },
  { id: 'policies', label: 'Policies', icon: <Shield className="h-5 w-5" />, shortcut: '2' },
  { id: 'approvals', label: 'Approvals', icon: <CheckSquare className="h-5 w-5" />, shortcut: '3' },
  { id: 'traces', label: 'Traces', icon: <Activity className="h-5 w-5" />, shortcut: '4' },
  { id: 'reasoning', label: 'Reasoning', icon: <GitBranch className="h-5 w-5" />, shortcut: '5' },
  { id: 'livestream', label: 'Live Stream', icon: <Radio className="h-5 w-5" />, shortcut: '6' },
  { id: 'agents', label: 'Agents', icon: <Bot className="h-5 w-5" />, shortcut: '7' },
  { id: 'simulator', label: 'Simulator', icon: <FlaskConical className="h-5 w-5" />, shortcut: '8' },
  { id: 'rateanalytics', label: 'Rate Analytics', icon: <Gauge className="h-5 w-5" />, shortcut: 'E' },
  { id: 'policydiff', label: 'Policy Diff', icon: <GitCompare className="h-5 w-5" />, shortcut: 'D' },
  { id: 'dependencygraph', label: 'Dep. Graph', icon: <Network className="h-5 w-5" />, shortcut: 'G' },
  { id: 'compliance', label: 'Compliance', icon: <FileCheck className="h-5 w-5" />, shortcut: 'C' },
  { id: 'templates', label: 'Templates', icon: <BookOpen className="h-5 w-5" />, shortcut: 'T' },
  { id: 'threatintel', label: 'Threat Intel', icon: <ShieldAlert className="h-5 w-5" />, shortcut: 'X' },
  { id: 'audit', label: 'Audit Logs', icon: <FileText className="h-5 w-5" />, shortcut: '9' },
  { id: 'webhooks', label: 'Webhooks', icon: <Webhook className="h-5 w-5" />, shortcut: 'Q' },
  { id: 'sdk', label: 'SDK & Docs', icon: <Code2 className="h-5 w-5" />, shortcut: 'W' },
]

interface SidebarStats {
  totalPolicies: number
  pendingApprovals: number
}

export function Sidebar() {
  const { activeSection, setActiveSection, sidebarCollapsed, setSidebarCollapsed } =
    useAppStore()

  // Fetch quick stats for the sidebar
  const { data: stats } = useQuery<SidebarStats>({
    queryKey: ['sidebar-stats'],
    queryFn: async () => {
      const res = await fetch('/api/stats')
      if (!res.ok) return { totalPolicies: 0, pendingApprovals: 0 }
      const data = await res.json()
      return {
        totalPolicies: data.totalPolicies ?? 0,
        pendingApprovals: data.pendingApprovals ?? 0,
      }
    },
    refetchInterval: 30000,
  })

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex flex-col border-r border-border bg-card transition-all duration-300 ease-in-out h-full relative overflow-hidden',
          sidebarCollapsed ? 'w-16' : 'w-56'
        )}
      >
        {/* Subtle gradient accent at bottom of sidebar */}
        <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-emerald-500/[0.03] to-transparent pointer-events-none" />
        {/* App header */}
        <div className="flex items-center gap-2 px-3 h-14 border-b border-border shrink-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm shrink-0">
            <Shield className="h-4 w-4 text-white" />
          </div>
          {!sidebarCollapsed && (
            <span className="font-bold text-sm tracking-tight bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent whitespace-nowrap">
              AgentShield
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-2 px-2 overflow-y-auto custom-scrollbar">
          {/* Core section group */}
          <div className="mb-1">
            {!sidebarCollapsed && <span className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1 block">Core</span>}
            <div className="space-y-0.5">
              {navItems.slice(0, 5).map((item) => {
                const isActive = activeSection === item.id
                const button = (
                  <Button
                    key={item.id}
                    variant={isActive ? 'secondary' : 'ghost'}
                    size={sidebarCollapsed ? 'icon' : 'default'}
                    className={cn(
                      'w-full justify-start gap-3 transition-all duration-200 relative',
                      isActive && 'bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 dark:bg-emerald-400/10 font-medium',
                      !isActive && 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                      sidebarCollapsed && 'justify-center px-0'
                    )}
                    onClick={() => setActiveSection(item.id)}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-emerald-600 dark:bg-emerald-400 rounded-r" />
                    )}
                    <span className={cn(isActive && 'text-emerald-600 dark:text-emerald-400')}>
                      {item.icon}
                    </span>
                    {!sidebarCollapsed && <span className="text-sm">{item.label}</span>}
                    {!sidebarCollapsed && (
                      <kbd className={cn(
                        'ml-auto pointer-events-none inline-flex h-4 select-none items-center rounded border bg-muted px-1 font-mono text-[10px] font-medium',
                        isActive ? 'text-emerald-600/50 dark:text-emerald-400/50 border-emerald-500/20' : 'text-muted-foreground border-border'
                      )}>
                        {item.shortcut}
                      </kbd>
                    )}
                  </Button>
                )
                if (sidebarCollapsed) {
                  return (
                    <Tooltip key={item.id}>
                      <TooltipTrigger asChild>{button}</TooltipTrigger>
                      <TooltipContent side="right" className="font-medium flex items-center gap-2">
                        {item.label}
                        <kbd className="inline-flex h-4 select-none items-center rounded border bg-muted px-1 font-mono text-[10px] font-medium text-muted-foreground">
                          {item.shortcut}
                        </kbd>
                      </TooltipContent>
                    </Tooltip>
                  )
                }
                return button
              })}
            </div>
          </div>

          <div className="border-t border-border/50 mx-2 my-1.5" />

          {/* Monitoring section group */}
          <div className="mb-1">
            {!sidebarCollapsed && <span className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1 block">Monitoring</span>}
            <div className="space-y-0.5">
              {navItems.slice(5, 8).map((item) => {
                const isActive = activeSection === item.id
                const button = (
                  <Button
                    key={item.id}
                    variant={isActive ? 'secondary' : 'ghost'}
                    size={sidebarCollapsed ? 'icon' : 'default'}
                    className={cn(
                      'w-full justify-start gap-3 transition-all duration-200 relative',
                      isActive && 'bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 dark:bg-emerald-400/10 font-medium',
                      !isActive && 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                      sidebarCollapsed && 'justify-center px-0'
                    )}
                    onClick={() => setActiveSection(item.id)}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-emerald-600 dark:bg-emerald-400 rounded-r" />
                    )}
                    <span className={cn(isActive && 'text-emerald-600 dark:text-emerald-400')}>
                      {item.icon}
                    </span>
                    {!sidebarCollapsed && <span className="text-sm">{item.label}</span>}
                    {!sidebarCollapsed && (
                      <kbd className={cn(
                        'ml-auto pointer-events-none inline-flex h-4 select-none items-center rounded border bg-muted px-1 font-mono text-[10px] font-medium',
                        isActive ? 'text-emerald-600/50 dark:text-emerald-400/50 border-emerald-500/20' : 'text-muted-foreground border-border'
                      )}>
                        {item.shortcut}
                      </kbd>
                    )}
                  </Button>
                )
                if (sidebarCollapsed) {
                  return (
                    <Tooltip key={item.id}>
                      <TooltipTrigger asChild>{button}</TooltipTrigger>
                      <TooltipContent side="right" className="font-medium flex items-center gap-2">
                        {item.label}
                        <kbd className="inline-flex h-4 select-none items-center rounded border bg-muted px-1 font-mono text-[10px] font-medium text-muted-foreground">
                          {item.shortcut}
                        </kbd>
                      </TooltipContent>
                    </Tooltip>
                  )
                }
                return button
              })}
            </div>
          </div>

          <div className="border-t border-border/50 mx-2 my-1.5" />

          {/* Analysis section group */}
          <div className="mb-1">
            {!sidebarCollapsed && <span className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1 block">Analysis</span>}
            <div className="space-y-0.5">
              {navItems.slice(8, 14).map((item) => {
                const isActive = activeSection === item.id
                const button = (
                  <Button
                    key={item.id}
                    variant={isActive ? 'secondary' : 'ghost'}
                    size={sidebarCollapsed ? 'icon' : 'default'}
                    className={cn(
                      'w-full justify-start gap-3 transition-all duration-200 relative',
                      isActive && 'bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 dark:bg-emerald-400/10 font-medium',
                      !isActive && 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                      sidebarCollapsed && 'justify-center px-0'
                    )}
                    onClick={() => setActiveSection(item.id)}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-emerald-600 dark:bg-emerald-400 rounded-r" />
                    )}
                    <span className={cn(isActive && 'text-emerald-600 dark:text-emerald-400')}>
                      {item.icon}
                    </span>
                    {!sidebarCollapsed && <span className="text-sm">{item.label}</span>}
                    {!sidebarCollapsed && (
                      <kbd className={cn(
                        'ml-auto pointer-events-none inline-flex h-4 select-none items-center rounded border bg-muted px-1 font-mono text-[10px] font-medium',
                        isActive ? 'text-emerald-600/50 dark:text-emerald-400/50 border-emerald-500/20' : 'text-muted-foreground border-border'
                      )}>
                        {item.shortcut}
                      </kbd>
                    )}
                  </Button>
                )
                if (sidebarCollapsed) {
                  return (
                    <Tooltip key={item.id}>
                      <TooltipTrigger asChild>{button}</TooltipTrigger>
                      <TooltipContent side="right" className="font-medium flex items-center gap-2">
                        {item.label}
                        <kbd className="inline-flex h-4 select-none items-center rounded border bg-muted px-1 font-mono text-[10px] font-medium text-muted-foreground">
                          {item.shortcut}
                        </kbd>
                      </TooltipContent>
                    </Tooltip>
                  )
                }
                return button
              })}
            </div>
          </div>

          <div className="border-t border-border/50 mx-2 my-1.5" />

          {/* System section group */}
          <div className="mb-1">
            {!sidebarCollapsed && <span className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1 block">System</span>}
            <div className="space-y-0.5">
              {navItems.slice(14).map((item) => {
                const isActive = activeSection === item.id
                const button = (
                  <Button
                    key={item.id}
                    variant={isActive ? 'secondary' : 'ghost'}
                    size={sidebarCollapsed ? 'icon' : 'default'}
                    className={cn(
                      'w-full justify-start gap-3 transition-all duration-200 relative',
                      isActive && 'bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 dark:bg-emerald-400/10 font-medium',
                      !isActive && 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                      sidebarCollapsed && 'justify-center px-0'
                    )}
                    onClick={() => setActiveSection(item.id)}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-emerald-600 dark:bg-emerald-400 rounded-r" />
                    )}
                    <span className={cn(isActive && 'text-emerald-600 dark:text-emerald-400')}>
                      {item.icon}
                    </span>
                    {!sidebarCollapsed && <span className="text-sm">{item.label}</span>}
                    {!sidebarCollapsed && (
                      <kbd className={cn(
                        'ml-auto pointer-events-none inline-flex h-4 select-none items-center rounded border bg-muted px-1 font-mono text-[10px] font-medium',
                        isActive ? 'text-emerald-600/50 dark:text-emerald-400/50 border-emerald-500/20' : 'text-muted-foreground border-border'
                      )}>
                        {item.shortcut}
                      </kbd>
                    )}
                  </Button>
                )
                if (sidebarCollapsed) {
                  return (
                    <Tooltip key={item.id}>
                      <TooltipTrigger asChild>{button}</TooltipTrigger>
                      <TooltipContent side="right" className="font-medium flex items-center gap-2">
                        {item.label}
                        <kbd className="inline-flex h-4 select-none items-center rounded border bg-muted px-1 font-mono text-[10px] font-medium text-muted-foreground">
                          {item.shortcut}
                        </kbd>
                      </TooltipContent>
                    </Tooltip>
                  )
                }
                return button
              })}
            </div>
          </div>
        </nav>

        {/* Quick Stats section */}
        {!sidebarCollapsed && (
          <div className="px-3 pb-2 space-y-1">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3 w-3" />
              <span>{stats?.totalPolicies ?? 0} policies</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <CheckCircle className="h-3 w-3" />
              <span>{stats?.pendingApprovals ?? 0} approvals</span>
            </div>
          </div>
        )}

        {/* Separator before environment indicator */}
        <div className="border-t border-border mx-2" />

        {/* Environment indicator + Collapse toggle */}
        <div className="p-2 shrink-0 flex items-center gap-2">
          {/* Environment pill */}
          {!sidebarCollapsed && (
            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              DEV
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'hover:bg-muted/50 transition-colors duration-200',
              sidebarCollapsed ? 'w-full h-8' : 'h-8 ml-auto'
            )}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  )
}
