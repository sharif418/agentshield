/**
 * AgentShield SDK Client
 *
 * The main client class for interacting with AgentShield.
 * Supports two modes:
 * - **Hosted mode**: Connects to an AgentShield server via HTTP
 * - **Embedded mode**: Runs the policy engine locally without a server
 *
 * @example
 * ```typescript
 * import { AgentShield } from 'agentshield'
 *
 * // Hosted mode - connect to server
 * const shield = new AgentShield({
 *   serverUrl: 'https://agentshield.example.com',
 *   apiKey: 'sk-...'
 * })
 *
 * // Embedded mode - no server needed
 * const shield = new AgentShield({
 *   mode: 'embedded',
 *   policies: [
 *     { agentRole: '*', resource: 'FileSystem', action: 'DELETE', permission: 'BLOCK' },
 *   ]
 * })
 *
 * // Evaluate a tool call
 * const result = await shield.evaluate({
 *   agentRole: 'DataAgent',
 *   toolName: 'PostgreSQL',
 *   action: 'DROP',
 *   arguments: { query: 'DROP TABLE users' }
 * })
 *
 * console.log(result.decision) // 'BLOCK'
 * ```
 *
 * @packageDocumentation
 */

import {
  evaluatePolicies,
  inferAction,
  enrichArgsFromQuery,
  getMatchingActions,
  evaluateConditions,
} from '../../core/src/engine.js';
import type {
  AgentShieldConfig,
  EvaluateInput,
  EvaluateResult,
  MatchedPolicy,
  PermissionLevel,
  PolicyDefinition,
} from '../../core/src/types.js';

/**
 * Generate a unique trace ID
 */
