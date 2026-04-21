'use client'

import { useState, useCallback, useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Database,
  Download,
  Upload,
  FileJson,
  FileText,
  FileSpreadsheet,
  HardDrive,
  Archive,
  RefreshCw,
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Copy,
  ExternalLink,
  Shield,
  Activity,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { useAppStore } from '@/lib/store'

// ─── Types ───────────────────────────────────────────────────────────────────

interface DataCounts {
  policies: number
  traces: number
  approvals: number
  auditLogs: number
  webhooks: number
}

type ExportFormat = 'csv' | 'json' | 'html'

type DataType = 'policies' | 'traces' | 'approvals' | 'auditLogs' | 'webhooks'

interface ExportHistoryEntry {
  id: string
  timestamp: Date
  type: string
  format: ExportFormat
  records: number
  size: string
  status: 'Completed' | 'Failed'
}

interface BackupEntry {
  id: string
  filename: string
  timestamp: Date
  size: string
  recordCount: number
}

interface RecentImport {
  id: string
  filename: string
  date: Date
  recordCount: number
  status: 'Success' | 'Failed' | 'Pending'
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DATA_TYPE_OPTIONS: { key: DataType; label: string }[] = [
  { key: 'policies', label: 'Policies' },
  { key: 'traces', label: 'Traces' },
  { key: 'approvals', label: 'Approvals' },
  { key: 'auditLogs', label: 'Audit Logs' },
  { key: 'webhooks', label: 'Webhooks' },
]

const FORMAT_OPTIONS: { key: ExportFormat; label: string; icon: React.ReactNode; desc: string }[] = [
  { key: 'csv', label: 'CSV', icon: <FileSpreadsheet className="h-4 w-4" />, desc: 'Spreadsheet format' },
  { key: 'json', label: 'JSON', icon: <FileJson className="h-4 w-4" />, desc: 'Structured data' },
  { key: 'html', label: 'HTML Report', icon: <FileText className="h-4 w-4" />, desc: 'Styled report' },
]

const FORMAT_BADGE_COLORS: Record<ExportFormat, string> = {
  csv: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  json: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
  html: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
}

const STATUS_BADGE: Record<string, { color: string; icon: React.ReactNode }> = {
  Completed: {
    color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    icon: <CheckCircle className="h-3 w-3" />,
  },
  Failed: {
    color: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
    icon: <XCircle className="h-3 w-3" />,
  },
}

const IMPORT_STATUS_BADGE: Record<string, string> = {
  Success: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  Failed: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
  Pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
}

// ─── Mini Sparkline ──────────────────────────────────────────────────────────

function MiniSparkline({ color = '#10b981', data }: { color?: string; data: number[] }) {
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const w = 48
  const h = 20
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(' ')
  return (
    <svg width={w} height={h} className="inline-block opacity-50">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function DataExportManager() {
  const timeRange = useAppStore((s) => s.timeRange)

  // ─── State ───
  const [selectedTypes, setSelectedTypes] = useState<Set<DataType>>(
    new Set(['policies', 'traces'])
  )
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv')
  const [includeMetadata, setIncludeMetadata] = useState(true)
  const [includeConditions, setIncludeConditions] = useState(true)
  const [compressOutput, setCompressOutput] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [isExporting, setIsExporting] = useState(false)
  const [lastExportTime, setLastExportTime] = useState<Date | null>(null)

  // Import state
  const [isDragOver, setIsDragOver] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<string | null>(null)
  const [importProgress, setImportProgress] = useState(0)
  const [isImporting, setIsImporting] = useState(false)
  const [showImportConfirm, setShowImportConfirm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Backup state
  const [autoBackup, setAutoBackup] = useState(false)
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)
  const [restoreTarget, setRestoreTarget] = useState<BackupEntry | null>(null)
  const [isCreatingBackup, setIsCreatingBackup] = useState(false)
  const [lastBackupTime, setLastBackupTime] = useState<Date | null>(null)

  // ─── Data fetching ───
  const { data: stats } = useQuery({
    queryKey: ['stats', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/stats?timeRange=${timeRange}`)
      if (!res.ok) throw new Error('Failed to fetch stats')
      return res.json() as Promise<{
        totalPolicies: number
        totalTraces: number
        pendingApprovals: number
        auditLogCount: number
      }>
    },
    refetchInterval: 30000,
  })

  const { data: webhookData } = useQuery({
    queryKey: ['webhooks-count'],
    queryFn: async () => {
      const res = await fetch('/api/webhooks')
      if (!res.ok) throw new Error('Failed to fetch webhooks')
      return res.json() as Promise<unknown[]>
    },
    refetchInterval: 30000,
  })

  const dataCounts: DataCounts = useMemo(() => ({
    policies: stats?.totalPolicies ?? 0,
    traces: stats?.totalTraces ?? 0,
    approvals: stats?.pendingApprovals ?? 0,
    auditLogs: stats?.auditLogCount ?? 0,
    webhooks: Array.isArray(webhookData) ? webhookData.length : 0,
  }), [stats, webhookData])

  const totalRecords = useMemo(
    () => dataCounts.policies + dataCounts.traces + dataCounts.approvals + dataCounts.auditLogs + dataCounts.webhooks,
    [dataCounts]
  )

  // ─── Simulated data ───
  const exportHistory = useMemo<ExportHistoryEntry[]>(() => [
    { id: 'exp-1', timestamp: new Date(Date.now() - 1800000), type: 'Policies', format: 'csv', records: 17, size: '12 KB', status: 'Completed' },
    { id: 'exp-2', timestamp: new Date(Date.now() - 7200000), type: 'Traces', format: 'json', records: 243, size: '89 KB', status: 'Completed' },
    { id: 'exp-3', timestamp: new Date(Date.now() - 18000000), type: 'Full', format: 'html', records: 412, size: '156 KB', status: 'Completed' },
    { id: 'exp-4', timestamp: new Date(Date.now() - 43200000), type: 'Audit Logs', format: 'csv', records: 198, size: '34 KB', status: 'Completed' },
    { id: 'exp-5', timestamp: new Date(Date.now() - 86400000), type: 'Policies', format: 'json', records: 17, size: '28 KB', status: 'Failed' },
    { id: 'exp-6', timestamp: new Date(Date.now() - 129600000), type: 'Traces', format: 'csv', records: 185, size: '45 KB', status: 'Completed' },
    { id: 'exp-7', timestamp: new Date(Date.now() - 172800000), type: 'Full', format: 'json', records: 520, size: '210 KB', status: 'Completed' },
    { id: 'exp-8', timestamp: new Date(Date.now() - 259200000), type: 'Approvals', format: 'html', records: 42, size: '67 KB', status: 'Completed' },
  ], [])

  const backups = useMemo<BackupEntry[]>(() => [
    { id: 'bk-1', filename: 'agentshield-backup-2026-04-21.json', timestamp: new Date(Date.now() - 3600000), size: '1.2 MB', recordCount: 520 },
    { id: 'bk-2', filename: 'agentshield-backup-2026-04-20.json', timestamp: new Date(Date.now() - 86400000), size: '1.1 MB', recordCount: 485 },
    { id: 'bk-3', filename: 'agentshield-backup-2026-04-19.json', timestamp: new Date(Date.now() - 172800000), size: '980 KB', recordCount: 412 },
  ], [])

  const recentImports = useMemo<RecentImport[]>(() => [
    { id: 'imp-1', filename: 'policies-import.csv', date: new Date(Date.now() - 3600000), recordCount: 8, status: 'Success' },
    { id: 'imp-2', filename: 'traces-backup.json', date: new Date(Date.now() - 86400000), recordCount: 45, status: 'Success' },
    { id: 'imp-3', filename: 'audit-logs.csv', date: new Date(Date.now() - 172800000), recordCount: 0, status: 'Failed' },
    { id: 'imp-4', filename: 'webhooks-config.json', date: new Date(Date.now() - 259200000), recordCount: 3, status: 'Success' },
    { id: 'imp-5', filename: 'full-restore.json', date: new Date(Date.now() - 345600000), recordCount: 310, status: 'Success' },
  ], [])

  // ─── Handlers ───

  const toggleDataType = useCallback((key: DataType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  const handleExport = useCallback(async () => {
    if (selectedTypes.size === 0) {
      toast.error('Select at least one data type to export')
      return
    }
    setIsExporting(true)
    setExportProgress(0)

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setExportProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + Math.random() * 20
        })
      }, 200)

      const dateStr = new Date().toISOString().split('T')[0]

      if (exportFormat === 'csv') {
        // CSV export - use /api/export
        for (const type of selectedTypes) {
          let exportType = 'traces'
          if (type === 'auditLogs') exportType = 'audit'
          else if (type === 'policies' || type === 'approvals' || type === 'webhooks') {
            // For types not directly supported by /api/export, fetch as JSON and convert
            const res = await fetch(`/api/${type === 'auditLogs' ? 'audit' : type === 'approvals' ? 'approvals' : type === 'webhooks' ? 'webhooks' : 'policies'}${type === 'traces' ? '?limit=200' : ''}`)
            if (res.ok) {
              const data = await res.json()
              const csvContent = jsonToCsv(Array.isArray(data) ? data : [data])
              downloadBlob(csvContent, `agentshield-${type}-export-${dateStr}.csv`, 'text/csv')
            }
            continue
          }

          const res = await fetch(`/api/export?type=${exportType}&format=csv`)
          if (res.ok) {
            const text = await res.text()
            downloadBlob(text, `agentshield-${exportType}-export-${dateStr}.csv`, 'text/csv')
          }
        }
      } else if (exportFormat === 'json') {
        // JSON export - fetch from individual APIs and combine
        const exportData: Record<string, unknown> = { exportedAt: new Date().toISOString(), timeRange }

        const fetches: Array<{ key: string; url: string }> = []
        if (selectedTypes.has('policies')) fetches.push({ key: 'policies', url: '/api/policies' })
        if (selectedTypes.has('traces')) fetches.push({ key: 'traces', url: '/api/traces?limit=200' })
        if (selectedTypes.has('approvals')) fetches.push({ key: 'approvals', url: '/api/approvals' })
        if (selectedTypes.has('auditLogs')) fetches.push({ key: 'auditLogs', url: '/api/audit?limit=200' })
        if (selectedTypes.has('webhooks')) fetches.push({ key: 'webhooks', url: '/api/webhooks' })

        const results = await Promise.allSettled(
          fetches.map(async (f) => {
            const res = await fetch(f.url)
            if (!res.ok) throw new Error(`Failed to fetch ${f.key}`)
            return { key: f.key, data: await res.json() }
          })
        )

        for (const result of results) {
          if (result.status === 'fulfilled') {
            exportData[result.value.key] = result.value.data
          }
        }

        if (includeMetadata) {
          exportData._metadata = {
            format: 'json',
            types: Array.from(selectedTypes),
            includeConditions,
            compress: compressOutput,
            version: '1.0.0',
          }
        }

        const jsonStr = JSON.stringify(exportData, null, 2)
        downloadBlob(jsonStr, `agentshield-export-${dateStr}.json`, 'application/json')
      } else if (exportFormat === 'html') {
        // HTML report export
        const reportData: Record<string, unknown[]> = {}

        const fetches: Array<{ key: string; url: string }> = []
        if (selectedTypes.has('policies')) fetches.push({ key: 'policies', url: '/api/policies' })
        if (selectedTypes.has('traces')) fetches.push({ key: 'traces', url: '/api/traces?limit=200' })
        if (selectedTypes.has('approvals')) fetches.push({ key: 'approvals', url: '/api/approvals' })
        if (selectedTypes.has('auditLogs')) fetches.push({ key: 'auditLogs', url: '/api/audit?limit=200' })
        if (selectedTypes.has('webhooks')) fetches.push({ key: 'webhooks', url: '/api/webhooks' })

        const results = await Promise.allSettled(
          fetches.map(async (f) => {
            const res = await fetch(f.url)
            if (!res.ok) throw new Error(`Failed to fetch ${f.key}`)
            return { key: f.key, data: await res.json() }
          })
        )

        for (const result of results) {
          if (result.status === 'fulfilled') {
            reportData[result.value.key] = Array.isArray(result.value.data) ? result.value.data : [result.value.data]
          }
        }

        const htmlContent = generateHtmlReport(reportData, Array.from(selectedTypes), includeMetadata)
        downloadBlob(htmlContent, `agentshield-report-${dateStr}.html`, 'text/html')
      }

      clearInterval(progressInterval)
      setExportProgress(100)
      setLastExportTime(new Date())
      toast.success(`Exported ${Array.from(selectedTypes).join(', ')} as ${exportFormat.toUpperCase()}`)
    } catch {
      toast.error('Export failed. Please try again.')
    } finally {
      setTimeout(() => {
        setIsExporting(false)
        setExportProgress(0)
      }, 500)
    }
  }, [selectedTypes, exportFormat, includeMetadata, includeConditions, compressOutput, timeRange])

  // Import handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      validateAndSetFile(file)
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      validateAndSetFile(file)
    }
  }, [])

  const validateAndSetFile = useCallback((file: File) => {
    const validExtensions = ['.csv', '.json']
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
    if (!validExtensions.includes(ext)) {
      toast.error('Invalid file type. Please upload .csv or .json files only.')
      return
    }
    setImportFile(file)
    // Read preview
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setImportPreview(text.substring(0, 2000))
    }
    reader.readAsText(file)
  }, [])

  const handleImport = useCallback(async () => {
    if (!importFile) return
    setShowImportConfirm(false)
    toast.info('Import is not yet implemented. Data import API is coming in a future release.')
    setImportFile(null)
    setImportPreview(null)
  }, [importFile])

  // Backup handlers
  const handleCreateBackup = useCallback(async () => {
    setIsCreatingBackup(true)
    try {
      const [policiesRes, tracesRes, approvalsRes, auditRes, webhooksRes] = await Promise.allSettled([
        fetch('/api/policies'),
        fetch('/api/traces?limit=200'),
        fetch('/api/approvals'),
        fetch('/api/audit?limit=200'),
        fetch('/api/webhooks'),
      ])

      const backupData: Record<string, unknown> = {
        _meta: {
          type: 'agentshield-full-backup',
          version: '1.0.0',
          createdAt: new Date().toISOString(),
        },
      }

      const fetchData = async (result: PromiseSettledResult<Response>, key: string) => {
        if (result.status === 'fulfilled' && result.value.ok) {
          backupData[key] = await result.value.json()
        }
      }

      await fetchData(policiesRes, 'policies')
      await fetchData(tracesRes, 'traces')
      await fetchData(approvalsRes, 'approvals')
      await fetchData(auditRes, 'auditLogs')
      await fetchData(webhooksRes, 'webhooks')

      const dateStr = new Date().toISOString().split('T')[0]
      const jsonStr = JSON.stringify(backupData, null, 2)
      downloadBlob(jsonStr, `agentshield-backup-${dateStr}.json`, 'application/json')

      setLastBackupTime(new Date())
      toast.success('Full backup created and downloaded')
    } catch {
      toast.error('Failed to create backup')
    } finally {
      setIsCreatingBackup(false)
    }
  }, [])

  const handleRestore = useCallback((backup: BackupEntry) => {
    setRestoreTarget(backup)
    setShowRestoreConfirm(true)
  }, [])

  const confirmRestore = useCallback(() => {
    setShowRestoreConfirm(false)
    toast.info('Restore is not yet implemented. Database restore API is coming in a future release.')
    setRestoreTarget(null)
  }, [])

  // ─── Render ───

  return (
    <div className="p-4 md:p-6 space-y-4 dot-grid">
      {/* Section Header */}
      <div className="section-header-gradient section-header-accent rounded-xl px-4 py-3 -mx-4 -mt-2 md:-mx-6 md:-mt-4 mb-2">
        <div>
          <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <Database className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <span className="gradient-text-shimmer">Data Manager</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            Export, import, and manage your policy engine data
          </p>
        </div>
      </div>

      {/* Data Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Records', value: totalRecords, icon: Database, color: 'text-emerald-600 dark:text-emerald-400', sparkColor: '#10b981', sparkData: [totalRecords * 0.7, totalRecords * 0.8, totalRecords * 0.85, totalRecords * 0.9, totalRecords * 0.95, totalRecords] },
          { label: 'Storage Used', value: '2.4 MB', icon: HardDrive, color: 'text-cyan-600 dark:text-cyan-400', sparkColor: '#06b6d4', sparkData: [1.8, 2.0, 2.1, 2.3, 2.35, 2.4] },
          { label: 'Last Export', value: lastExportTime ? formatDistanceToNow(lastExportTime, { addSuffix: true }) : 'Never', icon: Download, color: 'text-amber-600 dark:text-amber-400', sparkColor: '#f59e0b', sparkData: [0, 0, 1, 0, 1, lastExportTime ? 1 : 0] },
          { label: 'Last Backup', value: lastBackupTime ? formatDistanceToNow(lastBackupTime, { addSuffix: true }) : 'Never', icon: Archive, color: 'text-violet-600 dark:text-violet-400', sparkColor: '#8b5cf6', sparkData: [0, 0, 0, 1, 0, lastBackupTime ? 1 : 0] },
        ].map((stat) => (
          <div key={stat.label} className="glass-card glow-hover rounded-xl p-4 border border-border/50">
            <div className="flex items-center justify-between mb-1">
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
              <MiniSparkline color={stat.sparkColor} data={stat.sparkData} />
            </div>
            <div className="font-mono tabular-nums text-xl font-bold">{stat.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Export & Import Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Export Panel */}
        <Card className="glass-card glow-hover corner-accent border border-border/50 rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Export Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Data Type Selection */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Data Types</Label>
              <div className="grid grid-cols-2 gap-2">
                {DATA_TYPE_OPTIONS.map((opt) => (
                  <label
                    key={opt.key}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 hover:border-emerald-500/30 transition-colors cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedTypes.has(opt.key)}
                      onCheckedChange={() => toggleDataType(opt.key)}
                    />
                    <span className="text-xs flex-1">{opt.label}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 font-mono tabular-nums">
                      {dataCounts[opt.key]}
                    </Badge>
                  </label>
                ))}
              </div>
            </div>

            <Separator className="opacity-50" />

            {/* Format Selection */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Format</Label>
              <div className="grid grid-cols-3 gap-2">
                {FORMAT_OPTIONS.map((fmt) => (
                  <button
                    key={fmt.key}
                    className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg border text-xs font-medium transition-all duration-150 active:scale-[0.98] ${
                      exportFormat === fmt.key
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'border-border/50 hover:border-emerald-500/30 text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setExportFormat(fmt.key)}
                  >
                    {fmt.icon}
                    <span>{fmt.label}</span>
                    <span className="text-[10px] text-muted-foreground">{fmt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <Separator className="opacity-50" />

            {/* Date Range Indicator */}
            <div className="flex items-center justify-between text-xs">
              <Label className="text-xs font-medium">Date Range</Label>
              <Badge variant="outline" className="text-[10px] px-1.5">
                <Clock className="h-2.5 w-2.5 mr-1" />
                {timeRange === '24h' ? 'Last 24 Hours' : timeRange === '7d' ? 'Last 7 Days' : timeRange === '30d' ? 'Last 30 Days' : 'Last 90 Days'}
              </Badge>
            </div>

            <Separator className="opacity-50" />

            {/* Include Options */}
            <div className="space-y-3">
              <Label className="text-xs font-medium">Options</Label>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Include metadata</span>
                  <Switch checked={includeMetadata} onCheckedChange={setIncludeMetadata} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Include condition rules</span>
                  <Switch checked={includeConditions} onCheckedChange={setIncludeConditions} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Compress output</span>
                  <Switch checked={compressOutput} onCheckedChange={setCompressOutput} />
                </div>
              </div>
            </div>

            {/* Export Progress */}
            {isExporting && (
              <div className="space-y-1.5">
                <Progress value={exportProgress} className="h-1.5" />
                <p className="text-[10px] text-muted-foreground text-center">
                  Exporting... {Math.round(exportProgress)}%
                </p>
              </div>
            )}

            {/* Export Button */}
            <Button
              className="w-full h-10 text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white active:scale-[0.98] transition-transform font-medium"
              onClick={handleExport}
              disabled={isExporting || selectedTypes.size === 0}
            >
              {isExporting ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Export Data
            </Button>
          </CardContent>
        </Card>

        {/* Import Panel */}
        <Card className="glass-card glow-hover corner-accent border border-border/50 rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Upload className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Import Data
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30">
                Coming Soon
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Drag & Drop Zone */}
            <div
              className={`relative rounded-xl border-2 border-dashed p-6 text-center transition-all duration-200 ${
                isDragOver
                  ? 'border-emerald-500 bg-emerald-500/5'
                  : 'border-border/50 hover:border-emerald-500/30'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className={`h-8 w-8 mx-auto mb-2 ${isDragOver ? 'text-emerald-500' : 'text-muted-foreground/40'}`} />
              <p className="text-xs text-muted-foreground">
                Drag & drop a file here, or
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 h-7 text-xs active:scale-[0.98] transition-transform"
                onClick={() => fileInputRef.current?.click()}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Browse Files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                className="hidden"
                onChange={handleFileSelect}
              />
              <p className="text-[10px] text-muted-foreground/60 mt-2">
                Accepts .csv and .json files
              </p>
            </div>

            {/* File Preview */}
            {importFile && importPreview && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Preview: {importFile.name}</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => {
                      setImportFile(null)
                      setImportPreview(null)
                    }}
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>
                <ScrollArea className="h-32 rounded-lg border border-border/50">
                  <pre className="p-2 text-[10px] font-mono text-muted-foreground whitespace-pre-wrap">
                    {importPreview}
                    {importPreview.length >= 2000 && '\n... (truncated)'}
                  </pre>
                </ScrollArea>
                <Button
                  className="w-full h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98] transition-transform"
                  onClick={() => setShowImportConfirm(true)}
                  disabled={isImporting}
                >
                  {isImporting ? (
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Upload className="h-3 w-3 mr-1" />
                  )}
                  Import Data
                </Button>
              </div>
            )}

            {/* Import Progress */}
            {isImporting && (
              <div className="space-y-1.5">
                <Progress value={importProgress} className="h-1.5" />
                <p className="text-[10px] text-muted-foreground text-center">
                  Importing... {Math.round(importProgress)}%
                </p>
              </div>
            )}

            <Separator className="opacity-50" />

            {/* Recent Imports */}
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                Recent Imports
              </Label>
              <ScrollArea className="max-h-36">
                <div className="space-y-1">
                  {recentImports.map((imp) => (
                    <div
                      key={imp.id}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-muted/30 transition-colors text-xs"
                    >
                      <FileJson className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate font-medium">{imp.filename}</span>
                      <span className="text-muted-foreground font-mono tabular-nums">{imp.recordCount}</span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1 py-0 ${IMPORT_STATUS_BADGE[imp.status]}`}
                      >
                        {imp.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Backup & Restore */}
      <Card className="glass-card glow-hover border border-border/50 rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Archive className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Backup & Restore
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30">
                Restore: Coming Soon
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Auto-backup</span>
                <Switch checked={autoBackup} onCheckedChange={setAutoBackup} />
                {autoBackup && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                    Daily at 2:00 AM
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              className="h-9 text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white active:scale-[0.98] transition-transform font-medium"
              onClick={handleCreateBackup}
              disabled={isCreatingBackup}
            >
              {isCreatingBackup ? (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Archive className="h-3.5 w-3.5 mr-1.5" />
              )}
              Create Backup
            </Button>
            {lastBackupTime && (
              <span className="text-xs text-muted-foreground">
                Last backup: {formatDistanceToNow(lastBackupTime, { addSuffix: true })}
              </span>
            )}
          </div>

          {/* Backup List */}
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px] h-8">Filename</TableHead>
                  <TableHead className="text-[11px] h-8">Date</TableHead>
                  <TableHead className="text-[11px] h-8">Size</TableHead>
                  <TableHead className="text-[11px] h-8">Records</TableHead>
                  <TableHead className="text-[11px] h-8 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backups.map((backup) => (
                  <TableRow key={backup.id} className="table-row-hover">
                    <TableCell className="text-xs font-medium py-2">
                      <div className="flex items-center gap-1.5">
                        <FileJson className="h-3 w-3 text-cyan-500" />
                        {backup.filename}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground py-2 font-mono tabular-nums">
                      {formatDistanceToNow(backup.timestamp, { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-xs font-mono tabular-nums py-2">
                      {backup.size}
                    </TableCell>
                    <TableCell className="text-xs font-mono tabular-nums py-2">
                      {backup.recordCount}
                    </TableCell>
                    <TableCell className="text-right py-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] active:scale-[0.98] transition-transform"
                        onClick={() => handleRestore(backup)}
                      >
                        <RefreshCw className="h-2.5 w-2.5 mr-1" />
                        Restore
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Export History */}
      <Card className="glass-card glow-hover border border-border/50 rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Export History
            <Badge variant="outline" className="text-[10px] px-1.5 font-mono tabular-nums">
              {exportHistory.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {exportHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Download className="h-10 w-10 mb-2 opacity-20" />
              <p className="text-xs font-medium">No exports yet</p>
              <p className="text-[10px] mt-1">Your export history will appear here</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[11px] h-8">Date/Time</TableHead>
                    <TableHead className="text-[11px] h-8">Type</TableHead>
                    <TableHead className="text-[11px] h-8">Format</TableHead>
                    <TableHead className="text-[11px] h-8">Records</TableHead>
                    <TableHead className="text-[11px] h-8">Size</TableHead>
                    <TableHead className="text-[11px] h-8">Status</TableHead>
                    <TableHead className="text-[11px] h-8 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {exportHistory.map((entry) => (
                      <motion.tr
                        key={entry.id}
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        transition={{ duration: 0.2 }}
                        className="table-row-hover border-b transition-colors"
                      >
                        <TableCell className="text-xs text-muted-foreground py-2 font-mono tabular-nums">
                          {formatDistanceToNow(entry.timestamp, { addSuffix: true })}
                        </TableCell>
                        <TableCell className="text-xs font-medium py-2">
                          {entry.type}
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${FORMAT_BADGE_COLORS[entry.format]}`}
                          >
                            {entry.format.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono tabular-nums py-2">
                          {entry.records}
                        </TableCell>
                        <TableCell className="text-xs font-mono tabular-nums py-2">
                          {entry.size}
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 flex items-center gap-1 w-fit ${STATUS_BADGE[entry.status]?.color ?? ''}`}
                          >
                            {STATUS_BADGE[entry.status]?.icon}
                            {entry.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right py-2">
                          {entry.status === 'Completed' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 active:scale-95 transition-transform"
                              onClick={() => toast.info('Re-downloading export...')}
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 active:scale-95 transition-transform"
                              onClick={() => toast.info('Retrying failed export...')}
                            >
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                          )}
                        </TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import Confirmation Dialog */}
      <Dialog open={showImportConfirm} onOpenChange={setShowImportConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Confirm Import
            </DialogTitle>
            <DialogDescription>
              This will import data from <span className="font-medium text-foreground">{importFile?.name}</span>. Existing records with matching IDs may be overwritten.
            </DialogDescription>
          </DialogHeader>
          {importPreview && (
            <ScrollArea className="h-24 rounded-lg border border-border/50">
              <pre className="p-2 text-[10px] font-mono text-muted-foreground whitespace-pre-wrap">
                {importPreview.substring(0, 500)}
                {importPreview.length > 500 && '\n... (truncated)'}
              </pre>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="active:scale-[0.98] transition-transform"
              onClick={() => setShowImportConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98] transition-transform"
              onClick={handleImport}
            >
              <Upload className="h-3 w-3 mr-1" />
              Confirm Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <Dialog open={showRestoreConfirm} onOpenChange={setShowRestoreConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Confirm Restore
            </DialogTitle>
            <DialogDescription>
              This will restore data from <span className="font-medium text-foreground">{restoreTarget?.filename}</span>. This action will overwrite current data with the backup data.
            </DialogDescription>
          </DialogHeader>
          {restoreTarget && (
            <div className="rounded-lg border border-border/50 p-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Records:</span>
                <span className="font-mono tabular-nums">{restoreTarget.recordCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Size:</span>
                <span className="font-mono tabular-nums">{restoreTarget.size}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date:</span>
                <span className="font-mono tabular-nums">{formatDistanceToNow(restoreTarget.timestamp, { addSuffix: true })}</span>
              </div>
            </div>
          )}
          <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-2.5 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>All current data for the restored tables will be replaced with the backup data. This cannot be undone.</span>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="active:scale-[0.98] transition-transform"
              onClick={() => setShowRestoreConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white active:scale-[0.98] transition-transform"
              onClick={confirmRestore}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Confirm Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function jsonToCsv(data: Record<string, unknown>[]): string {
  if (data.length === 0) return ''
  const headers = Object.keys(data[0])
  const escapeField = (value: unknown): string => {
    const str = String(value ?? '')
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }
  const rows = data.map((item) =>
    headers.map((h) => escapeField(item[h])).join(',')
  )
  return [headers.join(','), ...rows].join('\n')
}

function generateHtmlReport(
  data: Record<string, unknown[]>,
  types: string[],
  includeMetadata: boolean
): string {
  const sections = types.map((type) => {
    const items = data[type] ?? []
    if (items.length === 0) return `<h2>${type}</h2><p>No data available</p>`

    const headers = Object.keys(items[0] as Record<string, unknown>)
    const headerCells = headers.map((h) => `<th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:left;font-size:12px;font-weight:600;background:#f8fafc;">${h}</th>`).join('')
    const rows = items.slice(0, 50).map((item) => {
      const cells = headers.map((h) => {
        const val = (item as Record<string, unknown>)[h]
        const display = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? '')
        return `<td style="padding:6px 12px;border:1px solid #e2e8f0;font-size:11px;">${display}</td>`
      }).join('')
      return `<tr>${cells}</tr>`
    }).join('')

    return `
      <h2 style="color:#10b981;margin-top:24px;margin-bottom:8px;font-size:16px;">${type} (${items.length} records)</h2>
      <table style="border-collapse:collapse;width:100%;margin-bottom:16px;">
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `
  }).join('')

  const metaSection = includeMetadata ? `
    <div style="margin-bottom:24px;padding:12px;border-radius:8px;background:#f0fdf4;border:1px solid #bbf7d0;">
      <p style="font-size:11px;color:#6b7280;">Generated: ${new Date().toISOString()}</p>
      <p style="font-size:11px;color:#6b7280;">Types: ${types.join(', ')}</p>
    </div>
  ` : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AgentShield Export Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 32px; color: #1f2937; }
    h1 { color: #10b981; border-bottom: 2px solid #10b981; padding-bottom: 8px; }
  </style>
</head>
<body>
  <h1>🛡️ AgentShield Policy Engine Report</h1>
  ${metaSection}
  ${sections}
  <footer style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#9ca3af;text-align:center;">
    Generated by AgentShield Policy Engine Dashboard
  </footer>
</body>
</html>`
}
