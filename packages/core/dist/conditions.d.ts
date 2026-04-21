/**
 * Condition evaluation logic.
 * Extracted from policy-engine.ts for shared use across SDK and API routes.
 */
/**
 * Evaluate condition rules against provided arguments.
 * Supports: { field: "value" }, { field: { $contains: "value" } }, { $and: [...] }, { $or: [...] }
 * Also supports: $equals, $in, $gt, $lt operators
 */
export declare function evaluateConditions(rules: Record<string, unknown>, args: Record<string, unknown>): boolean;
//# sourceMappingURL=conditions.d.ts.map