# AgentShield

**Firewall for AI agent tool calls.**

AgentShield is a deterministic runtime policy engine for AI agents. It intercepts tool calls before they execute and returns one of three decisions: **ALLOW**, **BLOCK**, or **REQUIRE_APPROVAL**.

Prompts are not permissions. If an agent can call tools, write files, query databases, hit APIs, or trigger workflows, it needs runtime governance. AgentShield gives agentic systems a zero-trust control layer with policy rules, approval queues, immutable audit logs, SDKs, LangChain integration, and a self-hosted dashboard.

> Built for teams who want powerful AI agents without handing them an unchecked production keyboard.

---

## Why AgentShield?

AI agents are moving from chat boxes into operational systems. They can now call tools, mutate state, deploy code, touch databases, and send messages. Most guardrails focus on prompts or model outputs. AgentShield focuses on the moment that matters most: **the tool call**.

```ts
import { AgentShield } from '@agentshieldhq/sdk'

const shield = new AgentShield({
  mode: 'embedded',
  policies: [
    {
      policyId: 'POL-001',
      name: 'Block destructive SQL',
      agentRole: 'DataAgent',
      resource: 'PostgreSQL',
      action: 'DROP',
      permissionLevel: 'BLOCK',
      priority: 100,
      enabled: true,
    },
  ],
})

const result = await shield.evaluate({
  agentRole: 'DataAgent',
  toolName: 'PostgreSQL',
  arguments: { query: 'DROP TABLE users' },
})

console.log(result.decision) // BLOCK
```

---

## Packages

```bash
npm install @agentshieldhq/sdk
npm install @agentshieldhq/core
npm install @agentshieldhq/langchain
```

| Package | Purpose |
|---|---|
| `@agentshieldhq/core` | Deterministic policy evaluation engine |
| `@agentshieldhq/sdk` | Embedded and hosted client SDK |
| `@agentshieldhq/langchain` | LangChain callback integration |

---

## Quick Start

### Self-host the dashboard

```bash
git clone https://github.com/sharif418/agentshield.git
cd agentshield
cp .env.example .env
bun install
bun run db:push
curl -X POST http://localhost:3000/api/seed
bun run dev
```

Open `http://localhost:3000`.

### Docker

```bash
cp .env.example .env
docker compose up
```

---

## What is production-grade today?

- Core policy engine: priority-based ALLOW / BLOCK / REQUIRE_APPROVAL decisions
- Condition rules: `$and`, `$or`, `$contains`, `$equals`, `$in`, `$gt`, `$lt`
- API key authentication for protected endpoints
- Zod validation on API input
- Policy CRUD, evaluation, traces, approvals, import/export, audit APIs
- Immutable audit-log protection at the Prisma client layer
- SDK packages for embedded and hosted usage
- LangChain callback handler
- WebSocket approval notifications
- Dashboard for policies, approvals, traces, compliance, and simulations

## Showcase / roadmap components

Some dashboard panels are intentionally demo-oriented in this release and marked for future hardening: threat-intelligence feed, security scanner, synthetic system-health metrics, policy scheduler persistence, and deeper simulator persistence. The core policy engine and API workflow are the primary release surface.


## Features

### Core Engine

- **Policy Evaluation Engine** — Priority-based evaluation with `BLOCK > REQUIRE_APPROVAL > ALLOW` ordering
- **Condition Rules Engine** — Context-aware rules supporting `$and`, `$or`, `$contains`, `$equals`, `$in`, `$gt`, `$lt` operators
- **Action Inference** — Automatically infers action types from SQL queries, HTTP methods, and tool-specific patterns
- **Zero-Trust Mode** — When action cannot be inferred, defaults to the most restrictive matching policy
- **Action Matching** — Hierarchical action mapping (e.g., `DROP` matches `DROP`, `ADMIN`, `WRITE` policies)

### Human-in-the-Loop

