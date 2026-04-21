/**
 * AgentShield Core Types
 * Shared type definitions used across all AgentShield packages.
 */

/** Permission levels for policy decisions */
export type PermissionLevel = 'ALLOW' | 'BLOCK' | 'REQUIRE_APPROVAL';

/** A condition rule object - supports logical operators and field matchers */
export type ConditionRule =
  | { $and: ConditionRule[] }
  | { $or: ConditionRule[] }
  | Record<string, unknown>;

/** A policy definition used by the evaluation engine */
export interface PolicyDefinition {
  /** Unique identifier for the policy */
  policyId: string;
  /** Human-readable name */
  name: string;
  /** Description of what the policy does */
  description?: string;
  /** Which agent role this policy applies to. Use '*' for all roles. */
  agentRole: string;
  /** Which resource/tool this policy applies to */
  resource: string;
  /** Which action this policy applies to (e.g., 'READ', 'WRITE', 'DROP') */
  action: string;
  /** Permission level for this policy */
  permissionLevel: PermissionLevel;
  /** Optional condition rules for fine-grained matching */
  conditionRules?: ConditionRule | null;
  /** Priority (higher = evaluated first) */
  priority: number;
  /** Whether this policy is active */
  enabled: boolean;
}

/** Input for an evaluation request */
export interface EvaluateInput {
  /** The role of the agent making the tool call */
  agentRole: string;
  /** The name of the tool being called */
  toolName: string;
  /** The action being performed (e.g., 'SELECT', 'DROP'). Auto-inferred if omitted. */
  action?: string;
  /** Arguments passed to the tool call */
  arguments?: Record<string, unknown>;
  /** Optional session ID for tracing */
  sessionId?: string;
}

/** The matched policy details in an evaluation result */
export interface MatchedPolicy {
  policyId: string;
  name: string;
  permissionLevel: PermissionLevel;
  priority: number;
  action: string;
}

/** The result of a policy evaluation */
export interface EvaluateResult {
  /** The decision: ALLOW, BLOCK, or REQUIRE_APPROVAL */
  decision: PermissionLevel;
  /** Human-readable reason for the decision */
  reason: string;
  /** The matched policy, if any */
  matchedPolicy: MatchedPolicy | null;
  /** The inferred or provided action */
  action: string | null;
  /** Evaluation latency in milliseconds */
  latencyMs: number;
  /** Trace ID for this evaluation */
  traceId: string;
  /** Approval request ID, if decision is REQUIRE_APPROVAL */
  approvalRequestId?: string;
}

/** Configuration for the AgentShield client */
export interface AgentShieldConfig {
  /** Server URL for hosted mode (e.g., 'https://agentshield.example.com') */
  serverUrl?: string;
  /** API key for authentication with the server */
  apiKey?: string;
  /** Mode: 'hosted' connects to a server, 'embedded' runs locally */
  mode?: 'hosted' | 'embedded';
  /** Policies for embedded mode (not needed in hosted mode) */
  policies?: PolicyDefinition[];
  /** Whether to use zero-trust mode (default: true) */
  zeroTrust?: boolean;
  /** Custom fetch function (for browser/Node.js compatibility) */
  fetch?: typeof fetch;
}
