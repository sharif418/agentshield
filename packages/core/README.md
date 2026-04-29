# @agentshieldhq/core

[![npm version](https://img.shields.io/npm/v/@agentshieldhq/core.svg)](https://www.npmjs.com/package/@agentshieldhq/core) [![license](https://img.shields.io/npm/l/@agentshieldhq/core.svg)](https://github.com/agentshield/agentshield/blob/main/LICENSE) [![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)

Deterministic policy evaluation engine for AI agent governance. Framework-agnostic, zero-dependency, and works in any JavaScript runtime.

This is the shared evaluation engine used by both the [`agentshield`](https://www.npmjs.com/package/agentshield) SDK and the AgentShield server. If you are building an application, you probably want the [SDK](https://www.npmjs.com/package/agentshield) instead. Use this package directly when you need low-level access to the evaluation functions.

## Installation

```bash
npm install @agentshieldhq/core
```

## Quick Start

```typescript
import { evaluatePolicies } from '@agentshieldhq/core';
import type { Policy, EvaluateRequest } from '@agentshieldhq/core';

const policies: Policy[] = [
  {
    policyId: 'POL-001',
    name: 'Block DROP on production database',
    agentRole: 'DataAgent',
    resource: 'PostgreSQL',
    action: 'DROP',
    permissionLevel: 'BLOCK',
    priority: 20,
    enabled: true,
  },
  {
    policyId: 'POL-002',
    name: 'Require approval for writes',
    agentRole: 'DataAgent',
    resource: 'PostgreSQL',
    action: 'WRITE',
    permissionLevel: 'REQUIRE_APPROVAL',
    priority: 10,
    enabled: true,
  },
];

const result = evaluatePolicies(policies, {
  agentRole: 'DataAgent',
  toolName: 'PostgreSQL',
  arguments: { query: 'DROP TABLE users' },
});

console.log(result.decision); // 'BLOCK'
console.log(result.reason);   // 'Blocked by policy: Block DROP on production database'
console.log(result.action);   // 'DROP'
```

## Condition Rules

Policies support fine-grained condition matching with logical operators and field matchers:

```typescript
import { evaluatePolicies, evaluateConditions } from '@agentshieldhq/core';

const policies = [
  {
    policyId: 'POL-003',
    name: 'Block writes to production tables',
    agentRole: 'DataAgent',
    resource: 'PostgreSQL',
    action: 'WRITE',
    permissionLevel: 'BLOCK',
    priority: 30,
    enabled: true,
    conditionRules: {
      $or: [
        { table: { $equals: 'users' } },
        { table: { $in: ['accounts', 'transactions'] } },
      ],
    },
  },
];

// Matches - table is 'users'
const result = evaluatePolicies(policies, {
  agentRole: 'DataAgent',
  toolName: 'PostgreSQL',
  arguments: { query: 'UPDATE users SET ...', table: 'users' },
});
console.log(result.decision); // 'BLOCK'

// Does not match - table is 'logs' (falls through to default deny)
const result2 = evaluatePolicies(policies, {
  agentRole: 'DataAgent',
  toolName: 'PostgreSQL',
  arguments: { query: 'UPDATE logs SET ...', table: 'logs' },
});
```

### Standalone Condition Evaluation

Use `evaluateConditions` directly for custom logic:

```typescript
import { evaluateConditions } from '@agentshieldhq/core';

const rules = {
  $and: [
    { environment: 'production' },
    { query: { $contains: 'DROP' } },
  ],
};

const args = { environment: 'production', query: 'DROP TABLE users' };
console.log(evaluateConditions(rules, args)); // true
```

## Action Inference

When no explicit `action` is provided, the engine automatically infers it from arguments and tool names:

```typescript
import { inferAction, getMatchingActions } from '@agentshieldhq/core';

// Infer from SQL query
inferAction({ query: 'DROP TABLE users' }, 'PostgreSQL'); // 'DROP'
inferAction({ query: 'SELECT * FROM users' }, 'PostgreSQL'); // 'SELECT'

// Infer from operation field
inferAction({ operation: 'WRITE' }, 'API'); // 'WRITE'

// Get all actions that should match a given action
getMatchingActions('SELECT'); // ['SELECT', 'READ', 'GET', 'LIST', 'SEARCH']
getMatchingActions('DROP');   // ['DROP', 'ADMIN', 'WRITE']
getMatchingActions('REFUND'); // ['REFUND', 'WRITE']
```

### Argument Enrichment

SQL queries are automatically enriched with an inferred operation for condition matching:

```typescript
import { enrichArgsFromQuery } from '@agentshieldhq/core';

const args = { query: 'DROP TABLE users' };
const enriched = enrichArgsFromQuery(args);
// { query: 'DROP TABLE users', operation: 'DROP_TABLE' }
```

## Zero-Trust Mode

By default, `evaluatePolicies` runs in zero-trust mode — if no policy matches, the decision is `BLOCK`:

```typescript
// Zero-trust (default): no matching policy -> BLOCK
evaluatePolicies([], { agentRole: 'Agent', toolName: 'Tool' });

// Disable zero-trust: no matching policy -> ALLOW
evaluatePolicies([], { agentRole: 'Agent', toolName: 'Tool' }, { zeroTrust: false });
```

## API Reference

### Functions

#### `evaluatePolicies(policies, request, options?)`

Core policy evaluation function. Pure — no side effects, no database.

| Parameter | Type | Description |
|---|---|---|
| `policies` | `Policy[]` | Array of policies to evaluate against |
| `request` | `EvaluateRequest` | The evaluation request input |
| `options.zeroTrust` | `boolean` | Default deny when no policy matches (default: `true`) |

Returns `Omit<EvaluateResult, 'traceId' | 'latency' | 'approvalRequestId'> & { action: string | null }`.

#### `evaluateConditions(rules, args)`

Evaluate condition rules against provided arguments.

| Parameter | Type | Description |
|---|---|---|
| `rules` | `Record<string, unknown>` | Condition rules object |
| `args` | `Record<string, unknown>` | Arguments to match against |

Returns `boolean`.

**Supported operators:**

| Operator | Example | Description |
|---|---|---|
| `$and` | `{ $and: [{ env: 'prod' }, { op: 'WRITE' }] }` | All conditions must match |
| `$or` | `{ $or: [{ env: 'staging' }, { env: 'prod' }] }` | Any condition must match |
| `$contains` | `{ query: { $contains: 'DROP' } }` | String contains check |
| `$equals` | `{ table: { $equals: 'users' } }` | Strict equality |
| `$in` | { table: { $in: ['users', 'accounts'] } }` | Value in array |
| `$gt` | `{ amount: { $gt: 1000 } }` | Greater than |
| `$lt` | `{ amount: { $lt: 100 } }` | Less than |

Simple equality is also supported: `{ environment: 'production' }`.

#### `inferAction(args, toolName)`

Infer the action from arguments and tool name.

| Parameter | Type | Description |
|---|---|---|
| `args` | `Record<string, unknown>` | Tool call arguments |
| `toolName` | `string` | Name of the tool being called |

Returns `string | null`.

#### `enrichArgsFromQuery(args)`

Enrich arguments with an inferred operation from SQL queries.

| Parameter | Type | Description |
|---|---|---|
| `args` | `Record<string, unknown>` | Arguments that may contain a `query` field |

Returns `Record<string, unknown>`.

#### `getMatchingActions(action)`

Get all policy action values that should match a given action.

| Parameter | Type | Description |
|---|---|---|
| `action` | `string` | The action to expand |

Returns `string[]`.

### Types

#### `Decision`

```typescript
type Decision = 'ALLOW' | 'BLOCK' | 'REQUIRE_APPROVAL';
```

#### `Policy`

```typescript
interface Policy {
  policyId: string;
  name: string;
  description?: string;
  agentRole: string;       // Use '*' for wildcard
  resource: string;
  action: string;
  permissionLevel: Decision;
  conditionRules?: string | ConditionRule | Record<string, unknown> | null;
  priority: number;        // Higher = evaluated first
  enabled: boolean;
}
```

#### `EvaluateRequest`

```typescript
interface EvaluateRequest {
  agentRole: string;
  toolName: string;
  arguments?: Record<string, unknown>;
  action?: string;         // Auto-inferred if omitted
  sessionId?: string;
}
```

#### `EvaluateResult`

```typescript
interface EvaluateResult {
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
  action: string | null;
  latency?: number;
  approvalRequestId?: string | null;
}
```

#### `ConditionRule`

```typescript
type ConditionRule =
  | { $and: ConditionRule[] }
  | { $or: ConditionRule[] }
  | Record<string, unknown>;
```

#### `Trace`

```typescript
interface Trace {
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
```

#### Deprecated Aliases

| Deprecated | Use Instead |
|---|---|
| `PermissionLevel` | `Decision` |
| `PolicyDefinition` | `Policy` |
| `EvaluateInput` | `EvaluateRequest` |

## Related Packages

- **[agentshield](https://www.npmjs.com/package/agentshield)** — Full SDK with hosted and embedded modes
- **[@agentshieldhq/langchain](https://www.npmjs.com/package/@agentshieldhq/langchain)** — LangChain callback handler integration

## License

MIT
