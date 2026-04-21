/**
 * AgentShield Core - Policy Evaluation Engine
 *
 * A framework-agnostic, deterministic policy evaluation engine for AI agent governance.
 * Works in any JavaScript/TypeScript environment: Node.js, browser, Deno, Bun.
 *
 * @packageDocumentation
 */

// Core evaluation functions
export { evaluateConditions } from './conditions';
export { inferAction, enrichArgsFromQuery, getMatchingActions } from './inference';
export { evaluatePolicies } from './evaluate';

// Core types
export type { Decision, Policy, EvaluateRequest, EvaluateResult, Trace } from './types';

// Backward-compatible type exports (for SDK and existing consumers)
export type {
  PermissionLevel,
  ConditionRule,
  PolicyDefinition,
  EvaluateInput,
  MatchedPolicy,
  AgentShieldConfig,
} from './types';
