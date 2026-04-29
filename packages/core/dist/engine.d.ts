/**
 * AgentShield Core Policy Engine
 *
 * Backward-compatible re-export module.
 * All logic has been extracted into dedicated modules:
 *   - conditions.ts: evaluateConditions
 *   - inference.ts: getMatchingActions, inferAction, enrichArgsFromQuery
 *   - evaluate.ts: evaluatePolicies
 *
 * This file re-exports everything for consumers that import from engine.js directly.
 */
export { evaluateConditions } from './conditions.js';
export { getMatchingActions, inferAction, enrichArgsFromQuery } from './inference.js';
export { evaluatePolicies } from './evaluate.js';
//# sourceMappingURL=engine.d.ts.map