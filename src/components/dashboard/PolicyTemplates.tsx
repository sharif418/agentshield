'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  BookOpen,
  Search,
  Star,
  Eye,
  Download,
  CheckCircle,
  ShieldCheck,
  ShieldX,
  AlertTriangle,
  Loader2,
  Database,
  Code2,
  DollarSign,
  Headphones,
  Copy,
  Layers,
  TrendingUp,
  BarChart3,
  X,
} from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Types ───────────────────────────────────────────────────────────────────

type TemplateCategory = 'Security' | 'Data Protection' | 'Compliance' | 'Operations' | 'Custom'
type PermissionLevel = 'ALLOW' | 'BLOCK' | 'REQUIRE_APPROVAL'
type Complexity = 'Simple' | 'Moderate' | 'Advanced'

interface PolicyTemplate {
  id: string
  name: string
  description: string
  category: TemplateCategory
  permissionLevel: PermissionLevel
  agentRole: string
  resource: string
  action: string
  conditionRules: Record<string, unknown>
  complexity: Complexity
  tags: string[]
  priority: number
  isImported: boolean
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES: Array<{ name: TemplateCategory | 'All'; color: string; activeColor: string }> = [
  { name: 'All', color: '', activeColor: 'bg-emerald-600 text-white' },
  { name: 'Security', color: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30', activeColor: 'bg-red-600 text-white' },
  { name: 'Data Protection', color: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30', activeColor: 'bg-cyan-600 text-white' },
  { name: 'Compliance', color: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30', activeColor: 'bg-amber-600 text-white' },
  { name: 'Operations', color: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30', activeColor: 'bg-violet-600 text-white' },
  { name: 'Custom', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30', activeColor: 'bg-emerald-600 text-white' },
]

const CATEGORY_COLORS: Record<string, string> = {
  Security: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
  'Data Protection': 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
  Compliance: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  Operations: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
  Custom: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
}

const PERMISSION_CONFIG: Record<PermissionLevel, { color: string; dotColor: string; icon: React.ReactNode }> = {
  ALLOW: {
    color: 'text-emerald-600 dark:text-emerald-400',
    dotColor: 'bg-emerald-500',
    icon: <ShieldCheck className="h-3.5 w-3.5" />,
  },
  BLOCK: {
    color: 'text-red-600 dark:text-red-400',
    dotColor: 'bg-red-500',
    icon: <ShieldX className="h-3.5 w-3.5" />,
  },
  REQUIRE_APPROVAL: {
    color: 'text-amber-600 dark:text-amber-400',
    dotColor: 'bg-amber-500',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
}

const COMPLEXITY_STARS: Record<Complexity, number> = {
  Simple: 1,
  Moderate: 2,
  Advanced: 3,
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  DataAgent: <Database className="h-3.5 w-3.5" />,
  CodeAgent: <Code2 className="h-3.5 w-3.5" />,
  FinanceAgent: <DollarSign className="h-3.5 w-3.5" />,
  SupportAgent: <Headphones className="h-3.5 w-3.5" />,
}

const ROLE_COLORS: Record<string, string> = {
  DataAgent: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
  CodeAgent: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
  FinanceAgent: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  SupportAgent: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
}

// ─── Hardcoded Template Data ─────────────────────────────────────────────────

const TEMPLATES: PolicyTemplate[] = [
  {
    id: 'tpl-sql-injection',
    name: 'SQL Injection Prevention',
    description: 'Blocks SQL injection attempts by detecting DROP, DELETE, and TRUNCATE operations on database connections. Prevents data loss from malicious queries.',
    category: 'Security',
    permissionLevel: 'BLOCK',
    agentRole: 'DataAgent',
    resource: 'PostgreSQL',
    action: 'DROP TABLE',
    conditionRules: {
      $or: [
        { query: { $contains: 'DROP TABLE' } },
        { query: { $contains: 'DROP DATABASE' } },
        { operation: { $in: ['DROP', 'TRUNCATE', 'DELETE_ALL'] } },
      ],
    },
    complexity: 'Advanced',
    tags: ['SQL Injection', 'Database', 'DROP'],
    priority: 100,
    isImported: false,
  },
  {
    id: 'tpl-data-exfil',
    name: 'Data Exfiltration Block',
    description: 'Prevents unauthorized bulk data reads and file system exports that could lead to data exfiltration. Monitors large result sets and unusual access patterns.',
    category: 'Security',
    permissionLevel: 'BLOCK',
    agentRole: 'DataAgent',
    resource: 'FileSystem',
    action: 'WRITE',
    conditionRules: {
      $and: [
        { path: { $contains: '/etc/' } },
        { operation: { $in: ['WRITE', 'EXPORT', 'COPY'] } },
      ],
    },
    complexity: 'Advanced',
    tags: ['Data Exfiltration', 'FileSystem', 'Export'],
    priority: 95,
    isImported: false,
  },
  {
    id: 'tpl-unauth-merge',
    name: 'Unauthorized Merge Protection',
    description: 'Blocks force pushes and unauthorized merge operations to protected branches. Ensures code integrity in production repositories.',
    category: 'Security',
    permissionLevel: 'BLOCK',
    agentRole: 'CodeAgent',
    resource: 'GitHub',
    action: 'FORCE_PUSH',
    conditionRules: {
      $or: [
        { branch: { $in: ['main', 'production', 'release'] } },
        { force: { $equals: true } },
      ],
    },
    complexity: 'Moderate',
    tags: ['GitHub', 'Merge Protection', 'Branch Safety'],
    priority: 85,
    isImported: false,
  },
  {
    id: 'tpl-fin-txn-limit',
    name: 'Financial Transaction Limit',
    description: 'Requires approval for financial transactions exceeding configurable thresholds. Protects against unauthorized large payments and transfers.',
    category: 'Compliance',
    permissionLevel: 'REQUIRE_APPROVAL',
    agentRole: 'FinanceAgent',
    resource: 'Stripe',
    action: 'CHARGE',
    conditionRules: {
      $or: [
        { amount: { $gt: 10000 } },
        { currency: { $in: ['BTC', 'ETH'] } },
      ],
    },
    complexity: 'Moderate',
    tags: ['Transaction Limit', 'Financial', 'Approval'],
    priority: 80,
    isImported: false,
  },
  {
    id: 'tpl-bulk-email',
    name: 'Bulk Email Restriction',
    description: 'Requires approval for bulk email operations to prevent spam and ensure compliance with email regulations. Limits recipients and enforces opt-in checks.',
    category: 'Operations',
    permissionLevel: 'REQUIRE_APPROVAL',
    agentRole: 'SupportAgent',
    resource: 'EmailAPI',
    action: 'BULK_SEND',
    conditionRules: {
      $or: [
        { recipientCount: { $gt: 100 } },
        { bulk: { $equals: true } },
      ],
    },
    complexity: 'Simple',
    tags: ['Email', 'Bulk Send', 'Spam Prevention'],
    priority: 50,
    isImported: false,
  },
  {
    id: 'tpl-fs-read',
    name: 'File System Read Access',
    description: 'Allows read-only access to designated file system paths. Restricts write operations while enabling data retrieval for analysis and reporting.',
    category: 'Data Protection',
    permissionLevel: 'ALLOW',
    agentRole: 'DataAgent',
    resource: 'FileSystem',
    action: 'READ',
    conditionRules: {
      $and: [
        { operation: { $equals: 'READ' } },
        { path: { $contains: '/data/' } },
      ],
    },
    complexity: 'Simple',
    tags: ['FileSystem', 'Read Access', 'Data Retrieval'],
    priority: 30,
    isImported: false,
  },
  {
    id: 'tpl-gh-read',
    name: 'GitHub Read Access',
    description: 'Allows read-only operations on GitHub repositories including cloning, fetching, and PR reviews. Blocks any write or administrative actions.',
    category: 'Data Protection',
    permissionLevel: 'ALLOW',
    agentRole: 'CodeAgent',
    resource: 'GitHub',
    action: 'READ',
    conditionRules: {
      $and: [
        { operation: { $in: ['READ', 'CLONE', 'FETCH', 'REVIEW'] } },
      ],
    },
    complexity: 'Simple',
    tags: ['GitHub', 'Read Access', 'Code Review'],
    priority: 25,
    isImported: false,
  },
  {
    id: 'tpl-stripe-readonly',
    name: 'Stripe Read-Only Access',
    description: 'Permits read-only access to Stripe for viewing transactions, customers, and balance. Prevents any charge, refund, or modification operations.',
    category: 'Data Protection',
    permissionLevel: 'ALLOW',
    agentRole: 'FinanceAgent',
    resource: 'Stripe',
    action: 'READ',
    conditionRules: {
      $and: [
        { operation: { $in: ['LIST', 'GET', 'BALANCE'] } },
      ],
    },
    complexity: 'Simple',
    tags: ['Stripe', 'Read Access', 'Financial Data'],
    priority: 20,
    isImported: false,
  },
  {
    id: 'tpl-prod-deploy',
    name: 'Production Deploy Gate',
    description: 'Requires manual approval for production deployment operations. Ensures human oversight before changes reach production Kubernetes clusters.',
    category: 'Operations',
    permissionLevel: 'REQUIRE_APPROVAL',
    agentRole: 'CodeAgent',
    resource: 'Kubernetes',
    action: 'DEPLOY',
    conditionRules: {
      $and: [
        { namespace: { $equals: 'production' } },
        { operation: { $in: ['DEPLOY', 'APPLY', 'ROLLOUT'] } },
      ],
    },
    complexity: 'Advanced',
    tags: ['Kubernetes', 'Deployment', 'Production Gate'],
    priority: 90,
    isImported: false,
  },
  {
    id: 'tpl-sensitive-data',
    name: 'Sensitive Data Access',
    description: 'Blocks access to tables containing PII, credentials, and sensitive information. Protects regulated data from unauthorized queries.',
    category: 'Compliance',
    permissionLevel: 'BLOCK',
    agentRole: 'DataAgent',
    resource: 'PostgreSQL',
    action: 'SELECT',
    conditionRules: {
      $or: [
        { table: { $in: ['users', 'credentials', 'payments', 'ssn_records'] } },
        { query: { $contains: 'password' } },
      ],
    },
    complexity: 'Moderate',
    tags: ['PII', 'Sensitive Data', 'Access Control'],
    priority: 75,
    isImported: false,
  },
  {
    id: 'tpl-refund-approval',
    name: 'Refund Approval Flow',
    description: 'Requires approval for all refund operations to prevent unauthorized money returns. Applies to both partial and full refund scenarios.',
    category: 'Compliance',
    permissionLevel: 'REQUIRE_APPROVAL',
    agentRole: 'FinanceAgent',
    resource: 'Stripe',
    action: 'REFUND',
    conditionRules: {
      $or: [
        { operation: { $equals: 'REFUND' } },
        { amount: { $gt: 0 } },
      ],
    },
    complexity: 'Simple',
    tags: ['Refund', 'Approval', 'Financial'],
    priority: 70,
    isImported: false,
  },
  {
    id: 'tpl-slack-mod',
    name: 'Slack Message Moderation',
    description: 'Requires approval for Slack message operations to channels with more than 50 members. Prevents spam and ensures message quality in large channels.',
    category: 'Operations',
    permissionLevel: 'REQUIRE_APPROVAL',
    agentRole: 'SupportAgent',
    resource: 'SlackAPI',
    action: 'POST_MESSAGE',
    conditionRules: {
      $or: [
        { channelMembers: { $gt: 50 } },
        { channel: { $in: ['#general', '#announcements', '#company-all'] } },
      ],
    },
    complexity: 'Simple',
    tags: ['Slack', 'Moderation', 'Messaging'],
    priority: 45,
    isImported: false,
  },
  {
    id: 'tpl-container-esc',
    name: 'Container Escalation Block',
    description: 'Blocks privileged container operations and privilege escalation attempts in Kubernetes. Prevents container breakout and unauthorized access to host resources.',
    category: 'Security',
    permissionLevel: 'BLOCK',
    agentRole: 'CodeAgent',
    resource: 'Kubernetes',
    action: 'ESCALATE',
    conditionRules: {
      $or: [
        { privileged: { $equals: true } },
        { operation: { $in: ['PRIVILEGED', 'ESCALATE', 'HOST_NETWORK'] } },
        { capabilities: { $contains: 'SYS_ADMIN' } },
      ],
    },
    complexity: 'Advanced',
    tags: ['Container Security', 'Privilege Escalation', 'Kubernetes'],
    priority: 98,
    isImported: false,
  },
  {
    id: 'tpl-rate-limit',
    name: 'API Rate Limiting',
    description: 'Blocks requests that exceed configured rate limits per agent role. Protects backend services from overload and abuse by throttling excessive API calls.',
    category: 'Operations',
    permissionLevel: 'BLOCK',
    agentRole: 'DataAgent',
    resource: 'PostgreSQL',
    action: 'QUERY',
    conditionRules: {
      $or: [
        { requestsPerMinute: { $gt: 100 } },
        { concurrentConnections: { $gt: 20 } },
      ],
    },
    complexity: 'Moderate',
    tags: ['Rate Limiting', 'API Protection', 'Throttling'],
    priority: 60,
    isImported: false,
  },
]

// ─── Main Component ──────────────────────────────────────────────────────────

export function PolicyTemplates() {
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | 'All'>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set())
  const [previewTemplate, setPreviewTemplate] = useState<PolicyTemplate | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchQuery])

  // Filter templates by category and search
  const filteredTemplates = useMemo(() => {
    return TEMPLATES.filter((t) => {
      const matchesCategory = activeCategory === 'All' || t.category === activeCategory
      const matchesSearch =
        debouncedSearch === '' ||
        t.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        t.description.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        t.tags.some((tag) => tag.toLowerCase().includes(debouncedSearch.toLowerCase()))
      return matchesCategory && matchesSearch
    })
  }, [activeCategory, debouncedSearch])

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: TEMPLATES.length }
    for (const t of TEMPLATES) {
      counts[t.category] = (counts[t.category] ?? 0) + 1
    }
    return counts
  }, [])

  // Stats
  const stats = useMemo(() => {
    const totalTemplates = TEMPLATES.length
    const importedCount = importedIds.size
    const categoryCountMap: Record<string, number> = {}
    for (const t of TEMPLATES) {
      categoryCountMap[t.category] = (categoryCountMap[t.category] ?? 0) + 1
    }
    const mostPopularCategory =
      Object.entries(categoryCountMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
    const successRate = importedCount > 0 ? 100 : 0 // All imports succeed in our mock
    return { totalTemplates, importedCount, mostPopularCategory, successRate }
  }, [importedIds])

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (template: PolicyTemplate) => {
      const res = await fetch('/api/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: template.name,
          description: template.description,
          agentRole: template.agentRole,
          resource: template.resource,
          action: template.action,
          permissionLevel: template.permissionLevel,
          conditionRules: template.conditionRules,
          priority: template.priority,
          enabled: true,
        }),
      })
      if (!res.ok) throw new Error('Failed to import template')
      return res.json()
    },
    onSuccess: (_data, template) => {
      setImportedIds((prev) => new Set(prev).add(template.id))
      toast.success(`Template "${template.name}" imported successfully`)
      if (previewTemplate?.id === template.id) {
        setPreviewTemplate({ ...template, isImported: true })
      }
    },
    onError: (_err, template) => {
      toast.error(`Failed to import "${template.name}"`)
    },
  })

  const handleImport = useCallback(
    (template: PolicyTemplate) => {
      if (importedIds.has(template.id)) return
      importMutation.mutate(template)
    },
    [importMutation, importedIds]
  )

  // Check if a template is imported
  const isTemplateImported = useCallback(
    (id: string) => importedIds.has(id),
    [importedIds]
  )

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Section Header */}
      <div className="section-header-gradient section-header-accent rounded-xl px-4 py-3 -mx-4 -mt-2 md:-mx-6 md:-mt-4 mb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2 gradient-text-shimmer">
              <BookOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Policy Templates
            </h2>
            <p className="text-sm text-muted-foreground">
              Browse, preview, and import pre-built policy configurations
            </p>
          </div>
        </div>
      </div>

      {/* Statistics Card */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="glass-card glow-hover border border-border/50 rounded-xl">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Total Templates</p>
              <p className="text-lg font-bold font-mono tabular-nums">{stats.totalTemplates}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card glow-hover border border-border/50 rounded-xl">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 shrink-0">
              <Download className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Imported</p>
              <p className="text-lg font-bold font-mono tabular-nums">{stats.importedCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card glow-hover border border-border/50 rounded-xl">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Popular Category</p>
              <p className="text-sm font-bold truncate">{stats.mostPopularCategory}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card glow-hover border border-border/50 rounded-xl">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 shrink-0">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Success Rate</p>
              <p className="text-lg font-bold font-mono tabular-nums">{stats.successRate}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9 h-9 text-sm bg-background/80 border-border/50"
          placeholder="Search templates by name, description, or tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setSearchQuery('')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.name
          const count = categoryCounts[cat.name] ?? 0
          return (
            <button
              key={cat.name}
              onClick={() => setActiveCategory(cat.name)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border active:scale-[0.98] ${
                isActive
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted hover:text-foreground'
              }`}
            >
              {cat.name}
              <span
                className={`font-mono tabular-nums text-[10px] px-1.5 py-0.5 rounded-full ${
                  isActive
                    ? 'bg-emerald-500/40 text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Template Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredTemplates.map((template, index) => {
            const permConfig = PERMISSION_CONFIG[template.permissionLevel]
            const isImported = isTemplateImported(template.id)
            const starCount = COMPLEXITY_STARS[template.complexity]

            return (
              <motion.div
                key={template.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Card className="glass-card glow-hover card-shine corner-accent border border-border/50 rounded-xl h-full flex flex-col">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-sm font-semibold leading-tight flex-1">
                        {template.name}
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 shrink-0 ${CATEGORY_COLORS[template.category]}`}
                      >
                        {template.category}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col gap-3">
                    {/* Description */}
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {template.description}
                    </p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1">
                      {template.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted/80 text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Permission Level & Complexity */}
                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${permConfig.dotColor}`}
                        />
                        <span className={`text-[11px] font-medium ${permConfig.color}`}>
                          {template.permissionLevel === 'REQUIRE_APPROVAL'
                            ? 'APPROVAL'
                            : template.permissionLevel}
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${
                              i < starCount
                                ? 'text-amber-500 fill-amber-500'
                                : 'text-muted-foreground/30'
                            }`}
                          />
                        ))}
                        <span className="text-[10px] text-muted-foreground ml-1">
                          {template.complexity}
                        </span>
                      </div>
                    </div>

                    {/* Agent / Resource info */}
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${ROLE_COLORS[template.agentRole] ?? ''}`}
                      >
                        {ROLE_ICONS[template.agentRole]}
                        <span className="ml-1">{template.agentRole}</span>
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {template.resource} &middot; {template.action}
                      </span>
                    </div>

                    <Separator className="opacity-50" />

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] flex-1 active:scale-[0.98] transition-transform"
                        onClick={() => setPreviewTemplate(template)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Preview
                      </Button>
                      {isImported ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled
                          className="h-7 text-[11px] flex-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Imported
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="h-7 text-[11px] flex-1 bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98] transition-transform"
                          onClick={() => handleImport(template)}
                          disabled={importMutation.isPending}
                        >
                          {importMutation.isPending &&
                          importMutation.variables?.id === template.id ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Download className="h-3 w-3 mr-1" />
                          )}
                          Import
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Empty State */}
      {filteredTemplates.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <BookOpen className="h-12 w-12 mb-3 opacity-20" />
          <p className="text-sm font-medium">No templates found</p>
          <p className="text-xs mt-1">Try adjusting your search or category filter</p>
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog
        open={previewTemplate !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewTemplate(null)
        }}
      >
        <DialogContent className="dialog-fullscreen-mobile sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          {previewTemplate && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base tracking-tight">
                  <BookOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  {previewTemplate.name}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {previewTemplate.description}
                </DialogDescription>
              </DialogHeader>

              <ScrollArea className="flex-1 -mx-6 px-6">
                <div className="space-y-4 pb-4">
                  {/* Metadata badges */}
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant="outline"
                      className={`text-[11px] ${CATEGORY_COLORS[previewTemplate.category]}`}
                    >
                      {previewTemplate.category}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[11px] ${PERMISSION_CONFIG[previewTemplate.permissionLevel].color}`}
                    >
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${PERMISSION_CONFIG[previewTemplate.permissionLevel].dotColor}`}
                      />
                      {previewTemplate.permissionLevel === 'REQUIRE_APPROVAL'
                        ? 'REQUIRE APPROVAL'
                        : previewTemplate.permissionLevel}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[11px] ${ROLE_COLORS[previewTemplate.agentRole] ?? ''}`}
                    >
                      {ROLE_ICONS[previewTemplate.agentRole]}
                      <span className="ml-1">{previewTemplate.agentRole}</span>
                    </Badge>
                    <Badge variant="outline" className="text-[11px]">
                      {previewTemplate.complexity}
                    </Badge>
                  </div>

                  {/* Resource & Action */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border/50 p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                        Resource
                      </p>
                      <p className="text-sm font-medium">{previewTemplate.resource}</p>
                    </div>
                    <div className="rounded-lg border border-border/50 p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                        Action
                      </p>
                      <p className="text-sm font-medium font-mono">
                        {previewTemplate.action}
                      </p>
                    </div>
                  </div>

                  {/* Agent Role Assignment */}
                  <div className="rounded-lg border border-border/50 p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
                      Agent Role Assignment
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted/80">
                        {ROLE_ICONS[previewTemplate.agentRole]}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{previewTemplate.agentRole}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Assigned agent for this policy
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Condition Rules */}
                  <div className="rounded-lg border border-border/50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        Condition Rules
                      </p>
                      <button
                        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 active:scale-[0.98]"
                        onClick={() => {
                          navigator.clipboard.writeText(
                            JSON.stringify(previewTemplate.conditionRules, null, 2)
                          )
                          toast.success('Condition rules copied to clipboard')
                        }}
                      >
                        <Copy className="h-3 w-3" />
                        Copy
                      </button>
                    </div>
                    <pre className="text-[11px] font-mono bg-muted/50 rounded-md p-3 overflow-x-auto leading-relaxed text-foreground/90">
                      {JSON.stringify(previewTemplate.conditionRules, null, 2)}
                    </pre>
                  </div>

                  {/* Tags */}
                  <div className="rounded-lg border border-border/50 p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
                      Tags
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {previewTemplate.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-muted/80 text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Priority */}
                  <div className="rounded-lg border border-border/50 p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                      Priority
                    </p>
                    <p className="text-sm font-bold font-mono tabular-nums">
                      {previewTemplate.priority}
                    </p>
                  </div>
                </div>
              </ScrollArea>

              <DialogFooter className="pt-2 border-t">
                {isTemplateImported(previewTemplate.id) ? (
                  <Button
                    disabled
                    className="flex-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5"
                    variant="outline"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Already Imported
                  </Button>
                ) : (
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98] transition-transform"
                    onClick={() => handleImport(previewTemplate)}
                    disabled={importMutation.isPending}
                  >
                    {importMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Import This Template
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
