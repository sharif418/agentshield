/**
 * AgentShield - Deterministic Runtime Policy Engine for AI Agents
 *
 * The main SDK class that provides a unified API for evaluating AI agent
 * tool calls against governance policies. Supports two modes:
 *
 * - **Hosted mode**: Connects to an AgentShield server via HTTP
 * - **Embedded mode**: Runs the policy engine locally without a server
 *
 * @example Hosted mode (connects to AgentShield server)
 * ```typescript
 * import { AgentShield } from 'agentshield';
 *
 * const shield = new AgentShield({
 *   mode: 'hosted',
 *   serverUrl: 'http://localhost:3000',
 *   apiKey: 'your-api-key',
 * });
 *
 * const result = await shield.evaluate({
 *   agentRole: 'DataAgent',
 *   toolName: 'PostgreSQL',
 *   arguments: { query: 'DROP TABLE users' },
 * });
 * console.log(result.decision); // 'BLOCK'
 * ```
 *
 * @example Embedded mode (no server needed)
 * ```typescript
 * import { AgentShield } from 'agentshield';
 *
 * const shield = new AgentShield({
 *   mode: 'embedded',
 *   policies: [
 *     {
 *       policyId: 'POL-001',
 *       name: 'Block DROP TABLE',
 *       agentRole: 'DataAgent',
 *       resource: 'PostgreSQL',
 *       action: 'DROP',
 *       permissionLevel: 'BLOCK',
 *       priority: 20,
 *       enabled: true,
 *     },
 *   ],
 * });
 *
 * const result = await shield.evaluate({
 *   agentRole: 'DataAgent',
 *   toolName: 'PostgreSQL',
 *   arguments: { query: 'DROP TABLE users' },
 * });
 * console.log(result.decision); // 'BLOCK'
 * ```
 *
 * @packageDocumentation
 */

import type { AgentShieldConfig, PolicyCreateParams, PolicyListParams, TraceListParams, Trace } from './types.js';
import type { PolicyDefinition, EvaluateInput, EvaluateResult } from '@agentshield/core';
import { HostedClient } from './hosted-client.js';
import { EmbeddedEngine } from './embedded-engine.js';

export class AgentShield {
  private config: AgentShieldConfig;
  private hostedClient?: HostedClient;
  private embeddedEngine?: EmbeddedEngine;

  /**
   * Create a new AgentShield client.
   *
   * @param config - Configuration for the client
   * @throws Error if config is invalid (e.g., missing serverUrl in hosted mode)
   */
  constructor(config: AgentShieldConfig) {
    this.config = config;

    if (config.mode === 'hosted') {
      if (!config.serverUrl) {
        throw new Error(
          'AgentShield: serverUrl is required when mode is "hosted". ' +
            'Provide a serverUrl or use mode: "embedded".'
        );
      }
      this.hostedClient = new HostedClient(config.serverUrl, config.apiKey, config.fetch);
    } else {
      if (!config.policies?.length) {
        // No policies in embedded mode — zero-trust will default-deny all evaluations
      }
      this.embeddedEngine = new EmbeddedEngine(config.policies ?? [], config.zeroTrust);
    }
  }

  /**
   * Evaluate a tool call against active policies.
   * In hosted mode, this makes an HTTP request to the server.
   * In embedded mode, this evaluates locally in-memory.
   *
   * @param request - The evaluation request input
   * @returns The evaluation result
   */
  async evaluate(request: EvaluateInput): Promise<EvaluateResult> {
    const enrichedRequest: EvaluateInput = {
      ...request,
      agentRole: request.agentRole ?? this.config.defaultAgentRole ?? 'unknown',
      sessionId: request.sessionId ?? this.config.defaultSessionId,
    };

    if (this.hostedClient) {
      return this.hostedClient.evaluate(enrichedRequest);
    }

    // Embedded mode is synchronous but we return a Promise for API consistency
    return Promise.resolve(this.embeddedEngine!.evaluate(enrichedRequest));
  }

  /**
   * Create a new policy.
   * In hosted mode, this makes an HTTP POST to the server.
   * In embedded mode, this adds to the in-memory store.
   *
   * @param params - Policy creation parameters
   * @returns The created policy
   */
  async createPolicy(params: PolicyCreateParams): Promise<PolicyDefinition> {
    if (this.hostedClient) {
      return this.hostedClient.createPolicy(params);
    }
    return Promise.resolve(this.embeddedEngine!.createPolicy(params));
  }

  /**
   * List policies with optional filters.
   *
   * @param params - Optional filter parameters
   * @returns Array of matching policies
   */
  async listPolicies(params?: PolicyListParams): Promise<PolicyDefinition[]> {
    if (this.hostedClient) {
      return this.hostedClient.listPolicies(params);
    }
    return Promise.resolve(this.embeddedEngine!.listPolicies(params));
  }

