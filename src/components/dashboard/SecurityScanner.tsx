'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ScanSearch,
  ShieldX,
  AlertTriangle,
  Info,
  ShieldCheck,
  Play,
  Clock,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  ChevronRight,
  Loader2,
  Wrench,
  Zap,
  Lock,
  Unlock,
  Shield,
  RefreshCw,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type ScanStatus = 'Idle' | 'Scanning' | 'Complete'
type Severity = 'Critical' | 'Warning' | 'Info'
type VulnCategory = 'Authentication' | 'Authorization' | 'Data Protection' | 'Network' | 'Configuration' | 'Compliance'
type VulnStatus = 'Open' | 'Acknowledged' | 'Fixed'
type Priority = 'High' | 'Medium' | 'Low'
type Complexity = 'Easy' | 'Medium' | 'Hard'
type MatrixStatus = 'secured' | 'partial' | 'vulnerable'

interface Vulnerability {
  id: string
  severity: Severity
  category: VulnCategory
  title: string
  description: string
  affectedPolicies: number
  status: VulnStatus
  remediation: string[]
}

interface Recommendation {
  id: string
  priority: Priority
  description: string
  impact: string
  riskReduction: number
  complexity: Complexity
}

interface ScanResult {
  id: string
  timestamp: Date
  duration: number
  score: number
  previousScore: number
  vulnerabilities: Vulnerability[]
  recommendations: Recommendation[]
  critical: number
  warnings: number
  info: number
  passed: number
}

interface MatrixCell {
  status: MatrixStatus
  details: string
  policies: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AGENT_ROLES = ['DataAgent', 'CodeAgent', 'FinanceAgent', 'SupportAgent'] as const
const SECURITY_DOMAINS = ['Authentication', 'Authorization', 'Data Protection', 'Network', 'Configuration'] as const

const SEVERITY_CONFIG: Record<Severity, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
  Critical: {
    bg: 'bg-red-500/10',
    text: 'text-red-600 dark:text-red-400',
    border: 'border-red-500/30',
    icon: <ShieldX className="h-3 w-3" />,
  },
  Warning: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/30',
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  Info: {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-600 dark:text-cyan-400',
    border: 'border-cyan-500/30',
    icon: <Info className="h-3 w-3" />,
  },
}

