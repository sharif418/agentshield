/**
 * Policy evaluation engine — thin re-export layer for backward compatibility.
 *
 * All evaluation logic lives in @agentshieldhq/core (packages/core/).
 * This file re-exports everything so existing imports like
 * `import { evaluateConditions } from '@/lib/policy-engine'` keep working.
 *
 * The API route at src/app/api/evaluate/route.ts imports directly from
 * this module, which delegates to the shared core implementation.
 *
 * For npm consumers: the @agentshieldhq/core package provides the same
 * functions and types. This file exists solely for the Next.js app's
 * internal convenience.
 */

// Re-export from the built core package
// Using dist/ directly to avoid Turbopack module resolution issues with workspace packages
export {
  evaluateConditions,
  inferAction,
  enrichArgsFromQuery,
  getMatchingActions,
  evaluatePolicies,
} from '../../packages/core/dist/index.js';

export type {
  Decision,
  Policy,
  EvaluateRequest,
  EvaluateResult,
  Trace,
  PermissionLevel,
  PolicyDefinition,
  EvaluateInput,
  ConditionRule,
  MatchedPolicy,
} from '../../packages/core/dist/index.js';
