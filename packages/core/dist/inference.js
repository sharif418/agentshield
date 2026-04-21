/**
 * Action inference and argument enrichment logic.
 * Extracted from policy-engine.ts for shared use across SDK and API routes.
 */
/**
 * Given a specific action, return all policy action values that should match it.
 * E.g., "REFUND" -> ["REFUND", "WRITE"], "SELECT" -> ["SELECT", "READ", "GET", "LIST", "SEARCH"]
 */
export function getMatchingActions(action) {
    const actionMap = {
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
 * Infer the action from the arguments and tool name when no explicit action is provided.
 * This enables the policy engine to make accurate decisions even when the caller
 * doesn't specify the action directly.
 */
export function inferAction(args, toolName) {
    // Check explicit operation/action/method fields first
    if (args.operation)
        return String(args.operation).toUpperCase();
    if (args.action)
        return String(args.action).toUpperCase();
    if (args.method)
        return String(args.method).toUpperCase();
    // SQL query inference
    if (args.query && typeof args.query === 'string') {
        const sqlKeyword = args.query.trim().split(/\s+/)[0]?.toUpperCase();
        const sqlActionMap = {
            'SELECT': 'SELECT', 'INSERT': 'INSERT', 'UPDATE': 'UPDATE',
            'DELETE': 'DELETE', 'DROP': 'DROP', 'TRUNCATE': 'TRUNCATE',
            'ALTER': 'ADMIN', 'CREATE': 'ADMIN', 'GRANT': 'ADMIN',
        };
        if (sqlKeyword && sqlActionMap[sqlKeyword])
            return sqlActionMap[sqlKeyword];
    }
    // HTTP method inference
    if (args.httpMethod)
        return String(args.httpMethod).toUpperCase();
    // Email-specific inference
    if (toolName === 'EmailAPI' && args.to)
        return 'SEND';
    if (toolName === 'EmailAPI')
        return 'READ';
    // Slack-specific inference
    if (toolName === 'SlackAPI' && args.channel && args.text)
        return 'POST_MESSAGE';
    if (toolName === 'SlackAPI')
        return 'READ';
    return null;
}
/**
 * Enrich args with inferred operation from SQL queries so that condition rules
 * can match. For example, {"query":"DROP TABLE users"} gets operation:"DROP_TABLE".
 */
export function enrichArgsFromQuery(args) {
    // Only enrich if there's a query but no explicit operation
    if (!args.query || typeof args.query !== 'string' || args.operation)
        return args;
    const query = args.query;
    const upper = query.trim().toUpperCase();
    const sqlOperationMap = [
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
//# sourceMappingURL=inference.js.map