/**
 * AgentShield Core Policy Engine
 *
 * Pure functions for policy evaluation, action inference, and condition matching.
 * These functions are framework-agnostic and can be used in any JavaScript/TypeScript
 * environment (Node.js, browser, Deno, Bun, etc.).
 *
 * This is the shared evaluation logic used by:
 * - The Next.js API route (server-side, with Prisma/DB)
 * - The SDK (embedded mode, with in-memory policy store)
 */

import type {
  PolicyDefinition,
  PermissionLevel,
  ConditionRule,
  EvaluateInput,
  EvaluateResult,
  MatchedPolicy,
} from './types.js';

// ---------------------------------------------------------------------------
// Action matching
// ---------------------------------------------------------------------------

/**
 * Given a specific action, return all policy action values that should match it.
 * E.g., "REFUND" → ["REFUND", "WRITE"], "SELECT" → ["SELECT", "READ", "GET", "LIST", "SEARCH"]
 */
export function getMatchingActions(action: string): string[] {
  const actionMap: Record<string, string[]> = {
    // Read-type actions
    'SELECT': ['SELECT', 'READ', 'GET', 'LIST', 'SEARCH'],
    'READ': ['READ', 'SELECT', 'GET', 'LIST', 'SEARCH'],
    'GET': ['GET', 'READ', 'SELECT'],
    'LIST': ['LIST', 'READ', 'SELECT'],
    'SEARCH': ['SEARCH', 'READ', 'SELECT'],
    // Write-type actions
    'INSERT': ['INSERT', 'WRITE', 'INSERT_UPDATE_DELETE'],
    'UPDATE': ['UPDATE', 'WRITE', 'INSERT_UPDATE_DELETE'],
    'DELETE': ['DELETE', 'WRITE', 'INSERT_UPDATE_DELETE', 'ADMIN'],
    'WRITE': ['WRITE', 'INSERT', 'UPDATE', 'DELETE', 'INSERT_UPDATE_DELETE'],
    'INSERT_UPDATE_DELETE': ['INSERT_UPDATE_DELETE', 'WRITE', 'INSERT', 'UPDATE', 'DELETE'],
    // Admin-type actions
    'DROP': ['DROP', 'ADMIN', 'WRITE'],
    'ADMIN': ['ADMIN', 'DROP', 'DELETE', 'WRITE'],
    'PUSH': ['PUSH', 'WRITE'],
    'MERGE': ['MERGE', 'WRITE'],
    'DELETE_BRANCH': ['DELETE_BRANCH', 'WRITE', 'ADMIN'],
    'DELETE_REPO': ['DELETE_REPO', 'ADMIN', 'DELETE'],
    'CHANGE_SETTINGS': ['CHANGE_SETTINGS', 'ADMIN'],
    'ADD_COLLABORATOR': ['ADD_COLLABORATOR', 'ADMIN'],
    // Finance/communication actions
    'REFUND': ['REFUND', 'WRITE'],
    'POST_MESSAGE': ['POST_MESSAGE', 'WRITE'],
    'SEND': ['SEND', 'WRITE'],
    'TRUNCATE': ['TRUNCATE', 'DROP', 'ADMIN', 'WRITE'],
  };

  const matches = actionMap[action] ?? [action];
  return [...new Set([action, ...matches])];
}

// ---------------------------------------------------------------------------
// Condition evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate condition rules against provided arguments.
 * Supports:
 *   - Simple equality: { field: "value" }
 *   - $contains: { field: { $contains: "substring" } }
 *   - $equals:   { field: { $equals: "value" } }
 *   - $in:       { field: { $in: ["a", "b"] } }
 *   - $gt:       { field: { $gt: 100 } }
 *   - $lt:       { field: { $lt: 100 } }
 *   - $and:      { $and: [rule1, rule2] }
 *   - $or:       { $or: [rule1, rule2] }
 */
