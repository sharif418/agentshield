# GitHub Power Plan for AgentShield

## Current Strengths

- Public repo with professional description.
- Apache-2.0 license.
- npm packages published under `@agentshieldhq`.
- README, SECURITY, CHANGELOG, ROADMAP, CONTRIBUTING, CODE_OF_CONDUCT present.
- Issue templates and PR template present.
- Useful repository topics added.
- Maintenance labels added for security, SDK, LangChain, dashboard, and policy-engine work.

## Critical Blocker

GitHub Actions jobs are failing before any step executes. API inspection shows:

- Actions are enabled.
- All actions/workflows are allowed.
- Workflow permissions are read-only, which is fine for current CI.
- Jobs fail with no assigned runner and no steps/logs.

This looks like a GitHub-hosted runner/account/repository setting issue, not an application build failure.

Sir may need to open GitHub UI:

Settings → Actions → General

Check:

1. Actions permissions: allow all actions and reusable workflows.
2. Workflow permissions: read repository contents is okay; read/write can also be enabled later.
3. Runner availability / GitHub-hosted runners for the account.
4. Any banner saying Actions are disabled, billing/spending limit, or runner access needs confirmation.

## Next GitHub Upgrades

### Phase 1 — Trust Signals

- Fix CI runner issue and get green checks.
- Add CI badge only after CI is green.
- Create release `v1.0.1` with notes after CI is green.

### Phase 2 — Discovery

- Add demo screenshot/GIF to README.
- Add a short “Why now?” section for agent runtime security.
- Add examples directory with runnable policy recipes.

### Phase 3 — Community

- Create first issues:
  - Add shell-command policy recipe.
  - Add database-write policy recipe.
  - Add Slack/Telegram approval webhook example.
  - Add package-level smoke tests in CI.
- Pin beginner-friendly issues with `good first issue` / `good first policy`.

### Phase 4 — Launch

- Publish GitHub Release `v1.0.1`.
- Prepare launch posts for X, LinkedIn, Hacker News, Reddit.
- Do not post publicly without Sir's approval.
