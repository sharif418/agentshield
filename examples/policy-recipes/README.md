# AgentShield Policy Recipes

Practical starter policies for common AI-agent risk boundaries.

These examples are intentionally small and readable. Treat them as starting points, then tune `agentRole`, `resource`, `action`, `conditionRules`, and `priority` for your own system.

## Decision model

AgentShield returns one of three decisions:

- `ALLOW` — execute immediately
- `BLOCK` — deny the tool call
- `REQUIRE_APPROVAL` — pause for human review

AgentShield is most useful when paired with least-privilege credentials and server-side authorization. It is a runtime governance layer, not a magic force field. Unfortunate, but reality remains stubborn.

## Recipes

| File | Purpose |
| --- | --- |
| [`shell-commands.json`](./shell-commands.json) | Block destructive shell commands and require approval for package installs/deploys |
| [`database-writes.json`](./database-writes.json) | Allow reads, require approval for writes, block destructive SQL |
| [`network-requests.json`](./network-requests.json) | Allow safe GET requests and require approval for outbound POST/DELETE |
| [`payments-admin.json`](./payments-admin.json) | Require approval for refunds, payouts, admin changes, and high-risk workflows |

## Usage with the SDK

```ts
import { AgentShield } from '@agentshieldhq/sdk'
import policies from './database-writes.json' with { type: 'json' }

const shield = new AgentShield({
  mode: 'embedded',
  policies,
  zeroTrust: true,
})

const result = await shield.evaluate({
  agentRole: 'DataAgent',
  toolName: 'PostgreSQL',
  arguments: { query: 'DROP TABLE users' },
})

console.log(result.decision) // BLOCK
```
