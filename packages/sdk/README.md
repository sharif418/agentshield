# agentshield

[![npm version](https://img.shields.io/npm/v/agentshield.svg)](https://www.npmjs.com/package/agentshield) [![license](https://img.shields.io/npm/l/agentshield.svg)](https://github.com/agentshield/agentshield/blob/main/LICENSE) [![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)

Deterministic runtime policy engine for AI agents. Intercept, evaluate, and govern every tool call your agents make.

## Installation

```bash
npm install agentshield
```

## Quick Start

### Embedded Mode (No Server Needed)

Run the policy engine entirely in-memory. Ideal for serverless functions, edge runtimes, or lightweight integrations.

```typescript
import { AgentShield } from 'agentshield';

const shield = new AgentShield({
  mode: 'embedded',
  policies: [
    {
      policyId: 'POL-001',
      name: 'Block DROP on PostgreSQL',
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
    {
      policyId: 'POL-003',
      name: 'Allow SELECT queries',
      agentRole: 'DataAgent',
      resource: 'PostgreSQL',
      action: 'READ',
      permissionLevel: 'ALLOW',
      priority: 5,
      enabled: true,
    },
  ],
});

// Evaluate a tool call
const result = await shield.evaluate({
  agentRole: 'DataAgent',
  toolName: 'PostgreSQL',
  arguments: { query: 'DROP TABLE users' },
});

console.log(result.decision); // 'BLOCK'
console.log(result.reason);   // 'Blocked by policy: Block DROP on PostgreSQL'
```

### Hosted Mode (Connects to Server)

Connect to a running AgentShield server for centralized policy management, persistent storage, and audit trails.

```typescript
import { AgentShield } from 'agentshield';

const shield = new AgentShield({
  mode: 'hosted',
  serverUrl: 'https://agentshield.example.com',
  apiKey: 'sk-...',
});

const result = await shield.evaluate({
  agentRole: 'DataAgent',
  toolName: 'PostgreSQL',
  action: 'DROP',
  arguments: { query: 'DROP TABLE users' },
});

console.log(result.decision); // 'BLOCK'
console.log(result.traceId);  // 'TRC-...'
```

### Convenience Factory

```typescript
import { createAgentShield } from 'agentshield';

const shield = createAgentShield({
  mode: 'embedded',
  policies: [/* ... */],
  defaultAgentRole: 'DataAgent',
  zeroTrust: true,
});
```

## Managing Policies (Embedded Mode)

```typescript
const shield = new AgentShield({
  mode: 'embedded',
  policies: [],
});

// Create a policy
const policy = await shield.createPolicy({
  name: 'Block SQL DROP',
  agentRole: 'DataAgent',
  resource: 'PostgreSQL',
  action: 'DROP',
  permissionLevel: 'BLOCK',
  priority: 20,
});

// Add or update a policy
shield.addPolicy({
  policyId: 'POL-004',
  name: 'Allow reads',
  agentRole: '*',
  resource: 'PostgreSQL',
  action: 'READ',
  permissionLevel: 'ALLOW',
  priority: 5,
  enabled: true,
});

// List policies
const all = await shield.listPolicies();
const filtered = await shield.listPolicies({ agentRole: 'DataAgent' });

// Get a specific policy
const p = await shield.getPolicy('POL-004');

// Remove a policy
shield.removePolicy('POL-004');

// Replace all policies at once
shield.setPolicies([/* new policy set */]);

// Count
console.log(shield.policyCount); // number | undefined
```

## Managing Policies (Hosted Mode)

In hosted mode, policy management delegates to the server via HTTP:

```typescript
const shield = new AgentShield({
  mode: 'hosted',
  serverUrl: 'https://agentshield.example.com',
  apiKey: 'sk-...',
});

await shield.createPolicy({ name: 'New Policy', /* ... */ });
await shield.listPolicies({ enabled: true });
await shield.getPolicy('POL-001');
await shield.deletePolicy('POL-001');
```

## Execution Traces

```typescript
// Get a specific trace
const trace = await shield.getTrace('TRC-abc123');

// List traces with filters
const traces = await shield.listTraces({
  sessionId: 'SES-xyz',
  agentRole: 'DataAgent',
  evaluationResult: 'BLOCK',
  limit: 50,
  offset: 0,
});
```

## Health Check

```typescript
const isUp = await shield.isHealthy();
```

## API Reference

### `AgentShield`

Main SDK class providing a unified API for evaluating AI agent tool calls against governance policies.

#### Constructor

```typescript
new AgentShield(config: AgentShieldConfig)
```

Throws if `serverUrl` is missing in hosted mode.

#### Methods

| Method | Returns | Description |
|---|---|---|
| `evaluate(request)` | `Promise<EvaluateResult>` | Evaluate a tool call against active policies |
| `createPolicy(params)` | `Promise<PolicyDefinition>` | Create a new policy |
| `listPolicies(params?)` | `Promise<PolicyDefinition[]>` | List policies with optional filters |
| `getPolicy(policyId)` | `Promise<PolicyDefinition \| undefined>` | Get a policy by ID |
| `deletePolicy(policyId)` | `Promise<boolean \| void>` | Delete a policy by ID |
| `getTrace(traceId)` | `Promise<Trace \| unknown>` | Get a trace by ID |
| `listTraces(params?)` | `Promise<Trace[] \| unknown>` | List traces with optional filters |
| `isHealthy()` | `Promise<boolean>` | Check health of client/engine |
| `addPolicy(policy)` | `void` | Add or update a policy (embedded only) |
| `removePolicy(policyId)` | `boolean` | Remove a policy (embedded only) |
| `setPolicies(policies)` | `void` | Replace all policies (embedded only) |

#### Properties

| Property | Type | Description |
|---|---|---|
| `mode` | `'hosted' \| 'embedded'` | Current operating mode |
| `policyCount` | `number \| undefined` | Number of stored policies (embedded only) |
| `traceCount` | `number \| undefined` | Number of stored traces (embedded only) |

### `createAgentShield(config)`

Convenience factory function that returns a new `AgentShield` instance.

### `HostedClient`

Low-level HTTP client for the AgentShield server. Used internally by `AgentShield` in hosted mode. Available for direct use if needed.

```typescript
import { HostedClient } from 'agentshield';

const client = new HostedClient('https://agentshield.example.com', 'sk-...');
await client.evaluate({ agentRole: 'Agent', toolName: 'Tool' });
```

### `EmbeddedEngine`

In-memory policy engine. Used internally by `AgentShield` in embedded mode. Available for direct use if needed.

```typescript
import { EmbeddedEngine } from 'agentshield';

const engine = new EmbeddedEngine(policies, /* zeroTrust: */ true);
const result = engine.evaluate({ agentRole: 'Agent', toolName: 'Tool' });
```

## Types

### `AgentShieldConfig`

```typescript
interface AgentShieldConfig {
  serverUrl?: string;           // Server URL (hosted mode)
  apiKey?: string;              // API key for authentication
  mode: 'hosted' | 'embedded'; // Operating mode
  policies?: Policy[];          // Initial policies (embedded mode)
  defaultAgentRole?: string;    // Default agent role for evaluate()
  defaultSessionId?: string;    // Default session ID
  zeroTrust?: boolean;          // Default deny when no match (default: true)
  fetch?: typeof fetch;         // Custom fetch (edge runtime, etc.)
}
```

### `PolicyCreateParams`

```typescript
interface PolicyCreateParams {
  policyId?: string;            // Auto-generated if omitted
  name: string;
  description?: string;
  agentRole: string;
  resource: string;
  action: string;
  permissionLevel: Decision;
  conditionRules?: string | Record<string, unknown>;
  priority?: number;            // Default: 0
  enabled?: boolean;            // Default: true
}
```

### `PolicyListParams`

```typescript
interface PolicyListParams {
  agentRole?: string;
  resource?: string;
  permissionLevel?: Decision;
  enabled?: boolean;
}
```

### `TraceListParams`

```typescript
interface TraceListParams {
  sessionId?: string;
  agentRole?: string;
  evaluationResult?: Decision;
  toolName?: string;
  limit?: number;
  offset?: number;
}
```

All core types (`Decision`, `Policy`, `EvaluateRequest`, `EvaluateResult`, `ConditionRule`, `MatchedPolicy`, `Trace`) are re-exported from `@agentshield/core`. See the [core package documentation](https://www.npmjs.com/package/@agentshield/core) for full type definitions.

## Re-exported Core Functions

The SDK re-exports all evaluation functions from `@agentshield/core` for advanced usage:

```typescript
import {
  evaluatePolicies,
  evaluateConditions,
  inferAction,
  enrichArgsFromQuery,
  getMatchingActions,
} from 'agentshield';
```

See [@agentshield/core](https://www.npmjs.com/package/@agentshield/core) for documentation on these functions.

## Related Packages

- **[@agentshield/core](https://www.npmjs.com/package/@agentshield/core)** — Low-level evaluation engine (used internally)
- **[@agentshield/langchain](https://www.npmjs.com/package/@agentshield/langchain)** — LangChain callback handler integration

## License

MIT
