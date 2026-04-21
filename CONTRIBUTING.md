# Contributing to AgentShield

Thank you for your interest in contributing to AgentShield! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Environment](#development-environment)
- [Project Structure](#project-structure)
- [How to Run Tests](#how-to-run-tests)
- [Code Style](#code-style)
- [Submitting Pull Requests](#submitting-pull-requests)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

Be respectful, constructive, and inclusive. We are all here to build something great together.

## Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/agentshield/agentshield-dashboard.git
   cd agentshield-dashboard
   ```
3. **Install** dependencies:
   ```bash
   bun install
   ```
4. **Set up** environment variables:
   ```bash
   cp .env.example .env
   ```
5. **Initialize** the database:
   ```bash
   bun run db:push
   bun run db:generate
   ```
6. **Start** the development server:
   ```bash
   bun run dev
   ```

## Development Environment

### Prerequisites

- **Node.js** >= 18
- **Bun** >= 1.0 (recommended runtime and package manager)
- **Git** >= 2.30

### Required Environment Variables

See [`.env.example`](./.env.example) for the full list of environment variables and their descriptions.

### Starting Services

The dashboard runs on port `3000` by default. The approval WebSocket service runs on port `3003`.

```bash
# Start the Next.js development server
bun run dev

# Start the WebSocket service (separate terminal)
cd mini-services/approval-ws && bun run dev
```

### Seeding the Database

To populate the database with sample data for development:

```bash
curl -X POST http://localhost:3000/api/seed
```

> **Note:** The seed endpoint is disabled in production.

## Project Structure

```
agentshield-dashboard/
├── packages/
│   ├── core/          # @agentshield/core — Policy evaluation engine
│   ├── sdk/           # @agentshield/sdk  — JavaScript/TypeScript SDK
│   └── langchain/     # @agentshield/langchain — LangChain callback handler
├── src/
│   ├── app/           # Next.js App Router (pages and API routes)
│   │   └── api/       # REST API endpoints
│   ├── components/    # React components
│   │   ├── dashboard/ # Dashboard-specific components
│   │   └── ui/        # Shared UI components (shadcn/ui)
│   ├── hooks/         # Custom React hooks
│   └── lib/           # Shared utilities, auth, DB client, policy engine
├── mini-services/
│   └── approval-ws/   # WebSocket service for real-time approval notifications
├── prisma/            # Database schema and migrations
└── db/                # SQLite database files
```

## How to Run Tests

```bash
# Run all tests once
bun run test

# Run tests in watch mode
bun run test:watch

# Run a specific test file
bunx vitest run packages/core/__tests__/engine.test.ts
```

### Test Conventions

- Test files live alongside source files in `__tests__/` directories.
- Use **Vitest** as the test runner.
- Write unit tests for business logic in `packages/core/` and `src/lib/`.
- API route tests should mock the database layer.

## Code Style

### General

- **TypeScript** throughout — strict mode enabled, no `any` unless absolutely necessary.
- **ESLint** — Run `bun run lint` before submitting. All lint errors must be resolved.
- **Formatting** — Follow the existing code style in the repository. Consistency matters.

### Naming Conventions

- Files: `kebab-case.ts` / `kebab-case.tsx`
- Components: `PascalCase` (e.g., `PolicyManager.tsx`)
- Functions and variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Types and interfaces: `PascalCase`

### Component Guidelines

- Use **shadcn/ui** components from `src/components/ui/` as building blocks.
- Add `'use client'` directive to client-side components.
- Keep components focused — one responsibility per component.
- Use **Zustand** for client state, **TanStack Query** for server state.

### API Route Guidelines

- All API routes must call `validateApiKey(request)` for authentication.
- Use **Zod** for request validation schemas.
- Return structured JSON responses with appropriate HTTP status codes.
- Use `console.error` for error logging in catch blocks — do not use `console.log` in production code.

### Database Guidelines

- Define models in `prisma/schema.prisma`.
- Run `bun run db:push` after schema changes (development).
- Import the database client via `import { db } from '@/lib/db'`.

## Submitting Pull Requests

### Before Submitting

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. **Write tests** for new functionality.
3. **Run linting**:
   ```bash
   bun run lint
   ```
4. **Run tests**:
   ```bash
   bun run test
   ```
5. **Commit** with descriptive messages:
   ```bash
   git commit -m "feat: add policy scheduling endpoint"
   ```
   We follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` — New feature
   - `fix:` — Bug fix
   - `docs:` — Documentation changes
   - `refactor:` — Code refactoring
   - `test:` — Test additions or changes
   - `chore:` — Build, tooling, or dependency changes

### PR Requirements

- **Title**: Use conventional commit format (e.g., `feat: add policy scheduling`).
- **Description**: Explain what the PR does, why it's needed, and how to test it.
- **Scope**: Keep PRs focused. One feature or fix per PR.
- **No `console.log`**: Remove all debug `console.log` statements before submitting.
- **No secrets**: Never commit API keys, passwords, or tokens.
- **Tests**: New features must include tests.
- **Linting**: Must pass `bun run lint` with no errors.

### Review Process

1. A maintainer will review your PR within a few days.
2. Address review feedback by pushing additional commits.
3. Once approved, a maintainer will merge your PR.

## Reporting Issues

- Use [GitHub Issues](https://github.com/agentshield/agentshield-dashboard/issues) to report bugs or request features.
- Include steps to reproduce, expected behavior, and actual behavior.
- Specify your Node.js/Bun version, OS, and browser.

---

Thank you for contributing to AgentShield!
