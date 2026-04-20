import { create } from 'zustand'

export type SectionId =
  | 'dashboard'
  | 'policies'
  | 'approvals'
  | 'traces'
  | 'reasoning'
  | 'livestream'
  | 'agents'
  | 'simulator'
  | 'rateanalytics'
  | 'policydiff'
  | 'audit'
  | 'webhooks'
  | 'sdk'

interface AppState {
  activeSection: SectionId
  setActiveSection: (section: SectionId) => void
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  wsConnected: boolean
  setWsConnected: (connected: boolean) => void
  wsReconnecting: boolean
  setWsReconnecting: (reconnecting: boolean) => void
  wsReconnectAttempt: number
  setWsReconnectAttempt: (attempt: number) => void
  commandOpen: boolean
  setCommandOpen: (open: boolean) => void
  lastRefresh: Date | null
  setLastRefresh: (date: Date) => void
  dbRecordCount: number
  setDbRecordCount: (count: number) => void
  unreadNotificationCount: number
  setUnreadNotificationCount: (count: number) => void
  timeRange: '24h' | '7d' | '30d' | '90d'
  setTimeRange: (range: '24h' | '7d' | '30d' | '90d') => void
}

export const useAppStore = create<AppState>((set) => ({
  activeSection: 'dashboard',
  setActiveSection: (section) => set({ activeSection: section }),
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  wsConnected: false,
  setWsConnected: (connected) => set({ wsConnected: connected }),
  wsReconnecting: false,
  setWsReconnecting: (reconnecting) => set({ wsReconnecting: reconnecting }),
  wsReconnectAttempt: 0,
  setWsReconnectAttempt: (attempt) => set({ wsReconnectAttempt: attempt }),
  commandOpen: false,
  setCommandOpen: (open) => set({ commandOpen: open }),
  lastRefresh: null,
  setLastRefresh: (date) => set({ lastRefresh: date }),
  dbRecordCount: 0,
  setDbRecordCount: (count) => set({ dbRecordCount: count }),
  unreadNotificationCount: 0,
  setUnreadNotificationCount: (count) => set({ unreadNotificationCount: count }),
  timeRange: '24h',
  setTimeRange: (range) => set({ timeRange: range }),
}))

export const sectionLabels: Record<SectionId, string> = {
  dashboard: 'Dashboard',
  policies: 'Policies',
  approvals: 'Approvals',
  traces: 'Traces',
  reasoning: 'Reasoning',
  livestream: 'Live Stream',
  agents: 'Agents',
  simulator: 'Simulator',
  rateanalytics: 'Rate Analytics',
  policydiff: 'Policy Diff',
  audit: 'Audit Logs',
  webhooks: 'Webhooks',
  sdk: 'SDK & Docs',
}
