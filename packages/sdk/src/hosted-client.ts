/**
 * AgentShield Hosted Client
 *
 * HTTP client for communicating with an AgentShield server in hosted mode.
 * Uses the standard Fetch API (works in browser and Node.js 18+).
 * Supports custom fetch functions for edge runtime compatibility.
 */

import type { EvaluateInput, EvaluateResult, PolicyDefinition } from '@agentshieldhq/core';
import type { PolicyCreateParams, PolicyListParams, TraceListParams, Trace } from './types.js';

export class HostedClient {
  private serverUrl: string;
  private apiKey?: string;
  private fetchFn: typeof fetch;

  constructor(serverUrl: string, apiKey?: string, customFetch?: typeof fetch) {
    this.serverUrl = serverUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.fetchFn = customFetch ?? globalThis.fetch;
  }

  /**
   * Make an HTTP request to the AgentShield server.
   * Automatically adds authentication headers and handles error responses.
   */
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) ?? {}),
    };
    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }

    const response = await this.fetchFn(`${this.serverUrl}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => 'Unknown error');
      throw new Error(`AgentShield API error (${response.status}): ${body}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Evaluate a tool call against the server's policies.
   *
   * @param request - The evaluation request input
   * @returns The evaluation result from the server
   */
  async evaluate(request: EvaluateInput): Promise<EvaluateResult> {
    return this.request<EvaluateResult>('/api/evaluate', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Create a new policy on the server.
   *
   * @param params - Policy creation parameters
   * @returns The created policy
   */
  async createPolicy(params: PolicyCreateParams): Promise<PolicyDefinition> {
    return this.request<PolicyDefinition>('/api/policies', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * List policies with optional filters.
   *
   * @param params - Optional filter parameters
   * @returns Array of matching policies
   */
  async listPolicies(params?: PolicyListParams): Promise<PolicyDefinition[]> {
    const query = new URLSearchParams();
    if (params?.agentRole) query.set('agentRole', params.agentRole);
    if (params?.resource) query.set('resource', params.resource);
    if (params?.permissionLevel) query.set('permissionLevel', params.permissionLevel);
    if (params?.enabled !== undefined) query.set('enabled', String(params.enabled));
    const qs = query.toString();
    return this.request<PolicyDefinition[]>(`/api/policies${qs ? `?${qs}` : ''}`);
  }

  /**
   * Get a specific policy by ID.
   *
   * @param policyId - The policy ID to look up
   * @returns The policy details
   */
  async getPolicy(policyId: string): Promise<PolicyDefinition> {
    return this.request<PolicyDefinition>(`/api/policies/${encodeURIComponent(policyId)}`);
  }

  /**
   * Delete a policy by ID.
   *
   * @param policyId - The policy ID to delete
   */
  async deletePolicy(policyId: string): Promise<void> {
    await this.request<void>(`/api/policies/${encodeURIComponent(policyId)}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get a specific trace by ID.
   *
   * @param traceId - The trace ID to look up
   * @returns The trace details
   */
  async getTrace(traceId: string): Promise<Trace> {
    return this.request<Trace>(`/api/traces/${encodeURIComponent(traceId)}`);
  }

  /**
   * List execution traces with optional filters.
   *
   * @param params - Optional filter parameters
   * @returns Array of matching traces
   */
  async listTraces(params?: TraceListParams): Promise<Trace[]> {
    const query = new URLSearchParams();
    if (params?.sessionId) query.set('sessionId', params.sessionId);
    if (params?.agentRole) query.set('agentRole', params.agentRole);
    if (params?.evaluationResult) query.set('evaluationResult', params.evaluationResult);
    if (params?.toolName) query.set('toolName', params.toolName);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const qs = query.toString();
    return this.request<Trace[]>(`/api/traces${qs ? `?${qs}` : ''}`);
  }

  /**
   * Check if the server is healthy and reachable.
   *
   * @returns true if the server responds successfully
   */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.fetchFn(`${this.serverUrl}/api/stats`, {
        headers: this.getAuthHeaders(),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get authentication headers.
   */
  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }
    return headers;
  }
}