- **Approval Workflow** — Full approval queue with PENDING / APPROVED / REJECTED / MODIFIED states
- **Batch Operations** — Approve, reject, or modify multiple requests at once
- **Action Modification** — Reviewers can downgrade or modify requested actions before approval
- **Real-Time Notifications** — WebSocket-powered live notifications for new approval requests and status updates

### Monitoring & Analytics

- **22-Section Dashboard** — Comprehensive monitoring, analysis, and management views
- **Live Stream** — Real-time terminal-style event feed with pause/resume, filtering, and sound alerts
- **Agent Role Management** — Per-agent profiles with risk scores, trace breakdowns, and compliance status
- **Execution Tracing** — Full audit trail of every policy evaluation with latency tracking
- **Reasoning Graph** — Visual animated graph showing how the policy engine arrived at its decision
- **Rate Analytics** — Policy evaluation rate metrics and trends
- **Compliance Reporting** — Automated compliance score calculation and reporting

### Policy Management

- **Policy Simulator** — Test policy configurations before deployment with what-if analysis
- **Policy Diff Viewer** — Compare policy versions side-by-side
- **Policy Version History** — Full change history with actor tracking
- **Policy Dependency Graph** — Visualize policy relationships and dependencies
- **Policy Templates** — Pre-built policy templates for common scenarios
- **Condition Rule Builder** — Visual drag-and-drop builder for condition rules
- **Policy Conflict Detector** — Identify overlapping or conflicting policies
- **Policy Scheduler** — Schedule policy activation and deactivation

### Security & Operations

- **Security Scanner** — Security posture scanning and vulnerability assessment
- **Threat Intelligence Feed** — Real-time threat intelligence integration
- **System Health Panel** — Service health monitoring and diagnostics
- **Immutable Audit Log** — Prisma-enforced immutability — no updates or deletes allowed
- **Data Export/Import** — CSV, JSON, and HTML export with data import and backup
- **Webhook Integrations** — Slack, Teams, Telegram notification channels
- **SDK & Documentation** — Multi-language integration guides and code generation

### Developer Experience

