# @agentshield/langchain

[![npm version](https://img.shields.io/npm/v/@agentshield/langchain.svg)](https://www.npmjs.com/package/@agentshield/langchain) [![license](https://img.shields.io/npm/l/@agentshield/langchain.svg)](https://github.com/agentshield/agentshield/blob/main/LICENSE) [![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)

LangChain callback handler for AI agent policy governance. Automatically intercepts tool calls and evaluates them through AgentShield's policy engine.

## Installation

```bash
npm install @agentshield/langchain
```

**Peer dependency:** `langchain >= 0.1.0` (optional — the handler works with any callback system that calls `handleToolStart` / `handleToolEnd`).

## Quick Start

### Embedded Mode (No Server Needed)

```typescript
import { AgentShieldCallbackHandler } from '@agentshield/langchain';
import { AgentExecutor } from 'langchain/agents';

const handler = new AgentShieldCallbackHandler({
  mode: 'embedded',
  policies: [
    {
      policyId: 'POL-001',
      name: 'Block SQL DROP',
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
  ],
  defaultAgentRole: 'DataAgent',
  toolNameMap: { 'sql_db_query': 'PostgreSQL' },
});

// Attach to an AgentExecutor
const executor = AgentExecutor.fromAgentAndTools({
  agent,
  tools,
  callbacks: [handler],
});
```

### Hosted Mode (Connects to Server)

```typescript
import { AgentShieldCallbackHandler } from '@agentshield/langchain';

const handler = new AgentShieldCallbackHandler({
  serverUrl: 'https://agentshield.example.com',
  mode: 'hosted',
  apiKey: 'sk-...',
  defaultAgentRole: 'CodeAgent',
  onBlock: 'return',
  onRequireApproval: 'allow',
});

const executor = AgentExecutor.fromAgentAndTools({
  agent,
  tools,
  callbacks: [handler],
});
```

### With LangGraph

```typescript
const handler = new AgentShieldCallbackHandler({
  mode: 'embedded',
  policies: [/* ... */],
  defaultAgentRole: 'ResearchAgent',
});

const result = await graph.invoke(
  { messages: [/* ... */] },
  { callbacks: [handler] }
);
```

## Configuration

### `AgentShieldLangChainConfig`

Extends the base `AgentShieldConfig` with LangChain-specific options:

```typescript
interface AgentShieldLangChainConfig extends AgentShieldConfig {
  /** What to do when a tool call is blocked.
   *  - 'throw' — throw AgentShieldBlockError (default)
   *  - 'return' — replace tool output with block message
   */
  onBlock?: 'throw' | 'return';

  /** What to do when a tool call requires approval.
   *  - 'throw' — throw AgentShieldApprovalError (default)
   *  - 'return' — replace tool output with approval message
   *  - 'allow' — let the tool call through (async approval workflow)
   */
  onRequireApproval?: 'throw' | 'return' | 'allow';

  /** Custom block message template.
   *  Variables: {toolName}, {reason}, {agentRole}
   *  @default 'Tool call blocked by AgentShield: {toolName} - {reason}'
   */
  blockMessage?: string;

  /** Custom approval message template.
   *  Variables: {toolName}, {reason}, {approvalRequestId}, {agentRole}
   *  @default 'Tool call requires approval: {toolName} - {reason} (Request: {approvalRequestId})'
   */
  approvalMessage?: string;

  /** Map LangChain tool names to AgentShield resource names.
   *  e.g., { 'sql_db_query': 'PostgreSQL', 'requests_get': 'HTTPClient' }
   */
  toolNameMap?: Record<string, string>;

  /** Map LangChain agent names to AgentShield agent roles.
   *  e.g., { 'sql-agent': 'DataAgent' }
   *  Checked against metadata/tags passed in handleToolStart.
   */
  agentRoleMap?: Record<string, string>;

  /** Default agent role if none can be inferred.
   *  @default 'DefaultAgent'
   */
  defaultAgentRole?: string;

  /** Callback invoked after every evaluation.
   *  Useful for logging, metrics, or custom side effects.
   */
  onEvaluate?: (event: AgentShieldEvent) => void;
}
```

### Base Config (from AgentShield)

These fields are also available since `AgentShieldLangChainConfig` extends `AgentShieldConfig`:

| Field | Type | Description |
|---|---|---|
| `mode` | `'hosted' \| 'embedded'` | Operating mode (auto-detected if omitted) |
| `serverUrl` | `string` | Server URL for hosted mode |
| `apiKey` | `string` | API key for hosted mode |
| `policies` | `Policy[]` | Initial policies for embedded mode |
| `zeroTrust` | `boolean` | Default deny when no policy matches (default: `true`) |
| `fetch` | `typeof fetch` | Custom fetch function (edge runtime, etc.) |

## Tool Name Mapping

Map LangChain tool names to the resource names used in your policies:

```typescript
const handler = new AgentShieldCallbackHandler({
  mode: 'embedded',
  policies: [
    {
      policyId: 'POL-001',
      name: 'Block SQL DROP',
      agentRole: 'DataAgent',
      resource: 'PostgreSQL',  // <-- policies reference this name
      action: 'DROP',
      permissionLevel: 'BLOCK',
      priority: 20,
      enabled: true,
    },
  ],
  toolNameMap: {
    'sql_db_query': 'PostgreSQL',       // LangChain tool -> AgentShield resource
    'sql_db_schema': 'PostgreSQL',
    'requests_get': 'HTTPClient',
  },
});
```

## Agent Role Mapping

Map LangChain agent names to AgentShield roles using metadata or tags:

```typescript
const handler = new AgentShieldCallbackHandler({
  mode: 'embedded',
  policies: [/* ... */],
  agentRoleMap: {
    'sql-agent': 'DataAgent',
    'code-agent': 'CodeAgent',
    'research-agent': 'ResearchAgent',
  },
  defaultAgentRole: 'DefaultAgent',
});
```

## Evaluation Callback

Hook into every evaluation for logging, metrics, or side effects:

```typescript
const handler = new AgentShieldCallbackHandler({
  mode: 'embedded',
  policies: [/* ... */],
  onEvaluate: (event) => {
    console.log(`[${event.result.decision}] ${event.agentRole} -> ${event.toolName}`);
    // Send to your observability platform
    metrics.increment(`agentshield.${event.result.decision.toLowerCase()}`);
  },
});
```

The `AgentShieldEvent` object contains:

| Field | Type | Description |
|---|---|---|
| `result` | `EvaluateResult` | The evaluation result from AgentShield |
| `toolName` | `string` | The LangChain tool name |
| `shieldResource` | `string` | The AgentShield resource name (after mapping) |
| `agentRole` | `string` | The resolved agent role |
| `args` | `Record<string, unknown>` | The arguments passed to the tool |
| `timestamp` | `Date` | When the evaluation occurred |

## Error Classes

### `AgentShieldBlockError`

Thrown when a tool call is blocked and `onBlock` is `'throw'` (default).

```typescript
import { AgentShieldBlockError } from '@agentshield/langchain';

try {
  // ... agent execution
} catch (error) {
  if (error instanceof AgentShieldBlockError) {
    console.log(error.toolName);     // 'sql_db_query'
    console.log(error.agentRole);    // 'DataAgent'
    console.log(error.result);       // EvaluateResult object
    console.log(error.result.reason); // 'Blocked by policy: Block SQL DROP'
  }
}
```

Properties:

| Property | Type | Description |
|---|---|---|
| `result` | `EvaluateResult` | The evaluation result that caused the block |
| `toolName` | `string` | The tool name that was blocked |
| `agentRole` | `string` | The agent role that was blocked |

### `AgentShieldApprovalError`

Thrown when a tool call requires approval and `onRequireApproval` is `'throw'` (default).

```typescript
import { AgentShieldApprovalError } from '@agentshield/langchain';

try {
  // ... agent execution
} catch (error) {
  if (error instanceof AgentShieldApprovalError) {
    console.log(error.toolName);                   // 'sql_db_query'
    console.log(error.agentRole);                  // 'DataAgent'
    console.log(error.result.approvalRequestId);   // 'APR-abc123'
  }
}
```

Properties:

| Property | Type | Description |
|---|---|---|
| `result` | `EvaluateResult` | The evaluation result that triggered the approval |
| `toolName` | `string` | The tool name that requires approval |
| `agentRole` | `string` | The agent role that requires approval |

## Utility Methods

### `toCallbacks()`

Get the handler as a plain callback object for LangChain compatibility:

```typescript
const handler = new AgentShieldCallbackHandler({ /* ... */ });

// Use as a plain object instead of class instance
const callbacks = handler.toCallbacks();
```

### `getShield()`

Access the underlying `AgentShield` instance for direct operations:

```typescript
const handler = new AgentShieldCallbackHandler({
  mode: 'embedded',
  policies: [/* ... */],
});

// Add policies at runtime
handler.getShield().addPolicy({
  policyId: 'POL-DYN',
  name: 'Runtime policy',
  agentRole: 'DataAgent',
  resource: 'PostgreSQL',
  action: 'DROP',
  permissionLevel: 'BLOCK',
  priority: 50,
  enabled: true,
});

// Check health
const healthy = await handler.getShield().isHealthy();
```

## API Reference

### `AgentShieldCallbackHandler`

LangChain-compatible callback handler that intercepts tool calls and evaluates them through AgentShield.

#### Constructor

```typescript
new AgentShieldCallbackHandler(config?: AgentShieldLangChainConfig)
```

If `mode` is not specified, it defaults to `'embedded'` unless `serverUrl` is provided.

#### Callback Methods (LangChain Interface)

| Method | Description |
|---|---|
| `handleToolStart(tool, input, runId?, parentRunId?, tags?, metadata?, kwargs?)` | Evaluates the tool call before execution |
| `handleToolEnd(output, runId?, parentRunId?, tags?)` | Replaces output if the call was intercepted |
| `handleToolError(error, runId?, parentRunId?, tags?)` | Cleans up interception state on error |

#### Utility Methods

| Method | Returns | Description |
|---|---|---|
| `toCallbacks()` | `Record<string, unknown>` | Get handler as a plain callback object |
| `getShield()` | `AgentShield` | Access the underlying AgentShield instance |

## Re-exported Types

All core types are re-exported for convenience:

```typescript
import type {
  Decision,
  Policy,
  PolicyDefinition,
  EvaluateRequest,
  EvaluateResult,
  MatchedPolicy,
  ConditionRule,
  Trace,
} from '@agentshield/langchain';
```

## Related Packages

- **[agentshield](https://www.npmjs.com/package/agentshield)** — Full SDK with hosted and embedded modes
- **[@agentshield/core](https://www.npmjs.com/package/@agentshield/core)** — Low-level evaluation engine (used internally)

## License

MIT
