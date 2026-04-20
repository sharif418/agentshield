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
  commandOpen: boolean
  setCommandOpen: (open: boolean) => void
  lastRefresh: Date | null
  setLastRefresh: (date: Date) => void
  dbRecordCount: number
  setDbRecordCount: (count: number) => void
  unreadNotificationCount: number
  setUnreadNotificationCount: (count: number) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeSection: 'dashboard',
  setActiveSection: (section) => set({ activeSection: section }),
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  wsConnected: false,
  setWsConnected: (connected) => set({ wsConnected: connected }),
  commandOpen: false,
  setCommandOpen: (open) => set({ commandOpen: open }),
  lastRefresh: null,
  setLastRefresh: (date) => set({ lastRefresh: date }),
  dbRecordCount: 0,
  setDbRecordCount: (count) => set({ dbRecordCount: count }),
  unreadNotificationCount: 0,
  setUnreadNotificationCount: (count) => set({ unreadNotificationCount: count }),
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
  audit: 'Audit Logs',
  webhooks: 'Webhooks',
  sdk: 'SDK & Docs',
}