  /**
   * Get a specific policy by ID.
   * In hosted mode, fetches from server.
   * In embedded mode, looks up from local store.
   *
   * @param policyId - The policy ID to look up
   * @returns The policy, or undefined if not found
   */
  async getPolicy(policyId: string): Promise<PolicyDefinition | undefined> {
    if (this.hostedClient) {
      return this.hostedClient.getPolicy(policyId);
    }
    return Promise.resolve(this.embeddedEngine!.getPolicy(policyId));
  }

  /**
   * Delete a policy by ID.
   * In hosted mode, sends DELETE to server.
   * In embedded mode, removes from the in-memory store.
   *
   * @param policyId - The policy ID to delete
   * @returns true if the policy was found and removed (embedded mode), void for hosted
   */
  async deletePolicy(policyId: string): Promise<boolean | void> {
    if (this.hostedClient) {
      return this.hostedClient.deletePolicy(policyId);
    }
    return Promise.resolve(this.embeddedEngine!.removePolicy(policyId));
  }

  /**
   * Get a specific trace by ID.
   * In hosted mode, fetches from server.
   * In embedded mode, looks up from local trace store.
   *
   * @param traceId - The trace ID to look up
   * @returns The trace details
   */
  async getTrace(traceId: string): Promise<Trace | unknown> {
    if (this.hostedClient) {
      return this.hostedClient.getTrace(traceId);
    }
    return Promise.resolve(this.embeddedEngine!.getTrace(traceId));
  }

  /**
   * List execution traces with optional filters.
   *
   * @param params - Optional filter parameters
   * @returns Array of matching traces
   */
  async listTraces(params?: TraceListParams): Promise<Trace[] | unknown> {
    if (this.hostedClient) {
      return this.hostedClient.listTraces(params);
    }
    return Promise.resolve(this.embeddedEngine!.listTraces(params?.limit, params?.offset));
  }

  /**
   * Check if the client/engine is healthy.
   * In hosted mode, checks the server health endpoint.
   * In embedded mode, always returns true.
   *
   * @returns true if healthy
   */
  async isHealthy(): Promise<boolean> {
    if (this.hostedClient) {
      return this.hostedClient.isHealthy();
    }
    return Promise.resolve(this.embeddedEngine!.isHealthy);
  }

  /**
   * Add or update a policy in the embedded policy store.
   * Only available in embedded mode.
   *
   * @param policy - The policy to add or update
   * @throws Error if called in hosted mode
   */
  addPolicy(policy: PolicyDefinition): void {
    if (!this.embeddedEngine) {
      throw new Error('AgentShield: addPolicy() is only available in embedded mode');
    }
    const existing = this.embeddedEngine.getPolicy(policy.policyId);
    if (existing) {
      this.embeddedEngine.updatePolicy(policy.policyId, policy);
    } else {
      this.embeddedEngine.createPolicy(policy as PolicyCreateParams);
    }
  }

  /**
   * Remove a policy from the embedded policy store.
   * Only available in embedded mode.
   *
   * @param policyId - The ID of the policy to remove
   * @returns true if the policy was found and removed
   * @throws Error if called in hosted mode
   */
  removePolicy(policyId: string): boolean {
    if (!this.embeddedEngine) {
      throw new Error('AgentShield: removePolicy() is only available in embedded mode');
    }
    return this.embeddedEngine.removePolicy(policyId);
  }

  /**
   * Replace all policies in the embedded policy store.
   * Only available in embedded mode.
   *
   * @param policies - The new set of policies
   * @throws Error if called in hosted mode
   */
  setPolicies(policies: PolicyDefinition[]): void {
    if (!this.embeddedEngine) {
      throw new Error('AgentShield: setPolicies() is only available in embedded mode');
    }
    this.embeddedEngine.setPolicies(policies);
  }

  /**
   * Get the current mode.
   */
  get mode(): 'hosted' | 'embedded' {
    return this.config.mode;
  }

  /**
   * Get policy count (embedded mode only).
   * Returns undefined in hosted mode.
   */
  get policyCount(): number | undefined {
    return this.embeddedEngine?.policyCount;
  }

  /**
   * Get trace count (embedded mode only).
   * Returns undefined in hosted mode.
   */
  get traceCount(): number | undefined {
    return this.embeddedEngine?.traceCount;
  }
}

/**
 * Convenience function to create an AgentShield client.
 *
 * @param config - Configuration for the client
 * @returns A new AgentShield client instance
 *
 * @example
 * ```typescript
 * import { createAgentShield } from 'agentshield';
 *
 * const shield = createAgentShield({
 *   mode: 'embedded',
 *   policies: [...],
 * });
 * ```
 */
export function createAgentShield(config: AgentShieldConfig): AgentShield {
  return new AgentShield(config);
}
