'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Download, FileSpreadsheet, FileJson, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface DataExportProps {
  dataType: 'traces' | 'audit'
  label?: string
}

export function DataExport({ dataType, label }: DataExportProps) {
  const [loading, setLoading] = useState(false)

  const handleExport = async (format: 'csv' | 'json') => {
    setLoading(true)
    try {
      const res = await fetch(`/api/export?type=${dataType}&format=${format}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Export failed' }))
        throw new Error(err.error ?? 'Export failed')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${dataType}-export-${new Date().toISOString().split('T')[0]}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      const typeLabel = dataType === 'traces' ? 'Execution traces' : 'Audit logs'
      toast.success(`${typeLabel} exported as ${format.toUpperCase()}`, {
        description: `${format === 'csv' ? 'Spreadsheet-compatible' : 'Structured data'} file downloaded`,
      })
    } catch (err) {
      toast.error('Export failed', {
        description: err instanceof Error ? err.message : 'An unexpected error occurred',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5 active:scale-[0.98] transition-transform"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          {label ?? 'Export'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => void handleExport('csv')} disabled={loading}>
          <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void handleExport('json')} disabled={loading}>
          <FileJson className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          Export as JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
