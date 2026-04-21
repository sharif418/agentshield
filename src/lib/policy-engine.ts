/**
 * Policy evaluation engine - pure functions extracted for testability.
 * These functions implement the core logic for condition evaluation,
 * action inference, argument enrichment, and action matching.
 */

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
