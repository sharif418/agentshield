'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { PolicyForm } from './PolicyForm'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Pencil, Trash2, Shield, Download, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Policy {
  id: string
  policyId: string
  name: string
  description?: string
  agentRole: string
  resource: string
  action: string
  permissionLevel: string
  conditionRules?: string | null
  priority: number
  enabled: boolean
  createdAt: string
  updatedAt: string
}

const decisionColor: Record<string, string> = {
  ALLOW: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  BLOCK: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  REQUIRE_APPROVAL: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
}

const rowBg: Record<string, string> = {
  ALLOW: 'hover:bg-emerald-500/[0.04] dark:hover:bg-emerald-500/[0.06]',
  BLOCK: 'hover:bg-red-500/[0.04] dark:hover:bg-red-500/[0.06]',
  REQUIRE_APPROVAL: 'hover:bg-amber-500/[0.04] dark:hover:bg-amber-500/[0.06]',
}

// Subtle left-border indicator for permission level
const rowBorder: Record<string, string> = {
  ALLOW: 'border-l-2 border-l-emerald-500/40',
  BLOCK: 'border-l-2 border-l-red-500/40',
  REQUIRE_APPROVAL: 'border-l-2 border-l-amber-500/40',
}

export function PolicyManager() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [filterLevel, setFilterLevel] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editPolicy, setEditPolicy] = useState<Policy | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Policy | null>(null)

  const queryParams = new URLSearchParams()
  if (filterRole !== 'all') queryParams.set('agentRole', filterRole)
  if (filterLevel !== 'all') queryParams.set('permissionLevel', filterLevel)

  const { data: policies = [], isLoading } = useQuery<Policy[]>({
    queryKey: ['policies', filterRole, filterLevel],
    queryFn: async () => {
      const res = await fetch(`/api/policies?${queryParams.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch policies')
      return res.json()
    },
  })

  const filteredPolicies = policies.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.agentRole.toLowerCase().includes(search.toLowerCase()) ||
      p.resource.toLowerCase().includes(search.toLowerCase())
  )

  const toggleMutation = useMutation({
    mutationFn: async ({ policyId, enabled }: { policyId: string; enabled: boolean }) => {
      const res = await fetch(`/api/policies/${policyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] })
      toast.success('Policy status updated')
    },
    onError: () => toast.error('Failed to update policy'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (policyId: string) => {
      const res = await fetch(`/api/policies/${policyId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      toast.success('Policy deleted')
      setDeleteTarget(null)
    },
    onError: () => toast.error('Failed to delete policy'),
  })

  // Export policies as JSON
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(policies, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `agentshield-policies-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${policies.length} policies`)
  }

  // Import policies from JSON
  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const imported = JSON.parse(text)
        if (!Array.isArray(imported)) {
          toast.error('Invalid format: expected an array of policies')
          return
        }
        toast.info(`Found ${imported.length} policies in file. Import feature coming soon.`)
      } catch {
        toast.error('Failed to parse JSON file')
      }
    }
    input.click()
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Policy Management</h2>
          <Badge variant="secondary" className="text-xs font-mono">{policies.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-8 text-xs" onClick={handleExport}>
            <Download className="h-3 w-3 mr-1" /> Export
          </Button>
          <Button variant="outline" className="h-8 text-xs" onClick={handleImport}>
            <Upload className="h-3 w-3 mr-1" /> Import
          </Button>
          <Button
            className="h-8 text-sm bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => {
              setEditPolicy(null)
              setFormOpen(true)
            }}
          >
            <Plus className="h-3 w-3 mr-1" /> New Policy
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground -mt-2">Create and manage AI agent governance policies</p>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="h-8 text-sm pl-8"
            placeholder="Search policies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="h-8 text-sm w-full sm:w-36">
            <SelectValue placeholder="Agent Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="DataAgent">DataAgent</SelectItem>
            <SelectItem value="CodeAgent">CodeAgent</SelectItem>
            <SelectItem value="FinanceAgent">FinanceAgent</SelectItem>
            <SelectItem value="SupportAgent">SupportAgent</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterLevel} onValueChange={setFilterLevel}>
          <SelectTrigger className="h-8 text-sm w-full sm:w-40">
            <SelectValue placeholder="Permission Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="ALLOW">Allow</SelectItem>
            <SelectItem value="BLOCK">Block</SelectItem>
            <SelectItem value="REQUIRE_APPROVAL">Require Approval</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Policy Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : filteredPolicies.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No policies found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Agent Role</TableHead>
                    <TableHead className="text-xs">Resource</TableHead>
                    <TableHead className="text-xs">Action</TableHead>
                    <TableHead className="text-xs">Permission</TableHead>
                    <TableHead className="text-xs">Priority</TableHead>
                    <TableHead className="text-xs">Enabled</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPolicies.map((policy) => (
                    <TableRow
                      key={policy.policyId}
                      className={cn(
                        'transition-colors',
                        rowBg[policy.permissionLevel] ?? '',
                        rowBorder[policy.permissionLevel] ?? ''
                      )}
                    >
                      <TableCell className="text-sm font-medium max-w-[180px] truncate">
                        {policy.name}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{policy.agentRole}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{policy.resource}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{policy.action}</TableCell>
                      <TableCell>
                        <Badge className={decisionColor[policy.permissionLevel] ?? ''} variant="outline">
                          {policy.permissionLevel === 'REQUIRE_APPROVAL' ? 'APPROVAL' : policy.permissionLevel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{policy.priority}</TableCell>
                      <TableCell>
                        <Switch
                          checked={policy.enabled}
                          onCheckedChange={(checked) =>
                            toggleMutation.mutate({ policyId: policy.policyId, enabled: checked })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-muted"
                            onClick={() => {
                              setEditPolicy(policy)
                              setFormOpen(true)
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                            onClick={() => setDeleteTarget(policy)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <PolicyForm open={formOpen} onOpenChange={setFormOpen} policy={editPolicy} />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Policy</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This action cannot be
              undone. All associated traces will lose their policy reference.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.policyId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