export function evaluateConditions(
  rules: ConditionRule,
  args: Record<string, unknown>
): boolean {
  const rulesObj = rules as Record<string, unknown>;

  // Handle logical operators
  if (rulesObj.$and && Array.isArray(rulesObj.$and)) {
    return (rulesObj.$and as ConditionRule[]).every((r) =>
      evaluateConditions(r, args)
    );
  }
  if (rulesObj.$or && Array.isArray(rulesObj.$or)) {
    return (rulesObj.$or as ConditionRule[]).some((r) =>
      evaluateConditions(r, args)
    );
  }

  // Handle field conditions
  for (const [field, condition] of Object.entries(rulesObj)) {
    if (field.startsWith('$')) continue;

    const argValue = args[field];

    if (typeof condition === 'object' && condition !== null) {
      const cond = condition as Record<string, unknown>;

      if (cond.$contains && typeof argValue === 'string') {
        if (!(argValue as string).includes(cond.$contains as string)) return false;
      } else if (cond.$equals !== undefined) {
        if (argValue !== cond.$equals) return false;
      } else if (cond.$in && Array.isArray(cond.$in)) {
        if (!cond.$in.includes(argValue)) return false;
      } else if (cond.$gt !== undefined && typeof argValue === 'number') {
        if (argValue <= (cond.$gt as number)) return false;
      } else if (cond.$lt !== undefined && typeof argValue === 'number') {
        if (argValue >= (cond.$lt as number)) return false;
      }
    } else {
      if (argValue !== condition) return false;
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// Action inference
// ---------------------------------------------------------------------------

/**
 * Infer the action from the arguments and tool name when no explicit action is provided.
 * This enables the policy engine to make accurate decisions even when the caller
 * doesn't specify the action directly.
 */
export function inferAction(
  args: Record<string, unknown>,
  toolName: string
): string | null {
  // Check explicit operation/action/method fields first
  if (args.operation) return String(args.operation).toUpperCase();
  if (args.action) return String(args.action).toUpperCase();
  if (args.method) return String(args.method).toUpperCase();

  // SQL query inference
  if (args.query && typeof args.query === 'string') {
    const sqlKeyword = (args.query as string).trim().split(/\s+/)[0]?.toUpperCase();
    const sqlActionMap: Record<string, string> = {
      'SELECT': 'SELECT', 'INSERT': 'INSERT', 'UPDATE': 'UPDATE',
      'DELETE': 'DELETE', 'DROP': 'DROP', 'TRUNCATE': 'TRUNCATE',
      'ALTER': 'ADMIN', 'CREATE': 'ADMIN', 'GRANT': 'ADMIN',
    };
    if (sqlKeyword && sqlActionMap[sqlKeyword]) return sqlActionMap[sqlKeyword];
  }

  // HTTP method inference
  if (args.httpMethod) return String(args.httpMethod).toUpperCase();

  // Email-specific inference
  if (toolName === 'EmailAPI' && args.to) return 'SEND';
  if (toolName === 'EmailAPI') return 'READ';

  // Slack-specific inference
  if (toolName === 'SlackAPI' && args.channel && args.text) return 'POST_MESSAGE';
  if (toolName === 'SlackAPI') return 'READ';

  return null;
}

// ---------------------------------------------------------------------------
// Argument enrichment
// ---------------------------------------------------------------------------

/**
 * Enrich args with inferred operation from SQL queries so that condition rules
 * can match. For example, {"query":"DROP TABLE users"} gets operation:"DROP_TABLE".
 */
export function enrichArgsFromQuery(
  args: Record<string, unknown>
): Record<string, unknown> {
  if (!(args as Record<string, unknown>).query || typeof (args as Record<string, unknown>).query !== 'string' || (args as Record<string, unknown>).operation) return args;

  const query = (args as Record<string, unknown>).query as string;
  const upper = query.trim().toUpperCase();

  const sqlOperationMap: { re: RegExp; op: string }[] = [
    { re: /^DROP\s+TABLE/, op: 'DROP_TABLE' },
    { re: /^DROP\s+DATABASE/, op: 'DROP_DATABASE' },
    { re: /^DROP\s/, op: 'DROP' },
    { re: /^TRUNCATE/, op: 'TRUNCATE' },
    { re: /^ALTER/, op: 'ALTER' },
    { re: /^CREATE/, op: 'CREATE' },
    { re: /^GRANT/, op: 'GRANT' },
    { re: /^INSERT/, op: 'INSERT' },
    { re: /^UPDATE/, op: 'UPDATE' },
    { re: /^DELETE/, op: 'DELETE' },
    { re: /^SELECT/, op: 'SELECT' },
  ];

  for (const { re, op } of sqlOperationMap) {
    if (re.test(upper)) {
      return { ...args, operation: op };
    }
  }

  return args;
}

// ---------------------------------------------------------------------------
// Policy evaluation orchestrator
// ---------------------------------------------------------------------------

/**
 * Evaluate policies against the given input and return a decision.
 *
 * This is the main evaluation function that implements:
 * 1. Action inference (from arguments and tool name)
 * 2. Policy matching (by agent role, resource, and action)
 * 3. Condition evaluation (against the enriched arguments)
 * 4. Priority-based decision making (BLOCK > REQUIRE_APPROVAL > ALLOW)
 * 5. Zero-trust mode (no matching policy = default deny)
 *
 * @param policies - Array of policies to evaluate against
 * @param input - The evaluation request input
 * @param options - Evaluation options
 * @returns The evaluation result
 */
export function evaluatePolicies(
  policies: PolicyDefinition[],
  input: EvaluateInput,
  options: {
    zeroTrust?: boolean;
  } = {}
): Omit<EvaluateResult, 'traceId' | 'latencyMs' | 'approvalRequestId'> {
  const { zeroTrust = true } = options;
  const startTime = performance.now();

  const rawArgs = input.arguments ?? {};
  const action =
    input.action ?? inferAction(rawArgs, input.toolName);
  const args = enrichArgsFromQuery(rawArgs);

  // Find matching policies: enabled, matching agentRole (or wildcard), matching resource
  const matchingPolicies = policies.filter((p) => {
    if (!p.enabled) return false;
    if (p.agentRole !== '*' && p.agentRole !== input.agentRole) return false;
    if (p.resource !== input.toolName) return false;

    // If action is specified, check action matching
    if (action) {
      const matchingActions = getMatchingActions(action);
      if (!matchingActions.includes(p.action)) return false;
    }

    return true;
  });

  // Sort by priority (descending)
  matchingPolicies.sort((a, b) => b.priority - a.priority);

  let decision: PermissionLevel = 'ALLOW';
  let matchedPolicy: MatchedPolicy | null = null;
  let reason = '';

  if (action) {
    // Standard priority-based evaluation
    for (const policy of matchingPolicies) {
      // Check condition rules
      let conditionMatches = true;
      if (policy.conditionRules) {
        conditionMatches = evaluateConditions(policy.conditionRules, args);
      }
      if (!conditionMatches) continue;

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
  } else {
    // Zero-trust mode: action could not be inferred
    const blockPolicies: PolicyDefinition[] = [];
    const approvalPolicies: PolicyDefinition[] = [];
    const allowPolicies: PolicyDefinition[] = [];

    for (const policy of matchingPolicies) {
      let conditionMatches = true;
      if (policy.conditionRules) {
        conditionMatches = evaluateConditions(policy.conditionRules, args);
      }
      if (!conditionMatches) continue;

      if (policy.permissionLevel === 'BLOCK') blockPolicies.push(policy);
      else if (policy.permissionLevel === 'REQUIRE_APPROVAL') approvalPolicies.push(policy);
      else if (policy.permissionLevel === 'ALLOW') allowPolicies.push(policy);
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
    } else if (approvalPolicies.length > 0) {
      decision = 'REQUIRE_APPROVAL';
      matchedPolicy = {
        policyId: approvalPolicies[0].policyId,
        name: approvalPolicies[0].name,
        permissionLevel: approvalPolicies[0].permissionLevel,
        priority: approvalPolicies[0].priority,
        action: approvalPolicies[0].action,
      };
      reason = `Requires approval per policy: ${approvalPolicies[0].name} (zero-trust: action unknown)`;
    } else if (allowPolicies.length > 0) {
      decision = 'ALLOW';
      matchedPolicy = {
        policyId: allowPolicies[0].policyId,
        name: allowPolicies[0].name,
        permissionLevel: allowPolicies[0].permissionLevel,
        priority: allowPolicies[0].priority,
        action: allowPolicies[0].action,
      };
      reason = `Allowed by policy: ${allowPolicies[0].name}`;
    } else if (zeroTrust) {
      decision = 'BLOCK';
      matchedPolicy = null;
      reason = 'No matching policy found (default deny: action unknown)';
    } else {
      decision = 'ALLOW';
      matchedPolicy = null;
      reason = 'No matching policy found (default allow)';
    }
  }

  // If no policy matched at all and zero-trust is enabled, default deny
  if (!matchedPolicy && decision === 'ALLOW' && zeroTrust && matchingPolicies.length === 0) {
    decision = 'BLOCK';
    reason = 'No matching policy found (default deny)';
  }

  return {
    decision,
    reason,
    matchedPolicy,
    action,
  };
}
