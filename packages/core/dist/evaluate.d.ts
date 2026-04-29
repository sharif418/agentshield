/**
 * Core policy evaluation function.
 *
 * This is the shared evaluation logic extracted from the API route.
 * Pure function - no DB, no side effects.
 * Both the SDK (embedded mode) and the API route use this.
 */
import { Policy, EvaluateRequest, EvaluateResult } from './types.js';
/**
 * Core policy evaluation function. Pure function - no DB, no side effects.
 * Both the SDK (embedded mode) and the API route use this.
 *
 * @param policies - Array of policies to evaluate against
 * @param request - The evaluation request input
 * @param options - Optional evaluation options
 */
export declare function evaluatePolicies(policies: Policy[], request: EvaluateRequest, options?: {
    /** When true and no policy matches, default to BLOCK instead of ALLOW. Default: true */
    zeroTrust?: boolean;
}): Omit<EvaluateResult, 'traceId' | 'latency' | 'approvalRequestId'> & {
    action: string | null;
};
//# sourceMappingURL=evaluate.d.ts.map