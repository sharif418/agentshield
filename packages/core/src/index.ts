/**
 * AgentShield Core - Policy Evaluation Engine
 *
 * A framework-agnostic, deterministic policy evaluation engine for AI agent governance.
 * Works in any JavaScript/TypeScript environment: Node.js, browser, Deno, Bun.
 *
 * @packageDocumentation
 */

// Types
export type {
  PermissionLevel,
  ConditionRule,
  PolicyDefinition,
  EvaluateInput,
  EvaluateResult,
  MatchedPolicy,
  AgentShieldConfig,
} from './types.js';

// Pure evaluation functions
export {
  getMatchingActions,
  evaluateConditions,
  inferAction,
  enrichArgsFromQuery,
  evaluatePolicies,
} from './engine.js';
