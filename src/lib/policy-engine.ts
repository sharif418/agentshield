/**
 * Policy evaluation engine - pure functions extracted for testability.
 * These functions implement the core logic for condition evaluation,
 * action inference, argument enrichment, and action matching.
 *
 * This is the canonical source used by the API routes.
 * The packages/core/ package mirrors these same functions for SDK use.
 */

// Core types - defined inline to avoid cross-package import issues with Next.js
export type Decision = 'ALLOW' | 'BLOCK' | 'REQUIRE_APPROVAL';

export interface Policy {
  policyId: string;
  name: string;
  description?: string;
  agentRole: string;
  resource: string;
  action: string;
  permissionLevel: Decision;
  conditionRules?: string | Record<string, unknown> | null;
  priority: number;
  enabled: boolean;
}

export interface EvaluateRequest {
  agentRole: string;
  toolName: string;
  arguments?: Record<string, unknown>;
  action?: string;
  sessionId?: string;
}

export interface EvaluateResult {
  decision: Decision;
  traceId?: string;
  matchedPolicy: {
    policyId: string;
    name: string;
    permissionLevel: Decision;
    priority: number;
    action: string;
  } | null;
  reason: string | null;
  latency?: number;
  approvalRequestId?: string | null;
}

export interface Trace {
  traceId: string;
  sessionId: string;
  agentRole: string;
  toolName: string;
  intentPayload: string;
  evaluationResult: Decision;
  matchedPolicyId: string | null;
  latency: number;
  timestamp: Date;
}

// Backward-compatible aliases
export type PermissionLevel = Decision;
export type PolicyDefinition = Policy;
export type EvaluateInput = EvaluateRequest;

/**
 * Given a specific action, return all policy action values that should match it.
 * E.g., "REFUND" -> ["REFUND", "WRITE"], "SELECT" -> ["SELECT", "READ"]
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
    // Finance actions
    'REFUND': ['REFUND', 'WRITE'],
    'POST_MESSAGE': ['POST_MESSAGE', 'WRITE'],
    'SEND': ['SEND', 'WRITE'],
    'TRUNCATE': ['TRUNCATE', 'DROP', 'ADMIN', 'WRITE'],
  };

  // Always include the exact action itself
  const matches = actionMap[action] ?? [action];
  // Deduplicate and include original
  return [...new Set([action, ...matches])];
}

/**
 * Evaluate condition rules against provided arguments.
 * Supports: { field: "value" }, { field: { $contains: "value" } }, { $and: [...] }, { $or: [...] }
 * Also supports: $equals, $in, $gt, $lt operators
 */
export function evaluateConditions(rules: Record<string, unknown>, args: Record<string, unknown>): boolean {
  // Handle logical operators
  if (rules.$and && Array.isArray(rules.$and)) {
    return (rules.$and as Record<string, unknown>[]).every((r) => evaluateConditions(r, args));
  }
  if (rules.$or && Array.isArray(rules.$or)) {
    return (rules.$or as Record<string, unknown>[]).some((r) => evaluateConditions(r, args));
  }

  // Handle field conditions
  for (const [field, condition] of Object.entries(rules)) {
    if (field.startsWith('$')) continue; // Skip logical operators already handled

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
      // Simple equality check
      if (argValue !== condition) return false;
    }
  }

  return true;
}

/**
 * Infer the action from the arguments and tool name when no explicit action is provided.
 * This enables the policy engine to make accurate decisions even when the caller
 * doesn't specify the action directly.
 */
export function inferAction(args: Record<string, unknown>, toolName: string): string | null {
  // Check explicit operation/action/method fields first
  if (args.operation) return String(args.operation).toUpperCase();
  if (args.action) return String(args.action).toUpperCase();
  if (args.method) return String(args.method).toUpperCase();

  // SQL query inference
  if (args.query && typeof args.query === 'string') {
    const sqlKeyword = args.query.trim().split(/\s+/)[0]?.toUpperCase();
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

/**
 * Enrich args with inferred operation from SQL queries so that condition rules
 * can match. For example, {"query":"DROP TABLE users"} gets operation:"DROP_TABLE".
 */
export function enrichArgsFromQuery(args: Record<string, unknown>): Record<string, unknown> {
  // Only enrich if there's a query but no explicit operation
  if (!args.query || typeof args.query !== 'string' || args.operation) return args;

  const query = args.query as string;
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

/**
 * Parse condition rules from various formats into an object suitable for evaluateConditions.
 */
function parseConditionRules(
  conditionRules: string | Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!conditionRules) return null;
  if (typeof conditionRules === 'string') {
    try {
      return JSON.parse(conditionRules);
    } catch {
      return null;
    }
  }
  return conditionRules;
}

/**
 * Core policy evaluation function. Pure function - no DB, no side effects.
 * Shared between the API route and the SDK (embedded mode).
 *
 * @param policies - Array of policies to evaluate against
 * @param request - The evaluation request input
 * @param options - Optional evaluation options
 */
export function evaluatePolicies(
  policies: Policy[],
  request: EvaluateRequest,
  options: {
    /** When true and no policy matches, default to BLOCK instead of ALLOW. Default: true */
    zeroTrust?: boolean;
  } = {}
): Omit<EvaluateResult, 'traceId' | 'latency' | 'approvalRequestId'> & { action: string | null } {
  const { zeroTrust = true } = options;
  const { agentRole, toolName } = request;
  const rawArgs = request.arguments ?? {};

  const action = request.action ?? inferAction(rawArgs, toolName);
  const args = enrichArgsFromQuery(rawArgs);

  // Filter policies matching agentRole and resource
  const matchingPolicies = policies.filter(p => {
    if (!p.enabled) return false;
    if (p.agentRole !== '*' && p.agentRole !== agentRole) return false;
    if (p.resource !== toolName) return false;
    // If action specified, check action matches
    if (action) {
      const matchingActions = getMatchingActions(action);
      if (!matchingActions.includes(p.action)) return false;
    }
    return true;
  });

  // Sort by priority desc
  matchingPolicies.sort((a, b) => b.priority - a.priority);

  type Decision = 'ALLOW' | 'BLOCK' | 'REQUIRE_APPROVAL';
  let decision: Decision = 'ALLOW';
  let matchedPolicy: {
    policyId: string;
    name: string;
    permissionLevel: Decision;
    priority: number;
    action: string;
  } | null = null;
  let reason: string | null = null;

  if (action) {
    // Standard priority-based evaluation
    for (const policy of matchingPolicies) {
      let conditionMatches = true;
      if (policy.conditionRules) {
        const rules = parseConditionRules(policy.conditionRules as string | Record<string, unknown> | null);
        if (rules) {
          conditionMatches = evaluateConditions(rules, args);
        }
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
    // Zero-trust mode: action could not be inferred.
    const blockPolicies: typeof matchingPolicies = [];
    const approvalPolicies: typeof matchingPolicies = [];
    const allowPolicies: typeof matchingPolicies = [];

    for (const policy of matchingPolicies) {
      let conditionMatches = true;
      if (policy.conditionRules) {
        const rules = parseConditionRules(policy.conditionRules as string | Record<string, unknown> | null);
        if (rules) {
          conditionMatches = evaluateConditions(rules, args);
        }
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
    } else {
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
