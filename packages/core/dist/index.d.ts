/**
 * AgentShield Core - Policy Evaluation Engine
 *
 * A framework-agnostic, deterministic policy evaluation engine for AI agent governance.
 * Works in any JavaScript/TypeScript environment: Node.js, browser, Deno, Bun.
 *
 * @packageDocumentation
 */
export { evaluateConditions } from './conditions';
export { inferAction, enrichArgsFromQuery, getMatchingActions } from './inference';
export { evaluatePolicies } from './evaluate';
export type { Decision, Policy, EvaluateRequest, EvaluateResult, Trace } from './types';
export type { PermissionLevel, ConditionRule, PolicyDefinition, EvaluateInput, MatchedPolicy, AgentShieldConfig, } from './types';
//# sourceMappingURL=index.d.ts.map