const STATUS_CONFIG: Record<VulnStatus, { bg: string; text: string }> = {
  Open: { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400' },
  Acknowledged: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400' },
  Fixed: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
}

const PRIORITY_CONFIG: Record<Priority, { bg: string; text: string; border: string }> = {
  High: { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/30' },
  Medium: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30' },
  Low: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30' },
}

const COMPLEXITY_CONFIG: Record<Complexity, { text: string; stars: number }> = {
  Easy: { text: 'text-emerald-600 dark:text-emerald-400', stars: 1 },
  Medium: { text: 'text-amber-600 dark:text-amber-400', stars: 2 },
  Hard: { text: 'text-red-600 dark:text-red-400', stars: 3 },
}

const MATRIX_COLORS: Record<MatrixStatus, string> = {
  secured: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
  partial: 'bg-amber-500/20 border-amber-500/40 text-amber-700 dark:text-amber-300',
  vulnerable: 'bg-red-500/20 border-red-500/40 text-red-700 dark:text-red-300',
}

const VULN_TEMPLATES: Array<{
  severity: Severity
  category: VulnCategory
  title: string
  description: string
  remediation: string[]
  affectedPolicies: number
}> = [
  {
    severity: 'Critical',
    category: 'Authentication',
    title: 'Weak Authentication Policy for DataAgent',
    description: 'DataAgent lacks multi-factor authentication requirement for PostgreSQL access, allowing potential credential reuse attacks.',
    remediation: ['Enable MFA for DataAgent PostgreSQL access', 'Add REQUIRE_APPROVAL for write operations', 'Implement session timeout policies'],
    affectedPolicies: 3,
  },
  {
    severity: 'Critical',
    category: 'Authorization',
    title: 'Excessive Permissions on FinanceAgent',
    description: 'FinanceAgent has blanket ALLOW for all Stripe operations including refunds and cancellations without approval gates.',
    remediation: ['Restrict FinanceAgent to charge-only operations', 'Add REQUIRE_APPROVAL for refunds > $500', 'Implement role-based amount limits'],
    affectedPolicies: 2,
  },
  {
    severity: 'Critical',
    category: 'Data Protection',
    title: 'Unencrypted Data Transfer Path',
    description: 'CodeAgent → GitHub data channel lacks TLS enforcement, exposing code and commit data to interception.',
    remediation: ['Enforce HTTPS for all GitHub API calls', 'Add network-level TLS policy', 'Enable certificate pinning'],
    affectedPolicies: 4,
  },
  {
    severity: 'Critical',
    category: 'Network',
    title: 'Open Egress Rules for SupportAgent',
    description: 'SupportAgent EmailAPI connection has no network segmentation, allowing potential data exfiltration via email.',
    remediation: ['Add network segmentation policy', 'Implement DLP scanning for outbound emails', 'Restrict email recipient domains'],
    affectedPolicies: 2,
  },
  {
    severity: 'Warning',
    category: 'Configuration',
    title: 'Missing Rate Limiting on API Calls',
    description: 'No rate limiting policies defined for DataAgent PostgreSQL queries, risking resource exhaustion attacks.',
    remediation: ['Implement query rate limiting', 'Add connection pool size limits', 'Set maximum query execution time'],
    affectedPolicies: 1,
  },
  {
    severity: 'Warning',
    category: 'Authorization',
    title: 'Overly Broad Resource Access Pattern',
    description: 'CodeAgent GitHub policy uses wildcard resource matching, granting access to unintended repositories.',
    remediation: ['Replace wildcard with explicit repository list', 'Add repository-level access controls', 'Implement namespace restrictions'],
    affectedPolicies: 3,
  },
  {
    severity: 'Warning',
    category: 'Data Protection',
    description: 'PII fields in PostgreSQL query results are not masked, exposing sensitive user data to agent processing.',
    title: 'Insufficient Data Masking Rules',
    remediation: ['Add column-level masking policies', 'Implement dynamic data redaction', 'Create PII detection and filtering rules'],
    affectedPolicies: 2,
  },
  {
    severity: 'Warning',
    category: 'Compliance',
    title: 'Audit Log Gap for Approval Actions',
    description: 'Approval resolution events are not consistently logged, creating compliance gaps in audit trails.',
    remediation: ['Add mandatory audit logging for all approval events', 'Implement immutable audit trail', 'Add automated compliance checks'],
    affectedPolicies: 1,
  },
  {
    severity: 'Warning',
    category: 'Network',
    title: 'No Intrusion Detection for Kubernetes',
    description: 'SupportAgent Kubernetes access lacks IDS monitoring, potentially allowing container escape attempts.',
    remediation: ['Deploy IDS for Kubernetes API', 'Add container runtime monitoring', 'Implement pod security policies'],
    affectedPolicies: 2,
  },
  {
    severity: 'Warning',
    category: 'Authentication',
    title: 'Token Expiration Too Long',
    description: 'FinanceAgent authentication tokens have a 24-hour expiry, exceeding security best practices of 4 hours.',
    remediation: ['Reduce token expiry to 4 hours', 'Implement token rotation policy', 'Add refresh token validation'],
    affectedPolicies: 1,
  },
  {
    severity: 'Info',
    category: 'Configuration',
    title: 'Default Priority Values Not Optimized',
    description: 'Several policies share the same priority value (10), which may cause unpredictable evaluation ordering.',
    remediation: ['Assign unique priority values to each policy', 'Implement priority conflict detection', 'Document priority assignment strategy'],
    affectedPolicies: 5,
  },
  {
    severity: 'Info',
    category: 'Compliance',
    title: 'Policy Documentation Missing',
    description: '3 active policies lack description fields, reducing operational clarity and audit readiness.',
    remediation: ['Add descriptions to all policies', 'Create policy documentation template', 'Implement mandatory description validation'],
    affectedPolicies: 3,
  },
  {
    severity: 'Info',
    category: 'Data Protection',
    title: 'Backup Policy Not Defined',
    description: 'No policy-defined backup verification procedures for critical DataAgent operations.',
    remediation: ['Define backup verification policy', 'Add automated backup integrity checks', 'Schedule periodic backup restoration tests'],
    affectedPolicies: 1,
  },
  {
    severity: 'Info',
    category: 'Network',
    title: 'DNS Resolution Logging Disabled',
    description: 'DNS query logging is not enabled for Kubernetes-related network operations, reducing visibility.',
    remediation: ['Enable DNS query logging', 'Add DNS anomaly detection', 'Implement DNS security extensions'],
    affectedPolicies: 1,
  },
  {
    severity: 'Info',
    category: 'Authentication',
    title: 'SSH Key Rotation Not Enforced',
    description: 'CodeAgent GitHub SSH keys have no forced rotation schedule, creating long-lived credential risk.',
    remediation: ['Enforce 90-day SSH key rotation', 'Add key age monitoring alerts', 'Implement automated key provisioning'],
    affectedPolicies: 2,
  },
]

const REC_TEMPLATES: Array<{
  priority: Priority
  description: string
  impact: string
  riskReduction: number
  complexity: Complexity
}> = [
  { priority: 'High', description: 'Implement multi-factor authentication for all agent roles accessing sensitive resources', impact: 'Reduces credential compromise risk by 80%', riskReduction: 25, complexity: 'Medium' },
  { priority: 'High', description: 'Add REQUIRE_APPROVAL gates for all financial transactions exceeding $1000', impact: 'Prevents unauthorized large transactions', riskReduction: 20, complexity: 'Easy' },
  { priority: 'High', description: 'Enable network segmentation between agent workloads and sensitive databases', impact: 'Contains potential breach to isolated zones', riskReduction: 18, complexity: 'Hard' },
  { priority: 'Medium', description: 'Replace wildcard resource patterns with explicit allow-lists in all policies', impact: 'Eliminates unintended access to resources', riskReduction: 12, complexity: 'Easy' },
  { priority: 'Medium', description: 'Implement column-level data masking for PII fields in PostgreSQL queries', impact: 'Protects sensitive user data from exposure', riskReduction: 10, complexity: 'Medium' },
  { priority: 'Medium', description: 'Add rate limiting policies for all external API calls', impact: 'Prevents resource exhaustion and abuse', riskReduction: 8, complexity: 'Easy' },
  { priority: 'Low', description: 'Add descriptions and documentation to all active policies', impact: 'Improves operational clarity and audit readiness', riskReduction: 3, complexity: 'Easy' },
  { priority: 'Low', description: 'Assign unique priority values to resolve ordering conflicts', impact: 'Ensures predictable policy evaluation', riskReduction: 2, complexity: 'Easy' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSecurityGrade(score: number): string {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 55) return 'D'
  return 'F'
}

function getScoreColor(score: number): string {
  if (score > 70) return '#10b981'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

let scanIdCounter = 0

function generateScanResult(previousScore?: number): ScanResult {
  const vulnCount = randomInt(8, 15)
  const selectedVulns = shuffleArray(VULN_TEMPLATES).slice(0, vulnCount)
  const vulns: Vulnerability[] = selectedVulns.map((v, i) => ({
    id: `vuln-${++scanIdCounter}-${i}`,
    severity: v.severity,
    category: v.category,
    title: v.title,
    description: v.description,
    affectedPolicies: v.affectedPolicies,
    status: Math.random() < 0.15 ? 'Acknowledged' : Math.random() < 0.05 ? 'Fixed' : 'Open',
    remediation: v.remediation,
  }))

  const criticalCount = vulns.filter((v) => v.severity === 'Critical').length
  const warningCount = vulns.filter((v) => v.severity === 'Warning').length
  const infoCount = vulns.filter((v) => v.severity === 'Info').length
  const passedChecks = randomInt(12, 25)
  const rawScore = 100 - criticalCount * 12 - warningCount * 5 - infoCount * 2
  const score = Math.max(0, Math.min(100, rawScore))
  const prevScore = previousScore ?? Math.max(0, Math.min(100, score + randomInt(-15, 10)))

  const recCount = randomInt(4, 8)
  const selectedRecs = shuffleArray(REC_TEMPLATES).slice(0, recCount)
  const recs: Recommendation[] = selectedRecs.map((r, i) => ({
    id: `rec-${++scanIdCounter}-${i}`,
    ...r,
  }))

  return {
    id: `scan-${++scanIdCounter}`,
    timestamp: new Date(),
    duration: randomInt(2, 4),
    score,
    previousScore: prevScore,
    vulnerabilities: vulns,
    recommendations: recs,
    critical: criticalCount,
    warnings: warningCount,
    info: infoCount,
    passed: passedChecks,
  }
}

// ─── Security Score Gauge ─────────────────────────────────────────────────────

function SecurityScoreGauge({ score, previousScore }: { score: number; previousScore: number }) {
  const color = getScoreColor(score)
  const grade = getSecurityGrade(score)
  const delta = score - previousScore
  const displayScore = Math.round(score)

  return (
    <div className="flex flex-col items-center">
      <svg width="200" height="110" viewBox="0 0 200 110" className="gauge-glow">
        {/* Background arc */}
        <path
          d="M 25 100 A 75 75 0 0 1 175 100"
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.08}
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Colored arc */}
        <path
          d="M 25 100 A 75 75 0 0 1 175 100"
          fill="none"
          stroke={color}
          strokeOpacity={0.8}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${displayScore * 2.356} 235.6`}
        />
        {/* Tick marks */}
        {[25, 50, 75, 100].map((pct) => {
          const angle = Math.PI - (pct / 100) * Math.PI
          const cx = 100
          const cy = 100
          const outerR = 85
          const innerR = 78
          const x1 = cx + innerR * Math.cos(angle)
          const y1 = cy - innerR * Math.sin(angle)
          const x2 = cx + outerR * Math.cos(angle)
          const y2 = cy - outerR * Math.sin(angle)
          return (
            <line
              key={pct}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="currentColor"
              strokeOpacity={0.2}
              strokeWidth={1.5}
            />
          )
        })}
        {/* Score number */}
        <text
          x="100"
          y="78"
          textAnchor="middle"
          className="fill-foreground text-2xl font-bold tabular-nums"
          style={{ fontSize: '28px' }}
        >
          {displayScore}
        </text>
        {/* Grade label */}
        <text
          x="100"
          y="98"
          textAnchor="middle"
          className="fill-muted-foreground text-[10px]"
        >
          Security Grade: {grade}
        </text>
      </svg>
      {/* Delta comparison */}
      <div className="flex items-center gap-1.5 text-xs mt-1">
        {delta > 0 ? (
          <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
        ) : delta < 0 ? (
          <TrendingDown className="h-3.5 w-3.5 text-red-500" />
        ) : (
          <span className="h-3.5 w-3.5 flex items-center justify-center text-muted-foreground">—</span>
        )}
        <span
          className={`font-mono tabular-nums font-medium ${
            delta > 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : delta < 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-muted-foreground'
          }`}
        >
          {delta > 0 ? '+' : ''}
          {delta} vs previous
        </span>
      </div>
    </div>
  )
}

// ─── SVG Sparkline ────────────────────────────────────────────────────────────

function Sparkline({ data, width = 80, height = 24, color = '#10b981' }: { data: number[]; width?: number; height?: number; color?: string }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const padding = 2

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2)
    const y = padding + (1 - (v - min) / range) * (height - padding * 2)
    return `${x},${y}`
  })

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SecurityScanner() {
  // Scan state
  const [scanStatus, setScanStatus] = useState<ScanStatus>('Idle')
  const [scanProgress, setScanProgress] = useState(0)
  const [currentResult, setCurrentResult] = useState<ScanResult | null>(null)
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([])
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null)
  const [scanDuration, setScanDuration] = useState<number>(0)

  // Filter state
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  // Dialog state
  const [fixDialogVuln, setFixDialogVuln] = useState<Vulnerability | null>(null)
  const [applyDialogRec, setApplyDialogRec] = useState<Recommendation | null>(null)
  const [confirmApplyOpen, setConfirmApplyOpen] = useState(false)

  // Matrix cell detail
  const [matrixCellDetail, setMatrixCellDetail] = useState<{
    role: string
    domain: string
    cell: MatrixCell
  } | null>(null)

  // History view
  const [selectedHistoryScan, setSelectedHistoryScan] = useState<ScanResult | null>(null)

  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Run scan simulation
  const runScan = useCallback((isQuick: boolean) => {
    if (scanStatus === 'Scanning') return

    setScanStatus('Scanning')
    setScanProgress(0)

    const totalSteps = isQuick ? 5 : 10
    const stepDuration = isQuick ? 150 : 250
    let step = 0

    const progressInterval = setInterval(() => {
      step++
      const progress = Math.min(Math.round((step / totalSteps) * 100), 100)
      setScanProgress(progress)

      if (step >= totalSteps) {
        clearInterval(progressInterval)

        const prevScore = currentResult?.score
        const result = generateScanResult(prevScore)

        // Ensure quick scans find fewer issues
        if (isQuick) {
          const quickVulns = result.vulnerabilities.slice(0, randomInt(4, 7))
          result.vulnerabilities = quickVulns
          result.critical = quickVulns.filter((v) => v.severity === 'Critical').length
          result.warnings = quickVulns.filter((v) => v.severity === 'Warning').length
          result.info = quickVulns.filter((v) => v.severity === 'Info').length
          result.score = Math.max(0, Math.min(100, 100 - result.critical * 12 - result.warnings * 5 - result.info * 2))
        }

        result.duration = isQuick ? randomInt(1, 2) : randomInt(2, 4)

        setCurrentResult(result)
        setScanHistory((prev) => [result, ...prev].slice(0, 5))
        setLastScanTime(new Date())
        setScanDuration(result.duration)
        setScanStatus('Complete')
      }
    }, stepDuration)
  }, [scanStatus, currentResult])

  // Cleanup
  useEffect(() => {
    return () => {
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current)
    }
  }, [])

  // Filtered vulnerabilities
  const filteredVulns = useMemo(() => {
    if (!currentResult) return []
    return currentResult.vulnerabilities.filter((v) => {
      if (severityFilter !== 'all' && v.severity !== severityFilter) return false
      if (categoryFilter !== 'all' && v.category !== categoryFilter) return false
      return true
    })
  }, [currentResult, severityFilter, categoryFilter])

  // Security matrix data
  const securityMatrix = useMemo(() => {
    const matrix: Record<string, Record<string, MatrixCell>> = {}
    for (const role of AGENT_ROLES) {
      matrix[role] = {}
      for (const domain of SECURITY_DOMAINS) {
        const hasCritical = currentResult?.vulnerabilities.some(
          (v) => v.severity === 'Critical' && v.category === domain && currentResult.vulnerabilities.some((vv) => vv.title.includes(role))
        )
        const hasWarning = currentResult?.vulnerabilities.some(
          (v) => v.severity === 'Warning' && v.category === domain
        )
        const hasAny = currentResult?.vulnerabilities.some(
          (v) => v.category === domain
        )

        let status: MatrixStatus = 'secured'
        let details = 'All checks passed'
        let policies = randomInt(2, 5)

        if (hasCritical) {
          status = 'vulnerable'
          details = 'Critical vulnerabilities found'
          policies = randomInt(0, 1)
        } else if (hasWarning) {
          status = 'partial'
          details = 'Warnings detected — partial coverage'
          policies = randomInt(1, 3)
        } else if (hasAny) {
          status = 'partial'
          details = 'Info items — review recommended'
          policies = randomInt(2, 4)
        }

        matrix[role][domain] = { status, details, policies }
      }
    }
    return matrix
  }, [currentResult])

  // History sparkline data
  const historyScores = useMemo(() => {
    return [...scanHistory].reverse().map((s) => s.score)
  }, [scanHistory])

  // Display result (current or selected history)
  const displayResult = selectedHistoryScan ?? currentResult

  // Unique categories for filter
  const vulnCategories = useMemo(() => {
    if (!currentResult) return []
    return Array.from(new Set(currentResult.vulnerabilities.map((v) => v.category)))
  }, [currentResult])

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 relative">
      {/* Dot grid background */}
      <div className="absolute inset-0 dot-grid opacity-30 pointer-events-none rounded-xl" />

      {/* ═══ 1. Section Header ═══ */}
      <div className="section-header-gradient section-header-accent rounded-xl px-4 py-3 -mx-4 -mt-2 md:-mx-6 md:-mt-4 mb-2 relative overflow-hidden">
        <h2 className="text-lg font-bold tracking-tight flex items-center gap-2 gradient-text-shimmer">
          <ScanSearch className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          Security Scanner
        </h2>
        <p className="text-sm text-muted-foreground">
          Scan policy configurations for vulnerabilities and security recommendations
        </p>
      </div>

      {/* ═══ 2. Scan Control Panel ═══ */}
      <Card className="glass-card glow-hover">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            {/* Scan Buttons */}
            <div className="flex items-center gap-3">
              <Button
                className="h-10 px-6 text-sm font-medium bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white active:scale-[0.98] transition-transform"
                onClick={() => runScan(false)}
                disabled={scanStatus === 'Scanning'}
              >
                {scanStatus === 'Scanning' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ScanSearch className="h-4 w-4 mr-2" />
                )}
                Run Full Scan
              </Button>
              <Button
                variant="outline"
                className="h-10 px-4 text-sm active:scale-[0.98] transition-transform"
                onClick={() => runScan(true)}
                disabled={scanStatus === 'Scanning'}
              >
                <Zap className="h-4 w-4 mr-2" />
                Quick Scan
              </Button>
            </div>

            {/* Progress Bar */}
            <div className="flex-1 space-y-1.5">
              {scanStatus === 'Scanning' && (
                <div className="relative">
                  <Progress value={scanProgress} className="h-3" />
                  <div className="absolute inset-0 progress-animated rounded-full" style={{ clipPath: `inset(0 ${100 - scanProgress}% 0 0)` }} />
                </div>
              )}
              {scanStatus !== 'Scanning' && (
                <div className="h-3 bg-muted/30 rounded-full" />
              )}
            </div>

            {/* Status Info */}
            <div className="flex items-center gap-4 text-xs shrink-0">
              {/* Scan Status Indicator */}
              <div className="flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${
                    scanStatus === 'Idle'
                      ? 'bg-gray-400'
                      : scanStatus === 'Scanning'
                        ? 'bg-amber-500 animate-pulse'
                        : 'bg-emerald-500'
                  }`}
                />
                <span className="text-muted-foreground font-medium">{scanStatus}</span>
              </div>

              {/* Last Scan Time */}
              {lastScanTime && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span className="font-mono tabular-nums">{formatRelativeTime(lastScanTime)}</span>
                </div>
              )}

              {/* Duration */}
              {scanDuration > 0 && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <RefreshCw className="h-3 w-3" />
                  <span className="font-mono tabular-nums">{scanDuration}s</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ 3. Security Score + Vulnerability Summary Row ═══ */}
      {displayResult && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-6">
          {/* Security Score Gauge */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
            className="md:col-span-1"
          >
            <Card className="glass-card glow-hover h-full">
              <CardContent className="p-4 md:p-6 flex flex-col items-center justify-center">
                <SecurityScoreGauge score={displayResult.score} previousScore={displayResult.previousScore} />
              </CardContent>
            </Card>
          </motion.div>

          {/* Vulnerability Summary Cards */}
          <div className="md:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {/* Critical */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <Card className="glass-card glow-hover">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-lg bg-red-500/10">
                      <ShieldX className="h-4 w-4 text-red-500" />
                    </div>
                    <div className="flex items-center gap-0.5 text-xs font-medium text-red-500">
                      <TrendingUp className="h-3 w-3" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-red-600 dark:text-red-400">
                    {displayResult.critical}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Critical Issues</div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Warnings */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="glass-card glow-hover">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    </div>
                    <div className="flex items-center gap-0.5 text-xs font-medium text-amber-500">
                      <TrendingDown className="h-3 w-3" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
                    {displayResult.warnings}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Warnings</div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Info */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Card className="glass-card glow-hover">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-lg bg-cyan-500/10">
                      <Info className="h-4 w-4 text-cyan-500" />
                    </div>
                    <div className="flex items-center gap-0.5 text-xs font-medium text-cyan-500">
                      <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-cyan-600 dark:text-cyan-400">
                    {displayResult.info}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Info Items</div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Passed */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="glass-card glow-hover">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-lg bg-emerald-500/10">
                      <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div className="flex items-center gap-0.5 text-xs font-medium text-emerald-500">
                      <TrendingUp className="h-3 w-3" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                    {displayResult.passed}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Passed Checks</div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      )}

      {/* ═══ 5. Vulnerability List ═══ */}
      {displayResult && (
        <Card className="glass-card glow-hover">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShieldX className="h-4 w-4 text-red-600 dark:text-red-400" />
                Vulnerability List
                <Badge variant="outline" className="font-mono tabular-nums">
                  {filteredVulns.length}
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="h-7 w-[130px] text-xs">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severity</SelectItem>
                    <SelectItem value="Critical">Critical</SelectItem>
                    <SelectItem value="Warning">Warning</SelectItem>
                    <SelectItem value="Info">Info</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-7 w-[150px] text-xs">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {vulnCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredVulns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm">
                <ShieldCheck className="h-8 w-8 mb-2 opacity-40" />
                <p className="font-medium">No vulnerabilities found</p>
                <p className="text-xs mt-1">Run a scan to detect security issues</p>
              </div>
            ) : (
              <ScrollArea className="max-h-96">
                <div className="space-y-1.5">
                  <AnimatePresence>
                    {filteredVulns.map((vuln, i) => (
                      <motion.div
                        key={vuln.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i * 0.03, 0.5) }}
                        className="table-row-hover flex items-center gap-2 py-2.5 px-3 rounded-lg hover:bg-muted/30 transition-colors duration-200 group"
                      >
                        {/* Severity Badge */}
                        <Badge
                          variant="outline"
                          className={`shrink-0 transition-transform duration-150 hover:scale-105 ${SEVERITY_CONFIG[vuln.severity].bg} ${SEVERITY_CONFIG[vuln.severity].text} ${SEVERITY_CONFIG[vuln.severity].border}`}
                        >
                          {SEVERITY_CONFIG[vuln.severity].icon}
                          <span className="ml-1 text-[10px]">{vuln.severity}</span>
                        </Badge>

                        {/* Category */}
                        <Badge variant="outline" className="shrink-0 text-[10px] text-muted-foreground">
                          {vuln.category}
                        </Badge>

                        {/* Title & Description */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{vuln.title}</p>
                          <p className="text-[10px] text-muted-foreground truncate max-w-[300px]">{vuln.description}</p>
                        </div>

                        {/* Affected Policies */}
                        <span className="text-[10px] text-muted-foreground font-mono tabular-nums shrink-0">
                          {vuln.affectedPolicies} polic{vuln.affectedPolicies !== 1 ? 'ies' : 'y'}
                        </span>

                        {/* Status */}
                        <Badge
                          variant="outline"
                          className={`shrink-0 text-[10px] ${STATUS_CONFIG[vuln.status].bg} ${STATUS_CONFIG[vuln.status].text}`}
                        >
                          {vuln.status}
                        </Badge>

                        {/* Fix Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] shrink-0 active:scale-[0.98] transition-transform"
                          onClick={() => setFixDialogVuln(vuln)}
                        >
                          <Wrench className="h-3 w-3 mr-1" />
                          Fix
                        </Button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══ 6. Security Recommendations ═══ */}
      {displayResult && (
        <Card className="glass-card glow-hover">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Security Recommendations
              <Badge variant="outline" className="font-mono tabular-nums">
                {displayResult.recommendations.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-80">
              <div className="space-y-2">
                <AnimatePresence>
                  {displayResult.recommendations.map((rec, i) => (
                    <motion.div
                      key={rec.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.04, 0.4) }}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors duration-200"
                    >
                      {/* Priority Badge */}
                      <Badge
                        variant="outline"
                        className={`shrink-0 text-[10px] mt-0.5 ${PRIORITY_CONFIG[rec.priority].bg} ${PRIORITY_CONFIG[rec.priority].text} ${PRIORITY_CONFIG[rec.priority].border}`}
                      >
                        {rec.priority}
                      </Badge>

                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-xs font-medium">{rec.description}</p>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3 text-emerald-500" />
                            <span className="font-mono tabular-nums">-{rec.riskReduction}%</span> risk
                          </span>
                          <span className="flex items-center gap-1">
                            {Array.from({ length: 3 }).map((_, si) => (
                              <span
                                key={si}
                                className={`inline-block h-1.5 w-1.5 rounded-full ${
                                  si < COMPLEXITY_CONFIG[rec.complexity].stars
                                    ? COMPLEXITY_CONFIG[rec.complexity].text.replace('text-', 'bg-').split(' ')[0].replace('bg-red', 'bg-red-500').replace('bg-amber', 'bg-amber-500').replace('bg-emerald', 'bg-emerald-500')
                                    : 'bg-muted-foreground/20'
                                }`}
                              />
                            ))}
                            <span className={COMPLEXITY_CONFIG[rec.complexity].text}>{rec.complexity}</span>
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground italic">{rec.impact}</p>
                      </div>

                      {/* Apply Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-3 text-[10px] shrink-0 active:scale-[0.98] transition-transform"
                        onClick={() => {
                          setApplyDialogRec(rec)
                          setConfirmApplyOpen(true)
                        }}
                      >
                        Apply
                      </Button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* ═══ 7. Policy Security Matrix ═══ */}
      <Card className="glass-card glow-hover">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Lock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Policy Security Matrix
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!displayResult ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-sm">
              <Lock className="h-8 w-8 mb-2 opacity-40" />
              <p className="font-medium">Run a scan to populate the matrix</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="text-left p-2 text-muted-foreground font-medium sticky left-0 bg-card">
                        Agent / Domain
                      </th>
                      {SECURITY_DOMAINS.map((domain) => (
                        <th key={domain} className="p-2 text-muted-foreground font-medium text-center">
                          {domain}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {AGENT_ROLES.map((role) => (
                      <tr key={role} className="border-t border-border">
                        <td className="p-2 font-medium sticky left-0 bg-card">{role}</td>
                        {SECURITY_DOMAINS.map((domain) => {
                          const cell = securityMatrix[role]?.[domain]
                          if (!cell) return <td key={domain} className="p-1.5 text-center" />
                          return (
                            <td key={domain} className="p-1.5 text-center">
                              <button
                                type="button"
                                className={`inline-flex items-center justify-center min-w-[60px] px-2 py-1.5 rounded-md text-[10px] font-semibold border transition-all duration-150 hover:scale-105 ${MATRIX_COLORS[cell.status]}`}
                                onClick={() => setMatrixCellDetail({ role, domain, cell })}
                              >
                                {cell.status === 'secured'
                                  ? '✓ Secured'
                                  : cell.status === 'partial'
                                    ? '◐ Partial'
                                    : '✗ Vulnerable'}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Legend */}
              <div className="flex items-center gap-4 mt-4 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded bg-emerald-500/40" /> Secured
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded bg-amber-500/40" /> Partial
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded bg-red-500/40" /> Vulnerable
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ═══ 8. Scan History ═══ */}
      <Card className="glass-card glow-hover">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Scan History
            <Badge variant="outline" className="font-mono tabular-nums">
              {scanHistory.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {scanHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-sm">
              <Clock className="h-8 w-8 mb-2 opacity-40" />
              <p className="font-medium">No scans yet</p>
              <p className="text-xs mt-1">Run your first scan to see history</p>
            </div>
          ) : (
            <div className="space-y-0">
              {/* Score Trend Sparkline */}
              {historyScores.length >= 2 && (
                <div className="flex items-center gap-3 mb-4 px-3">
                  <span className="text-[10px] text-muted-foreground font-medium shrink-0">Score Trend</span>
                  <Sparkline
                    data={historyScores}
                    width={120}
                    height={28}
                    color={getScoreColor(historyScores[historyScores.length - 1] ?? 50)}
                  />
                </div>
              )}

              {/* Timeline */}
              <ScrollArea className="max-h-72">
                <div className="space-y-0">
                  <AnimatePresence>
                    {scanHistory.map((scan, i) => {
                      const isSelected = selectedHistoryScan?.id === scan.id
                      return (
                        <motion.button
                          key={scan.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs transition-colors duration-200 text-left ${
                            isSelected
                              ? 'bg-emerald-500/10 border border-emerald-500/30'
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => setSelectedHistoryScan(isSelected ? null : scan)}
                        >
                          {/* Timeline dot */}
                          <div className="relative flex flex-col items-center">
                            <span
                              className={`h-3 w-3 rounded-full border-2 ${
                                scan.score > 70
                                  ? 'border-emerald-500 bg-emerald-500/30'
                                  : scan.score >= 40
                                    ? 'border-amber-500 bg-amber-500/30'
                                    : 'border-red-500 bg-red-500/30'
                              }`}
                            />
                            {i < scanHistory.length - 1 && (
                              <span className="w-0.5 h-4 bg-border mt-1" />
                            )}
                          </div>

                          {/* Date */}
                          <span className="text-muted-foreground font-mono tabular-nums shrink-0 w-[78px]">
                            {scan.timestamp.toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                            {scan.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>

                          {/* Score */}
                          <span
                            className={`font-bold font-mono tabular-nums w-8 text-center ${
                              scan.score > 70
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : scan.score >= 40
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {scan.score}
                          </span>

                          {/* Issues */}
                          <span className="text-muted-foreground shrink-0">
                            {scan.critical + scan.warnings + scan.info} issues
                          </span>

                          {/* Duration */}
                          <span className="text-muted-foreground font-mono tabular-nums shrink-0">
                            {scan.duration}s
                          </span>

                          {/* Mini sparkline for this scan */}
                          <div className="ml-auto shrink-0">
                            <Sparkline
                              data={[scan.previousScore, scan.score]}
                              width={32}
                              height={14}
                              color={scan.score >= scan.previousScore ? '#10b981' : '#ef4444'}
                            />
                          </div>

                          {/* View indicator */}
                          {isSelected && (
                            <ChevronRight className="h-3 w-3 text-emerald-500 shrink-0" />
                          )}
                        </motion.button>
                      )
                    })}
                  </AnimatePresence>
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ Fix Dialog ═══ */}
      <Dialog open={!!fixDialogVuln} onOpenChange={(open) => !open && setFixDialogVuln(null)}>
        <DialogContent className="dialog-fullscreen-mobile max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Wrench className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Remediation Steps
            </DialogTitle>
          </DialogHeader>
          {fixDialogVuln && (
            <div className="space-y-4">
              {/* Vuln Header */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`${SEVERITY_CONFIG[fixDialogVuln.severity].bg} ${SEVERITY_CONFIG[fixDialogVuln.severity].text} ${SEVERITY_CONFIG[fixDialogVuln.severity].border}`}
                  >
                    {SEVERITY_CONFIG[fixDialogVuln.severity].icon}
                    <span className="ml-1">{fixDialogVuln.severity}</span>
                  </Badge>
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    {fixDialogVuln.category}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${STATUS_CONFIG[fixDialogVuln.status].bg} ${STATUS_CONFIG[fixDialogVuln.status].text}`}
                  >
                    {fixDialogVuln.status}
                  </Badge>
                </div>
                <h3 className="text-sm font-semibold">{fixDialogVuln.title}</h3>
                <p className="text-xs text-muted-foreground">{fixDialogVuln.description}</p>
              </div>

              <Separator />

              {/* Remediation Steps */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Steps to Fix:</p>
                <ol className="space-y-2">
                  {fixDialogVuln.remediation.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <span className="flex items-center justify-center h-5 w-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-muted-foreground pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Affected Policies */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Shield className="h-3 w-3" />
                <span>
                  Affects <span className="font-mono tabular-nums font-medium">{fixDialogVuln.affectedPolicies}</span> polic{fixDialogVuln.affectedPolicies !== 1 ? 'ies' : 'y'}
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="active:scale-[0.98] transition-transform"
              onClick={() => setFixDialogVuln(null)}
            >
              Close
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98] transition-transform"
              onClick={() => {
                if (fixDialogVuln) {
                  fixDialogVuln.status = 'Acknowledged'
                }
                setFixDialogVuln(null)
              }}
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1" />
              Acknowledge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Apply Recommendation Dialog ═══ */}
      <Dialog open={confirmApplyOpen} onOpenChange={setConfirmApplyOpen}>
        <DialogContent className="dialog-fullscreen-mobile max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Apply Recommendation
            </DialogTitle>
          </DialogHeader>
          {applyDialogRec && (
            <div className="space-y-3">
              <Badge
                variant="outline"
                className={`${PRIORITY_CONFIG[applyDialogRec.priority].bg} ${PRIORITY_CONFIG[applyDialogRec.priority].text} ${PRIORITY_CONFIG[applyDialogRec.priority].border}`}
              >
                {applyDialogRec.priority} Priority
              </Badge>
              <p className="text-sm">{applyDialogRec.description}</p>
              <Separator />
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Risk Reduction</span>
                  <p className="font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                    -{applyDialogRec.riskReduction}%
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Complexity</span>
                  <p className={`font-bold ${COMPLEXITY_CONFIG[applyDialogRec.complexity].text}`}>
                    {applyDialogRec.complexity}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground italic">{applyDialogRec.impact}</p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="active:scale-[0.98] transition-transform"
              onClick={() => setConfirmApplyOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98] transition-transform"
              onClick={() => setConfirmApplyOpen(false)}
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1" />
              Confirm Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Matrix Cell Detail Dialog ═══ */}
      <Dialog open={!!matrixCellDetail} onOpenChange={(open) => !open && setMatrixCellDetail(null)}>
        <DialogContent className="dialog-fullscreen-mobile max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Lock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Security Detail
            </DialogTitle>
          </DialogHeader>
          {matrixCellDetail && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{matrixCellDetail.role}</Badge>
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                <Badge variant="outline" className="text-xs">{matrixCellDetail.domain}</Badge>
              </div>
              <div className={`p-3 rounded-lg border ${MATRIX_COLORS[matrixCellDetail.cell.status]}`}>
                <p className="text-xs font-semibold capitalize">{matrixCellDetail.cell.status}</p>
                <p className="text-[10px] mt-1 opacity-80">{matrixCellDetail.cell.details}</p>
              </div>
              <div className="text-xs text-muted-foreground">
                <span className="font-mono tabular-nums">{matrixCellDetail.cell.policies}</span> active polic{matrixCellDetail.cell.policies !== 1 ? 'ies' : 'y'} covering this domain
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="active:scale-[0.98] transition-transform"
              onClick={() => setMatrixCellDetail(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Empty State (no scan yet) ═══ */}
      {!displayResult && scanStatus !== 'Scanning' && (
        <Card className="glass-card glow-hover">
          <CardContent className="py-16 flex flex-col items-center justify-center text-muted-foreground">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center"
            >
              <ScanSearch className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-lg font-semibold text-foreground">No Security Scan Yet</p>
              <p className="text-sm mt-1">Run a Full Scan or Quick Scan to detect vulnerabilities</p>
              <Button
                className="mt-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white active:scale-[0.98] transition-transform"
                onClick={() => runScan(false)}
              >
                <ScanSearch className="h-4 w-4 mr-2" />
                Run Your First Scan
              </Button>
            </motion.div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
