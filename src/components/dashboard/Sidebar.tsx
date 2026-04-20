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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const navItems: { id: SectionId; label: string; icon: React.ReactNode; shortcut: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" />, shortcut: '1' },
  { id: 'policies', label: 'Policies', icon: <Shield className="h-5 w-5" />, shortcut: '2' },
  { id: 'approvals', label: 'Approvals', icon: <CheckSquare className="h-5 w-5" />, shortcut: '3' },
  { id: 'traces', label: 'Traces', icon: <Activity className="h-5 w-5" />, shortcut: '4' },
  { id: 'reasoning', label: 'Reasoning', icon: <GitBranch className="h-5 w-5" />, shortcut: '5' },
  { id: 'livestream', label: 'Live Stream', icon: <Radio className="h-5 w-5" />, shortcut: '6' },
  { id: 'agents', label: 'Agents', icon: <Bot className="h-5 w-5" />, shortcut: '7' },
  { id: 'audit', label: 'Audit Logs', icon: <FileText className="h-5 w-5" />, shortcut: '8' },
  { id: 'webhooks', label: 'Webhooks', icon: <Webhook className="h-5 w-5" />, shortcut: '9' },
  { id: 'sdk', label: 'SDK & Docs', icon: <Code2 className="h-5 w-5" />, shortcut: '0' },
]

export function Sidebar() {
  const { activeSection, setActiveSection, sidebarCollapsed, setSidebarCollapsed } =
    useAppStore()

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex flex-col border-r border-border bg-card transition-all duration-300 ease-in-out h-full',
          sidebarCollapsed ? 'w-16' : 'w-56'
        )}
      >
        {/* App header */}
        <div className="flex items-center gap-2 px-3 h-14 border-b border-border shrink-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-600 text-white shrink-0">
            <Shield className="h-4 w-4" />
          </div>
          {!sidebarCollapsed && (
            <span className="font-semibold text-sm tracking-tight whitespace-nowrap">
              AgentShield
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-2 space-y-0.5 px-2 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
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
                {/* Active left border indicator */}
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
        </nav>

        {/* Collapse toggle */}
        <div className="border-t border-border p-2 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="w-full h-8 hover:bg-muted/50 transition-colors duration-200"
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
