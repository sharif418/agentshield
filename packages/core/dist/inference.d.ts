/**
 * Action inference and argument enrichment logic.
 * Extracted from policy-engine.ts for shared use across SDK and API routes.
 */
/**
 * Given a specific action, return all policy action values that should match it.
 * E.g., "REFUND" -> ["REFUND", "WRITE"], "SELECT" -> ["SELECT", "READ", "GET", "LIST", "SEARCH"]
 */
export declare function getMatchingActions(action: string): string[];
/**
 * Infer the action from the arguments and tool name when no explicit action is provided.
 * This enables the policy engine to make accurate decisions even when the caller
 * doesn't specify the action directly.
 */
export declare function inferAction(args: Record<string, unknown>, toolName: string): string | null;
/**
 * Enrich args with inferred operation from SQL queries so that condition rules
 * can match. For example, {"query":"DROP TABLE users"} gets operation:"DROP_TABLE".
 */
export declare function enrichArgsFromQuery(args: Record<string, unknown>): Record<string, unknown>;
//# sourceMappingURL=inference.d.ts.map