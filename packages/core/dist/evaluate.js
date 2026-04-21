/**
 * Core policy evaluation function.
 *
 * This is the shared evaluation logic extracted from the API route.
 * Pure function - no DB, no side effects.
 * Both the SDK (embedded mode) and the API route use this.
 */
import { evaluateConditions } from './conditions';
import { inferAction, enrichArgsFromQuery, getMatchingActions } from './inference';
/**
 * Parse condition rules from various formats into an object suitable for evaluateConditions.
 */
function parseConditionRules(conditionRules) {
    if (!conditionRules)
        return null;
    if (typeof conditionRules === 'string') {
        try {
            return JSON.parse(conditionRules);
        }
        catch {
            return null;
        }
    }
    return conditionRules;
}
/**
 * Core policy evaluation function. Pure function - no DB, no side effects.
 * Both the SDK (embedded mode) and the API route use this.
 *
 * @param policies - Array of policies to evaluate against
 * @param request - The evaluation request input
 * @param options - Optional evaluation options
 */
export function evaluatePolicies(policies, request, options = {}) {
    const { zeroTrust = true } = options;
    const { agentRole, toolName } = request;
    const rawArgs = request.arguments ?? {};
    const action = request.action ?? inferAction(rawArgs, toolName);
    const args = enrichArgsFromQuery(rawArgs);
    // Filter policies matching agentRole and resource
    const matchingPolicies = policies.filter(p => {
        if (!p.enabled)
            return false;
        if (p.agentRole !== '*' && p.agentRole !== agentRole)
            return false;
        if (p.resource !== toolName)
            return false;
        // If action specified, check action matches
        if (action) {
            const matchingActions = getMatchingActions(action);
            if (!matchingActions.includes(p.action))
                return false;
        }
        return true;
    });
    // Sort by priority desc
    matchingPolicies.sort((a, b) => b.priority - a.priority);
    let decision = 'ALLOW';
    let matchedPolicy = null;
    let reason = null;
    if (action) {
        // Standard priority-based evaluation
        for (const policy of matchingPolicies) {
            let conditionMatches = true;
            if (policy.conditionRules) {
                const rules = parseConditionRules(policy.conditionRules);
                if (rules) {
                    conditionMatches = evaluateConditions(rules, args);
                }
            }
            if (!conditionMatches)
                continue;
            if (policy.permissionLevel === 'BLOCK') {
                decision = 'BLOCK';
                matchedPolicy = {
                    policyId: policy.policyId,
                    name: policy.name,
                    permissionLevel: policy.permissionLevel,
                    priority: policy.priority,
                    action: policy.action,
                };
                reason = `Blocked by policy: ${policy.name}`;
                break;
            }
            if (policy.permissionLevel === 'REQUIRE_APPROVAL' && decision === 'ALLOW') {
                decision = 'REQUIRE_APPROVAL';
                matchedPolicy = {
                    policyId: policy.policyId,
                    name: policy.name,
                    permissionLevel: policy.permissionLevel,
                    priority: policy.priority,
                    action: policy.action,
                };
                reason = `Requires approval per policy: ${policy.name}`;
            }
            if (policy.permissionLevel === 'ALLOW' && decision === 'ALLOW') {
                matchedPolicy = {
                    policyId: policy.policyId,
                    name: policy.name,
                    permissionLevel: policy.permissionLevel,
                    priority: policy.priority,
                    action: policy.action,
                };
                reason = `Allowed by policy: ${policy.name}`;
            }
        }
    }
    else {
        // Zero-trust mode
        const blockPolicies = [];
        const approvalPolicies = [];
        const allowPolicies = [];
        for (const policy of matchingPolicies) {
            let conditionMatches = true;
            if (policy.conditionRules) {
                const rules = parseConditionRules(policy.conditionRules);
                if (rules) {
                    conditionMatches = evaluateConditions(rules, args);
                }
            }
            if (!conditionMatches)
                continue;
            if (policy.permissionLevel === 'BLOCK')
                blockPolicies.push(policy);
            else if (policy.permissionLevel === 'REQUIRE_APPROVAL')
                approvalPolicies.push(policy);
            else if (policy.permissionLevel === 'ALLOW')
                allowPolicies.push(policy);
        }
        if (blockPolicies.length > 0) {
            decision = 'BLOCK';
            matchedPolicy = {
                policyId: blockPolicies[0].policyId,
                name: blockPolicies[0].name,
                permissionLevel: blockPolicies[0].permissionLevel,
                priority: blockPolicies[0].priority,
                action: blockPolicies[0].action,
            };
            reason = `Blocked by policy: ${blockPolicies[0].name} (zero-trust: action unknown)`;
        }
        else if (approvalPolicies.length > 0) {
            decision = 'REQUIRE_APPROVAL';
            matchedPolicy = {
                policyId: approvalPolicies[0].policyId,
                name: approvalPolicies[0].name,
                permissionLevel: approvalPolicies[0].permissionLevel,
                priority: approvalPolicies[0].priority,
                action: approvalPolicies[0].action,
            };
            reason = `Requires approval per policy: ${approvalPolicies[0].name} (zero-trust: action unknown)`;
        }
        else if (allowPolicies.length > 0) {
            decision = 'ALLOW';
            matchedPolicy = {
                policyId: allowPolicies[0].policyId,
                name: allowPolicies[0].name,
                permissionLevel: allowPolicies[0].permissionLevel,
                priority: allowPolicies[0].priority,
                action: allowPolicies[0].action,
            };
            reason = `Allowed by policy: ${allowPolicies[0].name}`;
        }
        else {
            decision = 'BLOCK';
            matchedPolicy = null;
            reason = 'No matching policy found (default deny: action unknown)';
        }
    }
    // If no policy matched at all and zero-trust is enabled, default deny
    if (!matchedPolicy && decision === 'ALLOW' && zeroTrust && matchingPolicies.length === 0) {
        decision = 'BLOCK';
        reason = 'No matching policy found (default deny)';
    }
    return { decision, matchedPolicy, reason, action };
}
//# sourceMappingURL=evaluate.js.map