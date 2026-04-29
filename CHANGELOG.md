# Changelog

All notable changes to AgentShield will be documented in this file.

## [1.0.1] - 2026-04-29

### Fixed

- Fixed Node.js ESM runtime imports in `@agentshieldhq/core` by emitting `.js` extensions for relative package imports.
- Verified fresh npm install and runtime imports for:
  - `@agentshieldhq/core`
  - `@agentshieldhq/sdk`
  - `@agentshieldhq/langchain`

## [1.0.0] - 2026-04-29

### Added

- Initial public release of AgentShield.
- `@agentshieldhq/core`: deterministic policy evaluation primitives.
- `@agentshieldhq/sdk`: hosted and embedded AgentShield client API.
- `@agentshieldhq/langchain`: LangChain callback integration.
- Next.js dashboard/API scaffold for policies, traces, approvals, stats, import/export, and webhooks.
- GitHub Actions CI for install, generation, lint, tests, and build.
- Apache-2.0 license.
