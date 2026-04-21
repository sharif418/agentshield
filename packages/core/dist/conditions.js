/**
 * Condition evaluation logic.
 * Extracted from policy-engine.ts for shared use across SDK and API routes.
 */
/**
 * Evaluate condition rules against provided arguments.
 * Supports: { field: "value" }, { field: { $contains: "value" } }, { $and: [...] }, { $or: [...] }
 * Also supports: $equals, $in, $gt, $lt operators
 */
export function evaluateConditions(rules, args) {
    // Handle logical operators
    if (rules.$and && Array.isArray(rules.$and)) {
        return rules.$and.every((r) => evaluateConditions(r, args));
    }
    if (rules.$or && Array.isArray(rules.$or)) {
        return rules.$or.some((r) => evaluateConditions(r, args));
    }
    // Handle field conditions
    for (const [field, condition] of Object.entries(rules)) {
        if (field.startsWith('$'))
            continue; // Skip logical operators already handled
        const argValue = args[field];
        if (typeof condition === 'object' && condition !== null) {
            const cond = condition;
            if (cond.$contains && typeof argValue === 'string') {
                if (!argValue.includes(cond.$contains))
                    return false;
            }
            else if (cond.$equals !== undefined) {
                if (argValue !== cond.$equals)
                    return false;
            }
            else if (cond.$in && Array.isArray(cond.$in)) {
                if (!cond.$in.includes(argValue))
                    return false;
            }
            else if (cond.$gt !== undefined && typeof argValue === 'number') {
                if (argValue <= cond.$gt)
                    return false;
            }
            else if (cond.$lt !== undefined && typeof argValue === 'number') {
                if (argValue >= cond.$lt)
                    return false;
            }
        }
        else {
            // Simple equality check
            if (argValue !== condition)
                return false;
        }
    }
    return true;
}
//# sourceMappingURL=conditions.js.map