'use client'

import { useCallback, useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, Trash2, GitBranch, Code2, ChevronDown, ChevronRight } from 'lucide-react'

// --- Types ---

interface ConditionLeaf {
  id: string
  type: 'condition'
  field: string
  operator: string // 'contains' | 'equals' | 'in' | 'gt' | 'lt'
  value: string
}

interface ConditionGroup {
  id: string
  type: 'group'
  operator: '$and' | '$or'
  children: ConditionNode[]
}

type ConditionNode = ConditionLeaf | ConditionGroup

// --- Helpers ---

let idCounter = 0
function nextId(): string {
  idCounter += 1
  return `cn-${Date.now()}-${idCounter}`
}

function createCondition(): ConditionLeaf {
  return { id: nextId(), type: 'condition', field: '', operator: 'equals', value: '' }
}

function createGroup(operator: '$and' | '$or' = '$and'): ConditionGroup {
  return { id: nextId(), type: 'group', operator, children: [createCondition()] }
}

const OPERATOR_OPTIONS = [
  { value: 'contains', label: 'contains', jsonKey: '$contains' },
  { value: 'equals', label: 'equals', jsonKey: '$equals' },
  { value: 'in', label: 'in', jsonKey: '$in' },
  { value: 'gt', label: 'greater than', jsonKey: '$gt' },
  { value: 'lt', label: 'less than', jsonKey: '$lt' },
] as const

const FIELD_SUGGESTIONS = [
  'operation',
  'recipient_domain',
  'amount',
  'currency',
  'branch',
  'query',
  'action',
  'method',
  'httpMethod',
  'to',
  'channel',
  'text',
  'path',
  'resource',
  'toolName',
]

// --- JSON <-> Tree conversion ---

function parseJsonToNode(json: unknown): ConditionNode | null {
  if (json === null || json === undefined || (typeof json === 'object' && Object.keys(json as Record<string, unknown>).length === 0)) {
    return null
  }

  if (typeof json !== 'object' || json === null) {
    return null
  }

  const obj = json as Record<string, unknown>

  // Check for $and / $or
  if (obj.$and && Array.isArray(obj.$and)) {
    const children = obj.$and.map((c: unknown) => parseJsonToNode(c)).filter((c): c is ConditionNode => c !== null)
    if (children.length === 0) return null
    if (children.length === 1) return children[0]
    return { id: nextId(), type: 'group', operator: '$and', children }
  }

  if (obj.$or && Array.isArray(obj.$or)) {
    const children = obj.$or.map((c: unknown) => parseJsonToNode(c)).filter((c): c is ConditionNode => c !== null)
    if (children.length === 0) return null
    if (children.length === 1) return children[0]
    return { id: nextId(), type: 'group', operator: '$or', children }
  }

  // Single field condition
  const keys = Object.keys(obj)
  if (keys.length === 0) return null

  // Check if it's a single field with an operator object
  if (keys.length === 1) {
    const field = keys[0]
    const condition = obj[field]

    if (typeof condition === 'object' && condition !== null && !Array.isArray(condition)) {
      const cond = condition as Record<string, unknown>
      const opKeys = Object.keys(cond)

      if (opKeys.length === 1) {
        const opKey = opKeys[0]
        const opValue = cond[opKey]

        const operatorMap: Record<string, string> = {
          '$contains': 'contains',
          '$equals': 'equals',
          '$in': 'in',
          '$gt': 'gt',
          '$lt': 'lt',
        }

        const operator = operatorMap[opKey]
        if (operator) {
          let value = ''
          if (operator === 'in' && Array.isArray(opValue)) {
            value = opValue.map(String).join(', ')
          } else {
            value = String(opValue ?? '')
          }
          return { id: nextId(), type: 'condition', field, operator, value }
        }
      }
    }

    // Simple equality: {"field": "value"}
    if (typeof condition !== 'object' || condition === null) {
      return { id: nextId(), type: 'condition', field, operator: 'equals', value: String(condition ?? '') }
    }
  }

  // Multiple fields without $and/$or - treat as $and
  const children: ConditionNode[] = []
  for (const field of keys) {
    const condition = obj[field]
    if (typeof condition === 'object' && condition !== null && !Array.isArray(condition)) {
      const cond = condition as Record<string, unknown>
      const opKeys = Object.keys(cond)
      if (opKeys.length === 1) {
        const opKey = opKeys[0]
        const opValue = cond[opKey]
        const operatorMap: Record<string, string> = {
          '$contains': 'contains',
          '$equals': 'equals',
          '$in': 'in',
          '$gt': 'gt',
          '$lt': 'lt',
        }
        const operator = operatorMap[opKey]
        if (operator) {
          let value = ''
          if (operator === 'in' && Array.isArray(opValue)) {
            value = opValue.map(String).join(', ')
          } else {
            value = String(opValue ?? '')
          }
          children.push({ id: nextId(), type: 'condition', field, operator, value })
        }
      }
    } else {
      children.push({ id: nextId(), type: 'condition', field, operator: 'equals', value: String(condition ?? '') })
    }
  }

  if (children.length === 0) return null
  if (children.length === 1) return children[0]
  return { id: nextId(), type: 'group', operator: '$and', children }
}

