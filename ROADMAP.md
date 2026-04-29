# AgentShield Roadmap

AgentShield's goal is to become the practical runtime permission layer for AI agents: simple enough to adopt in minutes, strict enough to govern real tool calls.

## Near Term

- Improve quickstart examples for SDK and LangChain users.
- Add runnable example agents demonstrating `ALLOW`, `BLOCK`, and `REQUIRE_APPROVAL` flows.
- Add screenshots/GIFs of the dashboard and approval workflow.
- Add a policy recipe library for common agent risks:
  - shell commands
  - file access
  - network requests
  - database writes
  - payment/admin actions
- Add stronger import/export examples for policy portability.

## Reliability & Security

- Expand package-level runtime tests.
- Add package publish validation in CI.
- Reduce or document known dependency audit findings.
- Add security-focused test cases for policy bypass attempts.
- Add signed release/provenance exploration.

## Integrations

- Improve LangChain documentation and examples.
- Explore adapters for popular agent frameworks and runtimes.
- Add webhook examples for Slack/Discord/Telegram approval flows.

## Developer Experience

- Better TypeScript examples.
- Better error messages and typed decision reasons.
- CLI helpers for local policy testing.
- Policy simulation mode for CI.

## What AgentShield Will Not Be

- Not a prompt-only guardrail.
- Not a replacement for server-side authorization.
- Not a guarantee that an AI system is safe by itself.

AgentShield is defense-in-depth for runtime decisions.
