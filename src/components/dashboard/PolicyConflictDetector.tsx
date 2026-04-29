'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  GitMerge,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

interface Policy {
  policyId: string
  name: string
  agentRole: string
  resource: string
  action: string
  permissionLevel: string
  priority: number
  enabled: boolean
  conditionRules?: string | null
}

interface Conflict {
  type: 'contradiction' | 'overlap' | 'shadow'
  severity: 'high' | 'medium' | 'low'
  policy1: Policy
  policy2: Policy
  description: string
  recommendation: string
}

function getSeverityStyle(severity: string) {
  switch (severity) {
    case 'high': return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
    case 'medium': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
    case 'low': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
    default: return 'bg-muted text-muted-foreground border-border'
  }
}

function getConflictIcon(type: string) {
  switch (type) {
    case 'contradiction': return <ShieldAlert className="h-4 w-4 text-red-500" />
    case 'overlap': return <GitMerge className="h-4 w-4 text-amber-500" />
    case 'shadow': return <Shield className="h-4 w-4 text-blue-500" />
    default: return <Info className="h-4 w-4" />
  }
}

export function PolicyConflictDetector() {
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data: policies = [], isLoading } = useQuery<Policy[]>({
    queryKey: ['conflicts-policies'],
    queryFn: async () => {
      const res = await fetch('/api/policies')
      if (!res.ok) return []
      return res.json()
    },
  })

  // Detect conflicts
  const conflicts = useMemo((): Conflict[] => {
    const enabledPolicies = policies.filter(p => p.enabled)
    const found: Conflict[] = []

    for (let i = 0; i < enabledPolicies.length; i++) {
      for (let j = i + 1; j < enabledPolicies.length; j++) {
        const p1 = enabledPolicies[i]
        const p2 = enabledPolicies[j]

        // Same agent role + same resource = potential conflict
        if (p1.agentRole === p2.agentRole && p1.resource === p2.resource) {
          // Contradiction: Same scope, different decisions
          if (p1.permissionLevel !== p2.permissionLevel) {
            // Check if one shadows the other (higher priority wins)
            if (p1.priority !== p2.priority) {
              const higher = p1.priority > p2.priority ? p1 : p2
              const lower = p1.priority > p2.priority ? p2 : p1
              found.push({
                type: 'shadow',
                severity: 'low',
                policy1: higher,
                policy2: lower,
                description: `"${higher.name}" (P${higher.priority}) shadows "${lower.name}" (P${lower.priority}) for ${p1.agentRole} on ${p1.resource}`,
                recommendation: `Lower-priority policy "${lower.name}" will never apply. Consider disabling it or adjusting priority.`,
              })
            } else {
              // Same priority, different decisions = contradiction
              found.push({
                type: 'contradiction',
                severity: 'high',
                policy1: p1,
                policy2: p2,
                description: `Conflicting decisions for ${p1.agentRole} on ${p1.resource}: "${p1.name}" is ${p1.permissionLevel} while "${p2.name}" is ${p2.permissionLevel}`,
                recommendation: 'Resolve by adjusting priorities or scoping with condition rules to prevent non-deterministic behavior.',
              })
            }
          }

          // Overlap: Same scope, similar actions
          if (p1.action === p2.action || p1.action === '*' || p2.action === '*') {
            if (p1.permissionLevel === p2.permissionLevel && p1.priority !== p2.priority) {
              // Only add if not already detected as shadow
              const alreadyFound = found.some(
                c => (c.policy1.policyId === p1.policyId && c.policy2.policyId === p2.policyId) ||
                     (c.policy1.policyId === p2.policyId && c.policy2.policyId === p1.policyId)
              )
              if (!alreadyFound) {
                found.push({
                  type: 'overlap',
                  severity: 'medium',
                  policy1: p1,
                  policy2: p2,
                  description: `Overlapping policies for ${p1.agentRole} on ${p1.resource}: both "${p1.name}" and "${p2.name}" handle ${p1.action === '*' ? 'all actions' : p1.action}`,
                  recommendation: 'Consider merging these policies or using more specific condition rules to differentiate.',
                })
              }
            }
          }
        }
      }
    }

    return found.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 }
      return severityOrder[a.severity] - severityOrder[b.severity]
    })
  }, [policies])

  const highCount = conflicts.filter(c => c.severity === 'high').length
  const medCount = conflicts.filter(c => c.severity === 'medium').length
  const lowCount = conflicts.filter(c => c.severity === 'low').length
  const hasConflicts = conflicts.length > 0

  return (
    <Card className="border-0 shadow-sm glass-card glow-hover">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            {hasConflicts ? (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            ) : (
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
            )}
            Policy Conflict Detector
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {highCount > 0 && (
              <Badge variant="outline" className="text-[10px] h-5 bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
                {highCount} critical
              </Badge>
            )}
            {medCount > 0 && (
              <Badge variant="outline" className="text-[10px] h-5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                {medCount} warnings
              </Badge>
            )}
            {!hasConflicts && (
              <Badge variant="outline" className="text-[10px] h-5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                <CheckCircle2 className="h-3 w-3 mr-1" /> No conflicts
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : !hasConflicts ? (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <ShieldCheck className="h-10 w-10 mb-2 text-emerald-500/40" />
            <p className="text-sm font-medium">No policy conflicts detected</p>
            <p className="text-xs mt-1">All enabled policies are consistent and non-overlapping</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
            <AnimatePresence initial={false}>
              {conflicts.map((conflict, i) => (
                <motion.div
                  key={`${conflict.policy1.policyId}-${conflict.policy2.policyId}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <button
                    className="w-full text-left rounded-lg border border-border/50 p-3 hover:border-emerald-500/20 transition-colors duration-200"
                    onClick={() => setExpanded(expanded === `${i}` ? null : `${i}`)}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 shrink-0">{getConflictIcon(conflict.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={`text-[9px] h-4 px-1.5 ${getSeverityStyle(conflict.severity)}`}>
                            {conflict.severity}
                          </Badge>
                          <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-muted/50">
                            {conflict.type}
                          </Badge>
                        </div>
                        <p className="text-xs text-foreground leading-relaxed line-clamp-2">{conflict.description}</p>
                      </div>
                      <div className="shrink-0 mt-1">
                        {expanded === `${i}` ? (
                          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </button>

                  <AnimatePresence>
                    {expanded === `${i}` && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                      >
                        <div className="ml-6 mt-1 mb-2 p-3 rounded-md bg-muted/50 space-y-2">
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className="font-medium text-muted-foreground">Policy A:</span>
                            <Badge variant="outline" className={`text-[9px] h-4 ${
                              conflict.policy1.permissionLevel === 'ALLOW' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                              conflict.policy1.permissionLevel === 'BLOCK' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' :
                              'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                            }`}>
                              {conflict.policy1.permissionLevel}
                            </Badge>
                            <span className="text-muted-foreground truncate">{conflict.policy1.name}</span>
                            <span className="text-muted-foreground font-mono">P{conflict.policy1.priority}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className="font-medium text-muted-foreground">Policy B:</span>
                            <Badge variant="outline" className={`text-[9px] h-4 ${
                              conflict.policy2.permissionLevel === 'ALLOW' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                              conflict.policy2.permissionLevel === 'BLOCK' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' :
                              'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                            }`}>
                              {conflict.policy2.permissionLevel}
                            </Badge>
                            <span className="text-muted-foreground truncate">{conflict.policy2.name}</span>
                            <span className="text-muted-foreground font-mono">P{conflict.policy2.priority}</span>
                          </div>
                          <Separator />
                          <div className="text-[10px] text-muted-foreground">
                            <span className="font-medium text-foreground">Recommendation:</span> {conflict.recommendation}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Summary */}
        {hasConflicts && (
          <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-border/50">
            <span>Analyzed {policies.filter(p => p.enabled).length} enabled policies</span>
            <span>{conflicts.length} issue{conflicts.length !== 1 ? 's' : ''} found</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
