# AgentShield - AI Policy Engine Dashboard

A deterministic runtime policy engine providing zero-trust governance for AI agent tool calls. AgentShield intercepts every tool invocation and makes real-time ALLOW / BLOCK / REQUIRE_APPROVAL decisions based on configurable policies, condition rules, and priority ordering.

## Architecture

```
┌─────────────┐     ┌───────────────┐     ┌──────────────┐
│  AI Agent    │────▶│  Policy Engine │────▶│  Decision    │
│  Tool Call   │     │  Evaluation    │     │  ALLOW/BLOCK │
└─────────────┘     └───────┬───────┘     │  /REVIEW     │
                            │             └──────────────┘
                    ┌───────▼───────┐
                    │  Audit Log    │
                    │  (Immutable)  │
                    └───────────────┘
```

## Features

- **Policy Engine**: Priority-based evaluation with BLOCK > REQUIRE_APPROVAL > ALLOW ordering
- **Condition Rules**: Context-aware rules supporting `$and`, `$or`, `$contains`, `$equals`, `$in`, `$gt`, `$lt`
- **HITL Approvals**: Human-in-the-loop approval queue with WebSocket notifications
- **Execution Tracing**: Full audit trail of every policy evaluation
- **Immutable Audit Log**: Prisma-enforced immutability — no updates or deletes allowed
- **CSV/JSON/HTML Export**: Full data export with configurable types and formats
- **22 Dashboard Sections**: Comprehensive monitoring, analysis, and management views
- **Real-Time**: WebSocket-powered live stream and approval notifications
- **Dark Mode**: Full theme support with system preference detection
- **Command Palette**: ⌘K search across sections, policies, and traces

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Database | Prisma ORM (SQLite) |
| Real-Time | Socket.IO (port 3003) |
| State | Zustand + TanStack Query |
| Charts | Recharts |
| Animations | Framer Motion |
| Testing | Bun test runner |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) >= 1.0

### Installation

```bash
# Install dependencies
bun install

# Copy environment config
cp .env.example .env

# Initialize the database
bun run db:push

# Seed with demo data (development only)
curl -X POST http://localhost:3000/api/seed
```

### Development

```bash
# Start Next.js dev server (port 3000)
bun run dev

# Start WebSocket service (port 3003)
cd mini-services/approval-ws && bun run dev
```

### Testing

```bash
# Run unit tests
bun test

# Lint
bun run lint
```

## API Reference

### Authentication

In production mode (`NODE_ENV=production`), all API endpoints require an API key via the `x-api-key` header or `api_key` query parameter. Set `AGENTSHEILD_API_KEY` in your environment.

In development mode, authentication is disabled for convenience.

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats` | Dashboard statistics |
| GET/POST | `/api/policies` | List / Create policies |
| GET/PUT/DELETE | `/api/policies/[policyId]` | Get / Update / Delete policy |
| GET | `/api/policies/[policyId]/history` | Policy change history |
| PATCH | `/api/policies/bulk` | Bulk enable/disable/delete |
| GET/POST | `/api/traces` | List / Create execution traces |
| GET | `/api/traces/[id]` | Get trace details |
| GET/POST | `/api/approvals` | List / Create approval requests |
| GET/PUT | `/api/approvals/[id]` | Get / Update approval |
| POST | `/api/evaluate` | Evaluate policy decision |
| GET | `/api/audit` | List audit logs |
| GET/POST | `/api/webhooks` | List / Create webhook configs |
| PUT/DELETE | `/api/webhooks?id=xxx` | Update / Delete webhook |
| GET | `/api/export` | Export data (CSV/JSON) |
| POST | `/api/seed` | Seed demo data (dev only) |

### Policy Evaluation

```bash
curl -X POST http://localhost:3000/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "agentRole": "DataAgent",
    "toolName": "PostgreSQL",
    "arguments": { "query": "DROP TABLE users" }
  }'
```

Response:
```json
{
  "decision": "BLOCK",
  "traceId": "TRC-xxx",
  "matchedPolicy": {
    "policyId": "POL-dataagent-postgres-block",
    "name": "DataAgent PostgreSQL Drop Block",
    "permissionLevel": "BLOCK",
    "priority": 20,
    "action": "DROP"
  },
  "reason": "Blocked by policy: DataAgent PostgreSQL Drop Block",
  "latency": 1.234
}
```

## Dashboard Sections

| Section | Description |
|---------|------------|
| Dashboard | Overview with stats, charts, decision flow |
| Policies | CRUD management with condition rules |
| Approvals | HITL queue with batch operations |
| Traces | Execution history with filtering |
| Reasoning | Visual policy decision graph |
| Live Stream | Real-time event feed |
| Agents | Per-agent role profiles and risk |
| Simulator | Policy testing with what-if analysis |
| Widgets | Customizable dashboard widgets |
| Security | Security scanning and posture |
| System Health | Service health monitoring |
| Rate Analytics | Policy evaluation rate metrics |
| Policy Diff | Compare policy versions |
| Dep. Graph | Policy dependency visualization |
| Compliance | Compliance reporting |
| Templates | Policy templates library |
| Threat Intel | Threat intelligence feed |
| Scheduler | Policy activation scheduling |
| Data Manager | Export, import, backup |
| Audit Logs | Immutable audit trail |
| Webhooks | Notification webhook config |
| SDK & Docs | Integration documentation |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:./../db/custom.db` | SQLite database path |
| `AGENTSHEILD_API_KEY` | — | API key for production auth |
| `WS_PORT` | `3003` | WebSocket service port |
| `NODE_ENV` | `development` | Environment mode |

## Project Structure

```
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── app/
│   │   ├── api/               # API routes
│   │   ├── globals.css        # Global styles
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Main entry point
│   ├── components/
│   │   ├── dashboard/         # 22+ dashboard components
│   │   └── ui/                # shadcn/ui components
│   └── lib/
│       ├── auth.ts            # API key authentication
│       ├── db.ts              # Prisma client + AuditLog immutability
│       ├── policy-engine.ts   # Core evaluation logic
│       ├── store.ts           # Zustand state
│       └── use-websocket.ts   # WebSocket hook
├── mini-services/
│   └── approval-ws/           # Socket.IO notification service
├── __tests__/                 # Unit tests
├── .env.example               # Environment template
└── README.md
```

## License

MIT
