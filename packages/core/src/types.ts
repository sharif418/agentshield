/**
 * AgentShield Core Types
 * Shared type definitions used across all AgentShield packages.
 */

/** Policy decision types */
export type Decision = 'ALLOW' | 'BLOCK' | 'REQUIRE_APPROVAL';

/** A condition rule object - supports logical operators and field matchers */
export type ConditionRule =
  | { $and: ConditionRule[] }
  | { $or: ConditionRule[] }
  | Record<string, unknown>;

/** A policy definition used by the evaluation engine */
export interface Policy {
  /** Unique identifier for the policy */
  policyId: string;
  /** Human-readable name */
  name: string;
  /** Description of what the policy does */
  description?: string;
  /** Which agent role this policy applies to. Use '*' for wildcard matching. */
  agentRole: string;
  /** Which resource/tool this policy applies to */
  resource: string;
  /** Which action this policy applies to (e.g., 'READ', 'WRITE', 'DROP') */
  action: string;
  /** Permission level for this policy */
  permissionLevel: Decision;
  /** Optional condition rules for fine-grained matching (JSON string, ConditionRule object, or null) */
  conditionRules?: string | ConditionRule | Record<string, unknown> | null;
  /** Priority (higher = evaluated first) */
  priority: number;
  /** Whether this policy is active */
  enabled: boolean;
}

/** Input for an evaluation request */
export interface EvaluateRequest {
  /** The role of the agent making the tool call */
  agentRole: string;
  /** The name of the tool being called */
  toolName: string;
  /** Arguments passed to the tool call */
  arguments?: Record<string, unknown>;
  /** The action being performed (e.g., 'SELECT', 'DROP'). Auto-inferred if omitted. */
  action?: string;
  /** Optional session ID for tracing */
  sessionId?: string;
}

/** The result of a policy evaluation */
export interface EvaluateResult {
  /** The decision: ALLOW, BLOCK, or REQUIRE_APPROVAL */
  decision: Decision;
  /** Trace ID for this evaluation */
  traceId?: string;
  /** The matched policy details */
  matchedPolicy: {
    policyId: string;
    name: string;
    permissionLevel: Decision;
    priority: number;
    action: string;
  } | null;
  /** Human-readable reason for the decision */
  reason: string | null;
  /** The inferred or provided action */
  action: string | null;
  /** Evaluation latency in milliseconds */
  latency?: number;
  /** Approval request ID, if decision is REQUIRE_APPROVAL */
  approvalRequestId?: string | null;
}

/** An execution trace record */
export interface Trace {
  traceId: string;
  sessionId: string;
  agentRole: string;
  toolName: string;
  intentPayload: string;
  evaluationResult: Decision;
  matchedPolicyId: string | null;
  latency: number;
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// Backward-compatible type aliases (for SDK and existing consumers)
// ---------------------------------------------------------------------------

/** @deprecated Use Decision instead */
export type PermissionLevel = Decision;

/** @deprecated Use Policy instead. Alias for backward compatibility. */
export type PolicyDefinition = Policy;

/** @deprecated Use EvaluateRequest instead */
export type EvaluateInput = EvaluateRequest;

/** The matched policy details in an evaluation result */
export interface MatchedPolicy {
  policyId: string;
  name: string;
  permissionLevel: PermissionLevel;
  priority: number;
  action: string;
}

/** Configuration for the AgentShield client */
export interface AgentShieldConfig {
  serverUrl?: string;
  apiKey?: string;
  mode?: 'hosted' | 'embedded';
  policies?: Policy[];
  zeroTrust?: boolean;
  fetch?: typeof fetch;
}
