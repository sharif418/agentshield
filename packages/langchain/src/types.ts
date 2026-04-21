/**
 * AgentShield LangChain Integration Types
 */

import type { EvaluateResult, Decision, Policy, PolicyDefinition, EvaluateInput, MatchedPolicy, ConditionRule, Trace } from '@agentshield/core';

/**
 * Configuration for the AgentShield SDK client.
 * Supports both hosted mode (HTTP to server) and embedded mode (in-memory).
 * Re-declared here to avoid circular dependency on SDK internals.
 */
export interface AgentShieldConfig {
  /** Server URL for hosted mode (e.g., 'http://localhost:3000') */
  serverUrl?: string;
  /** API key for authentication (required in production) */
  apiKey?: string;
  /** Mode: 'hosted' uses HTTP to server, 'embedded' uses in-memory store */
  mode?: 'hosted' | 'embedded';
  /** Initial policies for embedded mode */
  policies?: PolicyDefinition[];
  /** Whether to use zero-trust mode (default: true) */
  zeroTrust?: boolean;
  /** Custom fetch function (for edge runtime, etc.) */
  fetch?: typeof fetch;
}

/**
 * Configuration for the AgentShield LangChain callback handler.
 *
 * Extends the base AgentShieldConfig so the handler can create its own
 * AgentShield client internally.
 *
 * @example
 * ```typescript
 * const handler = new AgentShieldCallbackHandler({
 *   mode: 'embedded',
 *   policies: [
 *     {
 *       policyId: 'POL-001',
 *       name: 'Block SQL DROP',
 *       agentRole: 'DataAgent',
 *       resource: 'PostgreSQL',
 *       action: 'DROP',
 *       permissionLevel: 'BLOCK',
 *       priority: 20,
 *       enabled: true,
 *     },
 *   ],
 *   defaultAgentRole: 'DataAgent',
 *   toolNameMap: { 'sql_db_query': 'PostgreSQL' },
 *   onBlock: 'throw',
 *   onRequireApproval: 'throw',
 * });
 * ```
 */
export interface AgentShieldLangChainConfig extends AgentShieldConfig {
  /**
   * What to do when a tool call is blocked.
   * - 'throw' - throw an AgentShieldBlockError (default)
   * - 'return' - return a formatted message instead of the tool output via handleToolEnd
   */
  onBlock?: 'throw' | 'return';

  /**
   * What to do when a tool call requires approval.
   * - 'throw' - throw an AgentShieldApprovalError (default for safety)
   * - 'return' - return a formatted message via handleToolEnd
   * - 'allow' - allow the tool call through (for async approval workflows)
   */
  onRequireApproval?: 'throw' | 'return' | 'allow';

  /**
   * Custom message when a tool call is blocked.
   * Available variables: {toolName}, {reason}, {agentRole}
   * @default 'Tool call blocked by AgentShield: {toolName} - {reason}'
   */
  blockMessage?: string;

  /**
   * Custom message when a tool call requires approval.
   * Available variables: {toolName}, {reason}, {approvalRequestId}, {agentRole}
   * @default 'Tool call requires approval: {toolName} - {reason} (Request: {approvalRequestId})'
   */
  approvalMessage?: string;

  /**
   * Map LangChain tool names to AgentShield resource names.
   * e.g., { 'sql_db_query': 'PostgreSQL', 'requests_get': 'HTTPClient' }
   */
  toolNameMap?: Record<string, string>;

  /**
   * Map LangChain agent names to AgentShield agent roles.
   * e.g., { 'sql-agent': 'DataAgent' }
   * The mapping is checked against the metadata/tags passed in handleToolStart.
   */
  agentRoleMap?: Record<string, string>;

  /**
   * Default agent role if none can be inferred.
   * @default 'DefaultAgent'
   */
  defaultAgentRole?: string;

  /**
   * Callback when a tool call is evaluated.
   * Useful for logging, metrics, or custom side effects.
   */
  onEvaluate?: (event: AgentShieldEvent) => void;
}

/**
 * Event emitted when a tool call is evaluated by the callback handler.
 */
export interface AgentShieldEvent {
  /** The evaluation result from AgentShield */
  result: EvaluateResult;
  /** The LangChain tool name that was evaluated */
  toolName: string;
  /** The AgentShield resource name (after toolNameMap mapping) */
  shieldResource: string;
  /** The agent role that triggered the evaluation */
  agentRole: string;
  /** The arguments passed to the tool */
  args: Record<string, unknown>;
  /** Timestamp of the evaluation */
  timestamp: Date;
}
