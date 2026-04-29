/**
 * AgentShield Core - Policy Evaluation Engine
 *
 * A framework-agnostic, deterministic policy evaluation engine for AI agent governance.
 * Works in any JavaScript/TypeScript environment: Node.js, browser, Deno, Bun.
 *
 * @packageDocumentation
 */
export { evaluateConditions } from './conditions.js';
export { inferAction, enrichArgsFromQuery, getMatchingActions } from './inference.js';
export { evaluatePolicies } from './evaluate.js';
export type { Decision, Policy, EvaluateRequest, EvaluateResult, Trace } from './types.js';
export type { PermissionLevel, ConditionRule, PolicyDefinition, EvaluateInput, MatchedPolicy, AgentShieldConfig, } from './types.js';
//# sourceMappingURL=index.d.ts.map