function nodeToJson(node: ConditionNode): Record<string, unknown> {
  if (node.type === 'condition') {
    const opEntry = OPERATOR_OPTIONS.find(o => o.value === node.operator)
    const jsonKey = opEntry?.jsonKey ?? '$equals'

    let parsedValue: unknown = node.value

    if (node.operator === 'in') {
      parsedValue = node.value.split(',').map(v => v.trim()).filter(v => v.length > 0)
      // Try to parse as numbers
      parsedValue = (parsedValue as string[]).map(v => {
        const num = Number(v)
        return isNaN(num) ? v : num
      })
    } else if (node.operator === 'gt' || node.operator === 'lt') {
      const num = Number(node.value)
      parsedValue = isNaN(num) ? node.value : num
    }

    return { [node.field]: { [jsonKey]: parsedValue } }
  }

  // Group
  const childrenJson = node.children.map(c => nodeToJson(c))
  return { [node.operator]: childrenJson }
}

// --- Tree mutation helpers ---

function updateNode(root: ConditionNode, id: string, updater: (node: ConditionNode) => ConditionNode): ConditionNode {
  if (root.id === id) return updater(root)

  if (root.type === 'group') {
    return {
      ...root,
      children: root.children.map(child => updateNode(child, id, updater)),
    }
  }

  return root
}

function removeNode(root: ConditionNode, id: string): ConditionNode | null {
  if (root.id === id) return null

  if (root.type === 'group') {
    const newChildren = root.children
      .map(child => removeNode(child, id))
      .filter((c): c is ConditionNode => c !== null)

    if (newChildren.length === 0) return null
    if (newChildren.length === 1) return newChildren[0]

    return { ...root, children: newChildren }
  }

  return root
}

function addChild(root: ConditionNode, groupId: string, child: ConditionNode): ConditionNode {
  if (root.id === groupId && root.type === 'group') {
    return { ...root, children: [...root.children, child] }
  }

  if (root.type === 'group') {
    return {
      ...root,
      children: root.children.map(c => addChild(c, groupId, child)),
    }
  }

  return root
}

// --- Sub-components ---

interface ConditionRowProps {
  condition: ConditionLeaf
  onChange: (updated: ConditionLeaf) => void
  onRemove: () => void
}