function generateTraceId(): string {
  return `TRC-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * AgentShield SDK Client
 *
 * Provides a unified API for evaluating AI agent tool calls against
 * governance policies. Works in both hosted mode (connecting to an
 * AgentShield server) and embedded mode (running the engine locally).
 */
export class AgentShield {
  private config: Required<Pick<AgentShieldConfig, 'mode' | 'zeroTrust'>> &
    Pick<AgentShieldConfig, 'serverUrl' | 'apiKey' | 'fetch'> & {
      policies: PolicyDefinition[];
    };

  /**
   * Create a new AgentShield client.
   *
   * @param config - Configuration for the client
   * @throws Error if config is invalid
   */
  constructor(config: AgentShieldConfig = {}) {
    // Determine mode
    const mode = config.mode ?? (config.serverUrl ? 'hosted' : 'embedded');

    if (mode === 'hosted' && !config.serverUrl) {
      throw new Error(
        'AgentShield: serverUrl is required when mode is "hosted". ' +
          'Provide a serverUrl or use mode: "embedded".'
      );
    }

    if (mode === 'embedded' && !config.policies?.length) {
      console.warn(
        'AgentShield: No policies provided for embedded mode. ' +
          'All evaluations will return BLOCK (zero-trust default).'
      );
    }

    this.config = {
      mode,
      serverUrl: config.serverUrl,
      apiKey: config.apiKey,
      policies: config.policies ?? [],
      zeroTrust: config.zeroTrust ?? true,
      fetch: config.fetch,
    };
  }

  /**
   * Evaluate a tool call against the configured policies.
   *
   * In hosted mode, this sends an HTTP request to the AgentShield server.
   * In embedded mode, this evaluates locally using the in-memory policy store.
   *
   * @param input - The tool call to evaluate
   * @returns The evaluation result
   */
  async evaluate(input: EvaluateInput): Promise<EvaluateResult> {
    if (this.config.mode === 'hosted') {
      return this.evaluateHosted(input);
    }
    return this.evaluateEmbedded(input);
  }

  /**
   * Add or update a policy in the embedded policy store.
   * Only available in embedded mode.
   *
   * @param policy - The policy to add or update
   */
  addPolicy(policy: PolicyDefinition): void {
    if (this.config.mode !== 'embedded') {
      throw new Error('AgentShield: addPolicy() is only available in embedded mode');
    }
    const index = this.config.policies.findIndex(
      (p) => p.policyId === policy.policyId
    );
    if (index >= 0) {
      this.config.policies[index] = policy;
    } else {
      this.config.policies.push(policy);
    }
  }

  /**
   * Remove a policy from the embedded policy store.
   * Only available in embedded mode.
   *
   * @param policyId - The ID of the policy to remove
   * @returns true if the policy was found and removed
   */
  removePolicy(policyId: string): boolean {
    if (this.config.mode !== 'embedded') {
      throw new Error('AgentShield: removePolicy() is only available in embedded mode');
    }
    const index = this.config.policies.findIndex((p) => p.policyId === policyId);
    if (index >= 0) {
      this.config.policies.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * List all policies in the embedded policy store.
   * Only available in embedded mode.
   *
   * @returns Array of all policies
   */
  listPolicies(): PolicyDefinition[] {
    if (this.config.mode !== 'embedded') {
      throw new Error('AgentShield: listPolicies() is only available in embedded mode');
    }
    return [...this.config.policies];
  }

  /**
   * Replace all policies in the embedded policy store.
   * Only available in embedded mode.
   *
   * @param policies - The new set of policies
   */
  setPolicies(policies: PolicyDefinition[]): void {
    if (this.config.mode !== 'embedded') {
      throw new Error('AgentShield: setPolicies() is only available in embedded mode');
    }
    this.config.policies = [...policies];
  }

  /**
   * Get the current mode.
   */
  getMode(): 'hosted' | 'embedded' {
    return this.config.mode;
  }

  /**
   * Check if the client is connected (always true for embedded, checks server for hosted).
   */
  async isHealthy(): Promise<boolean> {
    if (this.config.mode === 'embedded') {
      return true;
    }
    try {
      const fetchFn = this.config.fetch ?? globalThis.fetch;
      const response = await fetchFn(`${this.config.serverUrl}/api/stats`, {
        headers: this.getAuthHeaders(),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Private methods
  // ---------------------------------------------------------------------------

  /**
   * Evaluate in hosted mode by calling the server API
   */
  private async evaluateHosted(input: EvaluateInput): Promise<EvaluateResult> {
    const fetchFn = this.config.fetch ?? globalThis.fetch;
    const startTime = performance.now();

    try {
      const response = await fetchFn(`${this.config.serverUrl}/api/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unknown error');
        throw new Error(
          `AgentShield: Evaluation failed (HTTP ${response.status}): ${errorBody}`
        );
      }

      const data = (await response.json()) as Record<string, unknown>;
      return {
        decision: data.decision as PermissionLevel,
        reason: (data.reason as string) ?? '',
        matchedPolicy: (data.matchedPolicy as MatchedPolicy) ?? null,
        action: (data.action as string) ?? input.action ?? null,
        latencyMs: performance.now() - startTime,
        traceId: (data.traceId as string) ?? generateTraceId(),
        approvalRequestId: data.approvalRequestId as string | undefined,
      };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('AgentShield:')) {
        throw error;
      }
      throw new Error(
        `AgentShield: Failed to connect to server at ${this.config.serverUrl}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Evaluate in embedded mode using the local policy engine
   */
  private async evaluateEmbedded(input: EvaluateInput): Promise<EvaluateResult> {
    const startTime = performance.now();

    const result = evaluatePolicies(this.config.policies, input, {
      zeroTrust: this.config.zeroTrust,
    });

    const latencyMs = performance.now() - startTime;

    return {
      decision: result.decision,
      reason: result.reason,
      matchedPolicy: result.matchedPolicy,
      action: result.action,
      latencyMs,
      traceId: generateTraceId(),
    };
  }

  /**
   * Get authentication headers for hosted mode
   */
  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.config.apiKey) {
      headers['x-api-key'] = this.config.apiKey;
    }
    return headers;
  }
}

/**
 * Convenience function to create an AgentShield client.
 *
 * @param config - Configuration for the client
 * @returns A new AgentShield client instance
 */
export function createAgentShield(config: AgentShieldConfig = {}): AgentShield {
  return new AgentShield(config);
}
