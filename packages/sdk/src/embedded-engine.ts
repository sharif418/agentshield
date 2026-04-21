/**
 * AgentShield Embedded Engine
 *
 * In-memory policy engine for embedded mode - no server needed.
 * Uses the core evaluation logic directly for zero-dependency operation.
 * Great for edge functions, serverless, or lightweight integrations.
 */

import type {
  PermissionLevel,
  PolicyDefinition,
  EvaluateInput,
  EvaluateResult,
  MatchedPolicy,
} from '@agentshield/core';
import { evaluatePolicies } from '@agentshield/core';
import type { PolicyCreateParams, PolicyListParams, Trace } from './types.js';

/**
 * Generate a unique ID with a given prefix.
 */
function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * In-memory policy engine - no server needed.
 * Uses the core evaluation logic directly.
 *
 * @example
 * ```typescript
 * const engine = new EmbeddedEngine([
 *   {
 *     policyId: 'POL-001',
 *     name: 'Block DROP TABLE',
 *     agentRole: 'DataAgent',
 *     resource: 'PostgreSQL',
 *     action: 'DROP',
 *     permissionLevel: 'BLOCK',
 *     priority: 20,
 *     enabled: true,
 *   },
 * ]);
 *
 * const result = engine.evaluate({
 *   agentRole: 'DataAgent',
 *   toolName: 'PostgreSQL',
 *   arguments: { query: 'DROP TABLE users' },
 * });
 * console.log(result.decision); // 'BLOCK'
 * ```
 */
export class EmbeddedEngine {
  private policies: Map<string, PolicyDefinition> = new Map();
  private traces: Trace[] = [];
  private zeroTrust: boolean;

  constructor(initialPolicies: PolicyDefinition[] = [], zeroTrust = true) {
    this.zeroTrust = zeroTrust;
    for (const policy of initialPolicies) {
      this.policies.set(policy.policyId, policy);
    }
  }

  /**
   * Evaluate a tool call against the in-memory policy store.
   * Uses the core evaluation engine directly - no HTTP calls.
   *
   * @param request - The evaluation request input
   * @returns The evaluation result with trace info
   */
  evaluate(request: EvaluateInput): EvaluateResult {
    const startTime = performance.now();
    const allPolicies = Array.from(this.policies.values());
    const result = evaluatePolicies(allPolicies, request, {
      zeroTrust: this.zeroTrust,
    });
    const latencyMs = performance.now() - startTime;

    // Generate a trace ID and store trace locally
    const traceId = generateId('TRC');
    const sessionId = request.sessionId ?? generateId('SES');

    const trace: Trace = {
      traceId,
      sessionId,
      agentRole: request.agentRole,
      toolName: request.toolName,
      intentPayload: JSON.stringify(request.arguments ?? {}),
      evaluationResult: result.decision,
      matchedPolicyId: result.matchedPolicy?.policyId ?? null,
      latency: parseFloat(latencyMs.toFixed(3)),
      timestamp: new Date(),
    };
    this.traces.unshift(trace);

    // Keep last 1000 traces
    if (this.traces.length > 1000) {
      this.traces = this.traces.slice(0, 1000);
    }

    // Generate approval request ID if needed
    let approvalRequestId: string | undefined;
    if (result.decision === 'REQUIRE_APPROVAL') {
      approvalRequestId = generateId('APR');
    }

    return {
      decision: result.decision,
      traceId,
      matchedPolicy: result.matchedPolicy,
      reason: result.reason,
      action: result.action,
      latency: latencyMs,
      approvalRequestId,
    };
  }

  /**
   * Create a new policy and add it to the in-memory store.
   *
   * @param params - Policy creation parameters
   * @returns The created policy definition
   */
  createPolicy(params: PolicyCreateParams): PolicyDefinition {
    const policyId = params.policyId ?? generateId('POL');
    const policy: PolicyDefinition = {
      policyId,
      name: params.name,
      description: params.description,
      agentRole: params.agentRole,
      resource: params.resource,
      action: params.action,
      permissionLevel: params.permissionLevel,
      conditionRules: params.conditionRules as PolicyDefinition['conditionRules'] ?? undefined,
      priority: params.priority ?? 0,
      enabled: params.enabled ?? true,
    };
    this.policies.set(policyId, policy);
    return policy;
  }

  /**
   * Get a policy by ID.
   *
   * @param policyId - The policy ID to look up
   * @returns The policy, or undefined if not found
   */
  getPolicy(policyId: string): PolicyDefinition | undefined {
    return this.policies.get(policyId);
  }

  /**
   * Update an existing policy.
   *
   * @param policyId - The policy ID to update
   * @param updates - Partial policy fields to update
   * @returns The updated policy, or undefined if not found
   */
  updatePolicy(policyId: string, updates: Partial<PolicyDefinition>): PolicyDefinition | undefined {
    const existing = this.policies.get(policyId);
    if (!existing) return undefined;

    const updated: PolicyDefinition = { ...existing, ...updates, policyId };
    this.policies.set(policyId, updated);
    return updated;
  }

  /**
   * Remove a policy from the in-memory store.
   *
   * @param policyId - The policy ID to remove
   * @returns true if the policy was found and removed
   */
  removePolicy(policyId: string): boolean {
    return this.policies.delete(policyId);
  }

  /**
   * List policies with optional filters.
   *
   * @param params - Optional filter parameters
   * @returns Filtered and sorted array of policies
   */
  listPolicies(params?: PolicyListParams): PolicyDefinition[] {
    let result = Array.from(this.policies.values());
    if (params?.agentRole) result = result.filter((p) => p.agentRole === params.agentRole);
    if (params?.resource) result = result.filter((p) => p.resource === params.resource);
    if (params?.permissionLevel)
      result = result.filter((p) => p.permissionLevel === params.permissionLevel);
    if (params?.enabled !== undefined) result = result.filter((p) => p.enabled === params.enabled);
    return result.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Replace all policies in the store.
   *
   * @param policies - The new set of policies
   */
  setPolicies(policies: PolicyDefinition[]): void {
    this.policies.clear();
    for (const policy of policies) {
      this.policies.set(policy.policyId, policy);
    }
  }

  /**
   * Get a specific trace by ID.
   *
   * @param traceId - The trace ID to look up
   * @returns The trace, or undefined if not found
   */
  getTrace(traceId: string): Trace | undefined {
    return this.traces.find((t) => t.traceId === traceId);
  }

  /**
   * List execution traces with optional pagination.
   *
   * @param limit - Maximum number of traces to return (default: 50)
   * @param offset - Number of traces to skip (default: 0)
   * @returns Array of traces
   */
  listTraces(limit = 50, offset = 0): Trace[] {
    return this.traces.slice(offset, offset + limit);
  }

  /**
   * Get the number of stored policies.
   */
  get policyCount(): number {
    return this.policies.size;
  }

  /**
   * Get the number of stored traces.
   */
  get traceCount(): number {
    return this.traces.length;
  }

  /**
   * Check if the engine is healthy (always true for embedded mode).
   */
  get isHealthy(): boolean {
    return true;
  }
}