- **Dark Mode** — Full theme support with system preference detection via `next-themes`
- **Command Palette** — `⌘K` search across sections, policies, and traces
- **Keyboard Shortcuts** — Numeric shortcuts (1-9, 0, Q, W) for section navigation
- **Responsive Design** — Mobile-first design with touch-friendly interactions
- **Framer Motion Animations** — Smooth transitions, micro-interactions, and visual polish

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Framework** | [Next.js](https://nextjs.org/) (App Router) | 16 |
| **Language** | [TypeScript](https://www.typescriptlang.org/) | 5 |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) | 4 |
| **Database** | [Prisma ORM](https://www.prisma.io/) (SQLite) | 6 |
| **Real-Time** | [Socket.IO](https://socket.io/) | 4 |
| **State Management** | [Zustand](https://zustand.docs.pmnd.rs/) | 5 |
| **Server State** | [TanStack Query](https://tanstack.com/query) | 5 |
| **Charts** | [Recharts](https://recharts.org/) | 2 |
| **Animations** | [Framer Motion](https://www.framer.com/motion/) | 12 |
| **Validation** | [Zod](https://zod.dev/) | 3 |
| **Icons** | [Lucide React](https://lucide.dev/) | 0.525 |
| **Package Manager** | [Bun](https://bun.sh/) | 1+ |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser / Client                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  Next.js App Router (SSR)                  │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │  │
│  │  │ Dashboard │  │ Policies │  │Approvals │  │ Traces   │ │  │
│  │  │ Overview  │  │ Manager  │  │  Queue   │  │ & Logs   │ │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │  │
│  │  │Simulator │  │ Live     │  │ Agents   │  │Security  │ │  │
│  │  │& What-If │  │ Stream   │  │ & Risk   │  │Scanner   │ │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
│                           │                                     │
│                     API Requests                                │
│                           │                                     │
│  ┌────────────────────────▼───────────────────────────────────┐  │
│  │                 Next.js API Routes (Port 3000)              │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │  │
│  │  │ /api/    │  │ /api/    │  │ /api/    │  │ /api/    │ │  │
│  │  │ evaluate │  │ policies │  │approvals │  │ traces   │ │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │  │
│  │  │ /api/    │  │ /api/    │  │ /api/    │  │ /api/    │ │  │
│  │  │ stats    │  │ audit    │  │ webhooks │  │ export   │ │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │  │
│  │                         │                                   │  │
│  │               ┌─────────▼──────────┐                       │  │
│  │               │  Policy Engine     │                       │  │
│  │               │  (Evaluation Logic)│                       │  │
│  │               └─────────┬──────────┘                       │  │
│  │                         │                                   │  │
│  │               ┌─────────▼──────────┐                       │  │
│  │               │  Prisma Client     │                       │  │
│  │               │  (ORM / SQLite)    │                       │  │
│  │               └─────────┬──────────┘                       │  │
│  └─────────────────────────┼──────────────────────────────────┘  │
│                            │                                     │
│                   ┌────────▼────────┐                             │
│                   │  SQLite Database │                             │
│                   │  (db/custom.db)  │                             │
│                   └─────────────────┘                             │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │         Socket.IO WebSocket Service (Port 3003)           │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐     │   │
│  │  │approval:new │  │approval:    │  │approval:     │     │   │
│  │  │  broadcast   │  │  updated    │  │  reminder    │     │   │
│  │  └─────────────┘  └─────────────┘  └──────────────┘     │   │
│  │  REST: /health | /notify/new | /notify/update            │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **AI Agent** makes a tool call (e.g., `DataAgent → PostgreSQL → DROP TABLE users`)
2. **Evaluate API** receives the request, infers the action, finds matching policies
3. **Policy Engine** evaluates condition rules and determines the decision (ALLOW / BLOCK / REQUIRE_APPROVAL)
4. **Execution Trace** is created recording the full evaluation with latency
5. **Audit Log** records an immutable entry for the event
6. If **REQUIRE_APPROVAL**, an **ApprovalRequest** is created and a **WebSocket notification** is broadcast
7. **Human Reviewer** approves, rejects, or modifies the request via the dashboard
8. **Dashboard** reflects all changes in real-time via polling and WebSocket updates

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) >= 1.0
- Node.js >= 18 (for compatibility)

### Setup

```bash
# 1. Clone the repository
git clone <repository-url>
cd agentshield-dashboard

# 2. Install dependencies
bun install

# 3. Build the core package (required for first run)
cd packages/core && bun run build && cd ../..

# 4. Configure environment
cp .env.example .env
# Edit .env with your configuration (see Environment Variables section)

# 5. Push database schema
bun run db:push

# 6. Seed with demo data (development only)
curl -X POST http://localhost:3000/api/seed

# 7. Start the Next.js dev server (port 3000)
bun run dev

# 7. Start the WebSocket notification service (port 3003)
cd mini-services/approval-ws && bun run dev
```

### Verification

```bash
# Check the dashboard
open http://localhost:3000

# Test the evaluate API
curl -X POST http://localhost:3000/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "agentRole": "DataAgent",
    "toolName": "PostgreSQL",
    "arguments": { "query": "DROP TABLE users" }
  }'

# Check WebSocket service health
curl http://localhost:3003/health
```

### Linting

```bash
bun run lint
```

---

## API Documentation

### Authentication

In production mode (`NODE_ENV=production`), all API endpoints require authentication via the `x-api-key` header or `api_key` query parameter. Set `AGENTSHIELD_API_KEY` in your environment.

In development mode, authentication is disabled for convenience.

```bash
# Production request with API key
curl -H "x-api-key: your-secret-key" http://localhost:3000/api/policies
```

### Endpoints

#### Dashboard Statistics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/stats` | Get dashboard statistics (policy counts, trace breakdowns, avg latency, etc.) |

**Query Parameters:**
- `timeRange` — Filter by time range: `24h` (default), `7d`, `30d`, `90d`

**Response includes:** `totalPolicies`, `policyBreakdown`, `totalTraces`, `traceBreakdown`, `pendingApprovals`, `averageLatency`, `auditLogCount`, `policiesByRole`, `recentTraces`

---

#### Policies

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/policies` | List all policies with optional filters |
| `POST` | `/api/policies` | Create a new policy |
| `GET` | `/api/policies/[policyId]` | Get a specific policy by ID |
| `PUT` | `/api/policies/[policyId]` | Update a policy |
| `DELETE` | `/api/policies/[policyId]` | Delete a policy |
| `GET` | `/api/policies/[policyId]/history` | Get policy change history |
| `PATCH` | `/api/policies/bulk` | Bulk enable, disable, or delete policies |

**GET /api/policies Query Parameters:**
- `agentRole` — Filter by agent role (e.g., `DataAgent`, `CodeAgent`)
- `resource` — Filter by resource/tool (e.g., `PostgreSQL`, `GitHub`)
- `permissionLevel` — Filter by level: `ALLOW`, `BLOCK`, `REQUIRE_APPROVAL`
- `enabled` — Filter by enabled status: `true` or `false`

**POST /api/policies Body:**
```json
{
  "name": "DataAgent PostgreSQL Read Access",
  "description": "Allow read operations",
  "agentRole": "DataAgent",
  "resource": "PostgreSQL",
  "action": "SELECT",
  "permissionLevel": "ALLOW",
  "conditionRules": { "operation": { "$in": ["SELECT", "GET"] } },
  "priority": 5,
  "enabled": true
}
```

**PATCH /api/policies/bulk Body:**
```json
{
  "policyIds": ["POL-xxx", "POL-yyy"],
  "action": "enable"  // "enable" | "disable" | "delete"
}
```

---

#### Policy Evaluation

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/evaluate` | Evaluate a tool call against active policies |

**Request Body:**
```json
{
  "agentRole": "DataAgent",
  "toolName": "PostgreSQL",
  "arguments": { "query": "DROP TABLE users" },
  "action": "DROP",        // optional — auto-inferred if omitted
  "sessionId": "SES-xxx"   // optional — auto-generated if omitted
}
```

**Response:**
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
  "latency": 1.234,
  "approvalRequestId": null
}
```

When `decision` is `REQUIRE_APPROVAL`, an `approvalRequestId` is included and a WebSocket notification is broadcast.

---

#### Approval Requests

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/approvals` | List approval requests |
| `POST` | `/api/approvals` | Create an approval request |
| `GET` | `/api/approvals/[id]` | Get approval with trace and policy details |
| `PUT` | `/api/approvals/[id]` | Update approval status (approve/reject/modify) |

**GET /api/approvals Query Parameters:**
- `status` — Filter by status: `PENDING`, `APPROVED`, `REJECTED`, `MODIFIED`

**PUT /api/approvals/[id] Body:**
```json
{
  "status": "APPROVED",           // "APPROVED" | "REJECTED" | "MODIFIED"
  "humanReviewerId": "reviewer-alice",
  "reviewNotes": "Action reviewed and approved",
  "modifiedAction": { "operation": "READ_ONLY" }  // only for MODIFIED
}
```

---

#### Execution Traces

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/traces` | List execution traces with pagination |
| `POST` | `/api/traces` | Create a trace record |
| `GET` | `/api/traces/[id]` | Get trace with policy and approval details |

**GET /api/traces Query Parameters:**
- `sessionId` — Filter by session ID
- `agentRole` — Filter by agent role
- `evaluationResult` — Filter by result: `ALLOW`, `BLOCK`, `REQUIRE_APPROVAL`
- `toolName` — Filter by tool name
- `timeRange` — Filter by time range: `24h` (default), `7d`, `30d`, `90d`
- `limit` — Number of results (default: 50)
- `offset` — Pagination offset (default: 0)

---

#### Audit Logs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/audit` | List audit log entries (immutable — no PUT/DELETE) |

**Query Parameters:**
- `eventType` — Filter by event type: `POLICY_CREATED`, `POLICY_UPDATED`, `POLICY_DELETED`, `TRACE_EVALUATED`, `APPROVAL_DECISION`, etc.
- `actor` — Filter by actor
- `limit` — Number of results (default: 50)
- `offset` — Pagination offset (default: 0)

---

#### Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/webhooks` | List all webhook configurations |
| `POST` | `/api/webhooks` | Create a webhook configuration |
| `PUT` | `/api/webhooks` | Update a webhook configuration |
| `DELETE` | `/api/webhooks?id=xxx` | Delete a webhook configuration |

**POST /api/webhooks Body:**
```json
{
  "name": "Slack Policy Alerts",
  "url": "https://hooks.slack.com/services/T00/B00/xxx",
  "channel": "slack",  // "slack" | "teams" | "telegram"
  "events": ["POLICY_CREATED", "APPROVAL_DECISION"],
  "secret": "whsec_your_secret",
  "enabled": true
}
```

---

#### Data Export

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/export` | Export data as CSV or JSON |

**Query Parameters:**
- `type` — Data type: `traces` (default) or `audit`
- `format` — Export format: `csv` (default) or `json`
- `limit` — Max records to export (default: 10000, max: 10000)

---

#### Seed (Development Only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/seed` | Seed database with demo data (disabled in production) |

**Seeds:** 17 policies, 55 execution traces, 10 approval requests, 32 audit logs, 2 webhook configs

---

#### WebSocket Service (Port 3003)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Service health check |
| `POST` | `/notify/new` | Broadcast new approval notification |
| `POST` | `/notify/update` | Broadcast approval status update |

**WebSocket Events:**
- `approval:new` — New approval request created
- `approval:updated` — Approval request status changed
- `approval:reminder` — Pending approvals older than 5 minutes
- `subscribe:approvals` — Subscribe to approval notifications
- `unsubscribe:approvals` — Unsubscribe from notifications

---

## Dashboard Sections

The AgentShield dashboard provides 22 comprehensive sections for monitoring, analysis, and management:

| # | Section | Shortcut | Description |
|---|---------|----------|-------------|
| 1 | Dashboard | `1` | Overview with stats, policy distribution chart, recent activity, policy coverage, quick evaluate |
| 2 | Policies | `2` | Full CRUD management with condition rules, filter bar, batch operations, export/import |
| 3 | Approvals | `3` | HITL approval queue with batch actions, collapsible agent context, live wait timer |
| 4 | Traces | `4` | Execution history with latency histogram, session grouping, filtering, and pagination |
| 5 | Reasoning | `5` | Visual animated policy decision graph with zoom/pan and dark mode |
| 6 | Live Stream | `6` | Real-time terminal-style event feed with pause/resume, sound alerts, sparkline |
| 7 | Agents | `7` | Per-agent role profiles with risk scores, trace breakdown, compliance status |
| 8 | Simulator | `8` | Policy testing with quick scenarios, what-if analysis, decision flow visualization |
| 9 | Widgets | — | Customizable dashboard widgets for personalized views |
| 10 | Security | — | Security scanning and posture assessment |
| 11 | System Health | — | Service health monitoring and diagnostics |
| 12 | Rate Analytics | — | Policy evaluation rate metrics and trend analysis |
| 13 | Policy Diff | — | Side-by-side comparison of policy versions |
| 14 | Dep. Graph | — | Policy dependency visualization |
| 15 | Compliance | — | Automated compliance score calculation and reporting |
| 16 | Templates | — | Pre-built policy templates for common agent/tool scenarios |
| 17 | Threat Intel | — | Real-time threat intelligence feed integration |
| 18 | Scheduler | — | Schedule policy activation and deactivation |
| 19 | Data Manager | — | Export, import, backup, and restore data |
| 20 | Audit Logs | `9` | Immutable audit trail with event type icons and expandable details |
| 21 | Webhooks | `Q` | Notification webhook configuration for Slack, Teams, Telegram |
| 22 | SDK & Docs | `W` | Multi-language SDK integration guides and code generation |

**Additional UI Features:**
- **Notification Center** — Bell icon dropdown with 5 notification types, mark-as-read, auto-refresh
- **Command Palette** — `⌘K` to search across sections, policies, and traces
- **Global Time Range** — Dashboard-wide time filter (24h / 7d / 30d / 90d)
- **Dark/Light Mode** — Full theme support with system preference detection

---

## Project Structure

```
├── prisma/
│   └── schema.prisma                # Database schema (5 models)
├── db/
│   └── custom.db                    # SQLite database file
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── route.ts             # Root API endpoint
│   │   │   ├── stats/route.ts       # Dashboard statistics
│   │   │   ├── evaluate/route.ts    # Policy evaluation engine
│   │   │   ├── policies/
│   │   │   │   ├── route.ts         # List / Create policies
│   │   │   │   ├── [policyId]/
│   │   │   │   │   ├── route.ts     # Get / Update / Delete policy
│   │   │   │   │   └── history/
│   │   │   │   │       └── route.ts # Policy change history
│   │   │   │   └── bulk/
│   │   │   │       └── route.ts     # Bulk enable/disable/delete
│   │   │   ├── traces/
│   │   │   │   ├── route.ts         # List / Create traces
│   │   │   │   └── [id]/route.ts    # Get trace details
│   │   │   ├── approvals/
│   │   │   │   ├── route.ts         # List / Create approvals
│   │   │   │   └── [id]/route.ts    # Get / Update approval
│   │   │   ├── audit/route.ts       # List audit logs (immutable)
│   │   │   ├── webhooks/route.ts    # CRUD webhook configs
│   │   │   ├── export/route.ts      # Data export (CSV/JSON)
│   │   │   └── seed/route.ts        # Seed demo data (dev only)
│   │   ├── globals.css              # Global styles + custom animations
│   │   ├── layout.tsx               # Root layout with providers
│   │   └── page.tsx                 # Main entry point
│   ├── components/
│   │   ├── dashboard/               # 22+ dashboard section components
│   │   │   ├── DashboardLayout.tsx   # Main layout with sidebar & top bar
│   │   │   ├── DashboardOverview.tsx  # Stats, charts, activity feed
│   │   │   ├── PolicyManager.tsx     # Policy CRUD with filters
│   │   │   ├── PolicyForm.tsx        # Create/edit policy dialog
│   │   │   ├── ApprovalQueue.tsx     # HITL approval queue
│   │   │   ├── ApprovalCard.tsx      # Individual approval card
│   │   │   ├── ExecutionTraces.tsx   # Trace history with histogram
│   │   │   ├── ReasoningGraph.tsx    # Animated decision graph
│   │   │   ├── LiveStream.tsx        # Real-time event feed
│   │   │   ├── AgentRoles.tsx        # Agent role profiles
│   │   │   ├── PolicySimulator.tsx   # Policy testing & what-if
│   │   │   ├── EvaluatePanel.tsx     # Quick evaluate widget
│   │   │   ├── AuditLogs.tsx         # Immutable audit log viewer
│   │   │   ├── WebhookConfig.tsx     # Webhook management
│   │   │   ├── SDKIntegration.tsx    # SDK docs & code gen
│   │   │   ├── NotificationCenter.tsx # Notification bell dropdown
│   │   │   ├── StatCard.tsx          # Animated stat card
│   │   │   ├── Sidebar.tsx           # Collapsible navigation
│   │   │   ├── ThemeToggle.tsx       # Dark/light mode toggle
│   │   │   ├── ThemeProvider.tsx     # next-themes provider
│   │   │   ├── TraceDetail.tsx       # Trace detail sheet
│   │   │   ├── GlobalTimeRange.tsx   # Time range selector
│   │   │   ├── ConditionRuleBuilder.tsx # Visual rule builder
│   │   │   ├── PolicyTemplates.tsx   # Policy template library
│   │   │   ├── PolicyVersionHistory.tsx # Version tracking
│   │   │   ├── PolicyDiffViewer.tsx  # Version comparison
│   │   │   ├── PolicyConflictDetector.tsx # Conflict detection
│   │   │   ├── PolicyDependencyGraph.tsx # Dependency visualization
│   │   │   ├── PolicyScheduler.tsx   # Policy scheduling
│   │   │   ├── ComplianceReport.tsx  # Compliance reporting
│   │   │   ├── SecurityScanner.tsx   # Security scanning
│   │   │   ├── ThreatIntelFeed.tsx   # Threat intelligence
│   │   │   ├── SystemHealthPanel.tsx # Health monitoring
│   │   │   ├── RateAnalytics.tsx     # Rate metrics
│   │   │   ├── DataExport.tsx        # Data export component
│   │   │   ├── DataExportManager.tsx # Export/import manager
│   │   │   ├── DashboardWidgets.tsx  # Customizable widgets
│   │   │   └── ...                   # Other components
│   │   └── ui/                       # shadcn/ui component library (50+ components)
│   ├── lib/
│   │   ├── auth.ts                  # API key authentication middleware
│   │   ├── db.ts                    # Prisma client + AuditLog immutability
│   │   ├── policy-engine.ts         # Core evaluation logic (pure functions)
│   │   ├── store.ts                 # Zustand global state
│   │   ├── use-websocket.ts         # WebSocket connection hook
│   │   ├── query-provider.tsx       # TanStack Query provider
│   │   └── utils.ts                 # Utility functions (cn, etc.)
│   └── hooks/
│       ├── use-mobile.ts            # Mobile detection hook
│       └── use-toast.ts             # Toast notification hook
├── mini-services/
│   └── approval-ws/
│       ├── index.ts                 # Socket.IO notification service
│       ├── package.json             # Service-specific dependencies
│       └── run.sh                   # Start script
├── __tests__/                       # Unit tests
├── .env.example                     # Environment variable template
├── packages/                        # Publishable npm packages (@agentshieldhq/core, sdk, langchain)
├── package.json                     # Project dependencies
├── tsconfig.json                    # TypeScript configuration
├── next.config.ts                   # Next.js configuration
├── tailwind.config.ts               # Tailwind CSS configuration
├── postcss.config.mjs               # PostCSS configuration
├── eslint.config.mjs                # ESLint configuration
├── components.json                  # shadcn/ui configuration
└── README.md                        # This file
```

---

## Environment Variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `DATABASE_URL` | `file:./../db/custom.db` | Yes | SQLite database connection string. Relative path from the `prisma/` directory. |
| `AGENTSHIELD_API_KEY` | — | Production | API key for authenticating requests. Required when `NODE_ENV=production`. In development mode, auth is disabled. |
| `WS_PORT` | `3003` | No | Port for the Socket.IO WebSocket notification service. |
| `NODE_ENV` | `development` | No | Application environment. Set to `production` to enable API key authentication and disable seed endpoint. |

### Example Configuration

```env
# Database — SQLite relative path from prisma/ directory
DATABASE_URL=file:./../db/custom.db

# API Authentication — Required in production mode
# In development mode, API key auth is skipped for convenience
AGENTSHIELD_API_KEY=your-secret-api-key-here

# WebSocket Service Port
WS_PORT=3003

# Application Environment
NODE_ENV=development
```

---

## License

[MIT](https://opensource.org/licenses/MIT)