function ConditionRow({ condition, onChange, onRemove }: ConditionRowProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.15 } }}
      className="flex flex-wrap items-center gap-2 py-2"
    >
      {/* Field input */}
      <Input
        className="h-8 text-xs min-w-[120px] flex-1"
        placeholder="Field name (e.g. operation)"
        list="condition-fields"
        value={condition.field}
        onChange={(e) => onChange({ ...condition, field: e.target.value })}
      />

      {/* Operator select */}
      <Select
        value={condition.operator}
        onValueChange={(v) => onChange({ ...condition, operator: v })}
      >
        <SelectTrigger className="h-8 text-xs w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPERATOR_OPTIONS.map(op => (
            <SelectItem key={op.value} value={op.value} className="text-xs">
              {op.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value input */}
      <Input
        className="h-8 text-xs min-w-[120px] flex-1"
        placeholder={condition.operator === 'in' ? 'val1, val2, val3' : 'Value'}
        value={condition.value}
        onChange={(e) => onChange({ ...condition, value: e.target.value })}
      />

      {/* Delete button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-red-500 shrink-0"
        onClick={onRemove}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </motion.div>
  )
}

interface GroupNodeProps {
  group: ConditionGroup
  depth?: number
  onChange: (updated: ConditionNode) => void
  onRemove: () => void
}

function GroupNode({ group, depth = 0, onChange, onRemove }: GroupNodeProps) {
  const [collapsed, setCollapsed] = useState(false)
  const isAnd = group.operator === '$and'

  const handleChildChange = useCallback((childId: string, updated: ConditionNode) => {
    const newGroup = updateNode(group, childId, () => updated)
    onChange(newGroup)
  }, [group, onChange])

  const handleChildRemove = useCallback((childId: string) => {
    const result = removeNode(group, childId)
    if (result === null) {
      onRemove()
    } else {
      onChange(result)
    }
  }, [group, onChange, onRemove])

  const handleAddCondition = useCallback(() => {
    const newChild = createCondition()
    const newGroup = addChild(group, group.id, newChild)
    onChange(newGroup)
  }, [group, onChange])

  const handleAddGroup = useCallback(() => {
    const newGroup = createGroup(isAnd ? '$and' : '$or')
    const updated = addChild(group, group.id, newGroup)
    onChange(updated)
  }, [group, isAnd, onChange])

  const handleToggleOperator = useCallback(() => {
    onChange({ ...group, operator: group.operator === '$and' ? '$or' : '$and' })
  }, [group, onChange])

  const borderColor = isAnd ? 'border-emerald-300 dark:border-emerald-700' : 'border-amber-300 dark:border-amber-700'
  const bgColor = isAnd ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : 'bg-amber-50/50 dark:bg-amber-950/20'
  const labelBg = isAnd
    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
    : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
      className={`rounded-lg border-2 border-dashed p-3 space-y-2 ${borderColor} ${bgColor}`}
      style={{ marginLeft: depth > 0 ? undefined : undefined }}
    >
      {/* Group header */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>

        <button
          type="button"
          onClick={handleToggleOperator}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${labelBg} hover:opacity-80`}
        >
          {isAnd ? 'ALL of' : 'ANY of'}
        </button>

        {depth > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-red-500 ml-auto shrink-0"
            onClick={onRemove}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Children */}
      {!collapsed && (
        <AnimatePresence mode="popLayout">
          {group.children.map((child) => {
            if (child.type === 'condition') {
              return (
                <ConditionRow
                  key={child.id}
                  condition={child}
                  onChange={(updated) => handleChildChange(child.id, updated)}
                  onRemove={() => handleChildRemove(child.id)}
                />
              )
            }

            return (
              <GroupNode
                key={child.id}
                group={child}
                depth={depth + 1}
                onChange={(updated) => handleChildChange(child.id, updated)}
                onRemove={() => handleChildRemove(child.id)}
              />
            )
          })}
        </AnimatePresence>
      )}

      {/* Add buttons */}
      {!collapsed && (
        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 h-7"
            onClick={handleAddCondition}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Condition
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 h-7"
            onClick={handleAddGroup}
          >
            <GitBranch className="h-3 w-3 mr-1" />
            Add Group
          </Button>
        </div>
      )}
    </motion.div>
  )
}

// --- Main Component ---

interface ConditionRuleBuilderProps {
  value: string
  onChange: (value: string) => void
}

export function ConditionRuleBuilder({ value, onChange }: ConditionRuleBuilderProps) {
  const [rawMode, setRawMode] = useState(false)
  const [rawText, setRawText] = useState(value)
  const [jsonError, setJsonError] = useState<string | null>(null)

  // Parse the JSON value into a tree
  const rootNode = useMemo<ConditionNode | null>(() => {
    if (!value.trim()) return null
    try {
      const parsed = JSON.parse(value)
      return parseJsonToNode(parsed)
    } catch {
      return null
    }
  }, [value])

  // Sync raw text from value when not in raw mode
  const handleToggleRawMode = useCallback((toRaw: boolean) => {
    if (toRaw) {
      // Switching to raw mode: sync current value
      setRawText(value)
      setJsonError(null)
    }
    setRawMode(toRaw)
  }, [value])

  const handleRawTextChange = useCallback((text: string) => {
    setRawText(text)
    if (!text.trim()) {
      setJsonError(null)
      onChange('')
      return
    }
    try {
      JSON.parse(text)
      setJsonError(null)
      onChange(text)
    } catch {
      setJsonError('Invalid JSON format')
    }
  }, [onChange])

  const handleTreeChange = useCallback((updated: ConditionNode) => {
    const json = nodeToJson(updated)
    const jsonString = JSON.stringify(json, null, 2)
    onChange(jsonString)
  }, [onChange])

  const handleAddRootCondition = useCallback(() => {
    const newCondition = createCondition()

    if (rootNode === null) {
      // No existing root, just set this condition
      const json = nodeToJson(newCondition)
      onChange(JSON.stringify(json, null, 2))
      return
    }

    // If root is a single condition, wrap in $and group
    if (rootNode.type === 'condition') {
      const group: ConditionGroup = {
        id: nextId(),
        type: 'group',
        operator: '$and',
        children: [rootNode, newCondition],
      }
      const json = nodeToJson(group)
      onChange(JSON.stringify(json, null, 2))
      return
    }

    // Root is already a group, add to it
    const newRoot = addChild(rootNode, rootNode.id, newCondition)
    const json = nodeToJson(newRoot)
    onChange(JSON.stringify(json, null, 2))
  }, [rootNode, onChange])

  const handleAddRootGroup = useCallback(() => {
    const newGroup = createGroup('$and')

    if (rootNode === null) {
      const json = nodeToJson(newGroup)
      onChange(JSON.stringify(json, null, 2))
      return
    }

    // If root is a single condition, wrap both in $and group
    if (rootNode.type === 'condition') {
      const outerGroup: ConditionGroup = {
        id: nextId(),
        type: 'group',
        operator: '$and',
        children: [rootNode, newGroup],
      }
      const json = nodeToJson(outerGroup)
      onChange(JSON.stringify(json, null, 2))
      return
    }

    // Root is already a group, add the new group as child
    const newRoot = addChild(rootNode, rootNode.id, newGroup)
    const json = nodeToJson(newRoot)
    onChange(JSON.stringify(json, null, 2))
  }, [rootNode, onChange])

  const handleClearAll = useCallback(() => {
    onChange('')
  }, [onChange])

  // JSON preview of current value
  const previewJson = useMemo(() => {
    if (!value.trim()) return ''
    try {
      return JSON.stringify(JSON.parse(value), null, 2)
    } catch {
      return value
    }
  }, [value])

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="flex items-center gap-2">
        <Button
          variant={rawMode ? 'ghost' : 'secondary'}
          size="sm"
          className={`text-xs h-7 ${!rawMode ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : ''}`}
          onClick={() => handleToggleRawMode(false)}
        >
          <GitBranch className="h-3 w-3 mr-1" />
          Visual
        </Button>
        <Button
          variant={rawMode ? 'secondary' : 'ghost'}
          size="sm"
          className={`text-xs h-7 ${rawMode ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : ''}`}
          onClick={() => handleToggleRawMode(true)}
        >
          <Code2 className="h-3 w-3 mr-1" />
          Raw JSON
        </Button>
      </div>

      {rawMode ? (
        /* Raw JSON mode */
        <div className="space-y-1.5">
          <textarea
            className={`w-full text-xs font-mono min-h-[100px] p-2 rounded-md border bg-background resize-y ${
              jsonError ? 'border-red-500' : 'border-input'
            }`}
            placeholder='{"operation": {"$in": ["INSERT", "UPDATE"]}}'
            value={rawText}
            onChange={(e) => handleRawTextChange(e.target.value)}
          />
          {jsonError && <p className="text-xs text-red-500">{jsonError}</p>}
        </div>
      ) : (
        /* Visual mode */
        <div className="space-y-2">
          {rootNode ? (
            <>
              {rootNode.type === 'condition' ? (
                // Single root condition - wrap in a visual group for consistency
                <div className="rounded-lg border-2 border-dashed p-3 space-y-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <ConditionRow
                    condition={rootNode}
                    onChange={(updated) => handleTreeChange(updated)}
                    onRemove={handleClearAll}
                  />
                </div>
              ) : (
                <GroupNode
                  group={rootNode}
                  onChange={handleTreeChange}
                  onRemove={handleClearAll}
                />
              )}

              {/* Add root-level buttons */}
              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 h-7"
                  onClick={handleAddRootCondition}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Condition
                </Button>
                {rootNode.type === 'condition' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 h-7"
                    onClick={handleAddRootGroup}
                  >
                    <GitBranch className="h-3 w-3 mr-1" />
                    Add Group
                  </Button>
                )}
              </div>
            </>
          ) : (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground border-2 border-dashed rounded-lg border-muted">
              <GitBranch className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-xs mb-3">No condition rules defined</p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={handleAddRootCondition}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Condition
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={handleAddRootGroup}
                >
                  <GitBranch className="h-3 w-3 mr-1" />
                  Add Group
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* JSON Preview */}
      {previewJson && (
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">JSON Preview</p>
          <pre className="font-mono text-xs bg-muted p-2 rounded max-h-32 overflow-auto custom-scrollbar">
            {previewJson}
          </pre>
        </div>
      )}

      {/* Datalist for field suggestions */}
      <datalist id="condition-fields">
        {FIELD_SUGGESTIONS.map(f => (
          <option key={f} value={f} />
        ))}
      </datalist>
    </div>
  )
}
