'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ConditionRuleBuilder } from '@/components/dashboard/ConditionRuleBuilder'

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

interface PolicyFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  policy?: Policy | null
}

const permissionLevels = [
  {
    value: 'ALLOW',
    label: 'Allow',
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    dot: 'bg-emerald-500',
  },
  {
    value: 'BLOCK',
    label: 'Block',
    color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
    dot: 'bg-red-500',
  },
  {
    value: 'REQUIRE_APPROVAL',
    label: 'Require Approval',
    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
    dot: 'bg-amber-500',
  },
]

export function PolicyForm({ open, onOpenChange, policy }: PolicyFormProps) {
  const queryClient = useQueryClient()
  const isEdit = !!policy

  const [name, setName] = useState(policy?.name ?? '')
  const [description, setDescription] = useState(policy?.description ?? '')
  const [agentRole, setAgentRole] = useState(policy?.agentRole ?? 'DataAgent')
  const [resource, setResource] = useState(policy?.resource ?? '')
  const [action, setAction] = useState(policy?.action ?? '')
  const [permissionLevel, setPermissionLevel] = useState(policy?.permissionLevel ?? 'ALLOW')
  const [conditionRules, setConditionRules] = useState(() => {
    if (policy?.conditionRules) {
      try {
        return JSON.stringify(JSON.parse(policy.conditionRules), null, 2)
      } catch {
        return policy.conditionRules
      }
    }
    return ''
  })
  const [priority, setPriority] = useState(policy?.priority ?? 0)
  const [enabled, setEnabled] = useState(policy?.enabled ?? true)

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch('/api/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to create policy')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      toast.success('Policy created successfully')
      onOpenChange(false)
      resetForm()
    },
    onError: () => toast.error('Failed to create policy'),
  })

  const updateMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch(`/api/policies/${policy?.policyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to update policy')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      toast.success('Policy updated successfully')
      onOpenChange(false)
    },
    onError: () => toast.error('Failed to update policy'),
  })

  const resetForm = () => {
    setName('')
    setDescription('')
    setAgentRole('DataAgent')
    setResource('')
    setAction('')
    setPermissionLevel('ALLOW')
    setConditionRules('')
    setPriority(0)
    setEnabled(true)
  }

  const handleSubmit = () => {
    if (!name.trim() || !resource.trim() || !action.trim()) {
      toast.error('Please fill in all required fields')
      return
    }

    const body: Record<string, unknown> = {
      name,
      description,
      agentRole,
      resource,
      action,
      permissionLevel,
      priority,
      enabled,
    }

    if (conditionRules.trim()) {
      try {
        body.conditionRules = JSON.parse(conditionRules)
      } catch {
        toast.error('Invalid JSON in condition rules')
        return
      }
    }

    if (isEdit) {
      updateMutation.mutate(body)
    } else {
      createMutation.mutate(body)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar dialog-fullscreen-mobile backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="tracking-tight">{isEdit ? 'Edit Policy' : 'Create New Policy'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Name *</Label>
            <Input
              className="h-8 text-sm"
              placeholder="e.g. DataAgent PostgreSQL Read Access"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea
              className="text-sm min-h-[60px]"
              placeholder="What this policy does..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Agent Role *</Label>
              <Select value={agentRole} onValueChange={setAgentRole}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DataAgent">DataAgent</SelectItem>
                  <SelectItem value="CodeAgent">CodeAgent</SelectItem>
                  <SelectItem value="FinanceAgent">FinanceAgent</SelectItem>
                  <SelectItem value="SupportAgent">SupportAgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Resource *</Label>
              <Input
                className="h-8 text-sm"
                placeholder="e.g. PostgreSQL, GitHub"
                value={resource}
                onChange={(e) => setResource(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Action *</Label>
            <Input
              className="h-8 text-sm"
              placeholder="e.g. SELECT, WRITE, DROP"
              value={action}
              onChange={(e) => setAction(e.target.value)}
            />
          </div>

          {/* Permission Level Selector */}
          <div className="space-y-2">
            <Label className="text-xs">Permission Level *</Label>
            <div className="grid grid-cols-3 gap-2">
              {permissionLevels.map((pl) => (
                <button
                  key={pl.value}
                  type="button"
                  onClick={() => setPermissionLevel(pl.value)}
                  className={`flex items-center gap-1.5 p-2 rounded-lg border text-xs font-medium transition-all duration-200 active:scale-[0.98] ${
                    permissionLevel === pl.value
                      ? `${pl.color} ring-2 ring-offset-1 ring-current`
                      : 'border-border hover:border-muted-foreground/30 text-muted-foreground'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${pl.dot}`} />
                  {pl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Condition Rules */}
          <div className="space-y-1.5">
            <Label className="text-xs">Condition Rules</Label>
            <ConditionRuleBuilder
              value={conditionRules}
              onChange={setConditionRules}
            />
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Priority</Label>
              <span className="text-xs font-mono tabular-nums text-muted-foreground">{priority}</span>
            </div>
            <Slider
              value={[priority]}
              onValueChange={([v]) => setPriority(v)}
              min={0}
              max={100}
              step={1}
            />
          </div>

          {/* Enabled */}
          <div className="flex items-center justify-between">
            <Label className="text-xs">Enabled</Label>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="h-8 text-sm active:scale-[0.98] transition-transform">
            Cancel
          </Button>
          <Button
            className="h-8 text-sm bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98] transition-transform"
            onClick={handleSubmit}
            disabled={isPending}
          >
            {isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            {isEdit ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
