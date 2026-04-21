/**
 * AgentShield SDK Types
 *
 * Re-exports core types and adds SDK-specific type definitions
 * for hosted and embedded modes.
 */

// Re-export all core types
export type {
  Decision,
  Policy,
  EvaluateRequest,
  EvaluateResult,
  Trace,
  ConditionRule,
  MatchedPolicy,
} from '../../core/src/types';

// Backward-compatible aliases
export type {
  Decision as PermissionLevel,
  Policy as PolicyDefinition,
  EvaluateRequest as EvaluateInput,
} from '../../core/src/types';

/**
 * Configuration for the AgentShield SDK client.
 * Supports both hosted mode (HTTP to server) and embedded mode (in-memory).
 */
export interface AgentShieldConfig {
  /** Server URL for hosted mode (e.g., 'http://localhost:3000') */
  serverUrl?: string;
  /** API key for authentication (required in production) */
  apiKey?: string;
  /** Mode: 'hosted' uses HTTP to server, 'embedded' uses in-memory store */
  mode: 'hosted' | 'embedded';
  /** Initial policies for embedded mode */
  policies?: import('../../core/src/types').Policy[];
  /** Default agent role for evaluate calls */
  defaultAgentRole?: string;
  /** Default session ID */
  defaultSessionId?: string;
  /** Whether to use zero-trust mode (default: true) */
  zeroTrust?: boolean;
  /** Custom fetch function (for edge runtime, etc.) */
  fetch?: typeof fetch;
}

/**
 * Parameters for creating a new policy.
 */
export interface PolicyCreateParams {
  /** Unique identifier for the policy (auto-generated if omitted) */
  policyId?: string;
  /** Human-readable name */
  name: string;
  /** Description of what the policy does */
  description?: string;
  /** Which agent role this policy applies to */
  agentRole: string;
  /** Which resource/tool this policy applies to */
  resource: string;
  /** Which action this policy applies to */
  action: string;
  /** Permission level for this policy */
  permissionLevel: import('../../core/src/types').Decision;
  /** Optional condition rules for fine-grained matching */
  conditionRules?: string | Record<string, unknown>;
  /** Priority (higher = evaluated first) */
  priority?: number;
  /** Whether this policy is active */
  enabled?: boolean;
}

/**
 * Parameters for listing/filtering policies.
 */
export interface PolicyListParams {
  /** Filter by agent role */
  agentRole?: string;
  /** Filter by resource */
  resource?: string;
  /** Filter by permission level */
  permissionLevel?: import('../../core/src/types').Decision;
  /** Filter by enabled status */
  enabled?: boolean;
}

/**
 * Parameters for listing/filtering traces.
 */
export interface TraceListParams {
  /** Filter by session ID */
  sessionId?: string;
  /** Filter by agent role */
  agentRole?: string;
  /** Filter by evaluation result */
  evaluationResult?: import('../../core/src/types').Decision;
  /** Filter by tool name */
  toolName?: string;
  /** Maximum number of traces to return */
  limit?: number;
  /** Number of traces to skip */
  offset?: number;
}
