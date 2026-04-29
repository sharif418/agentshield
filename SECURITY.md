# Security Policy

AgentShield is security-adjacent infrastructure for AI agent runtime governance. Please report vulnerabilities responsibly.

## Supported Versions

| Package | Supported |
| --- | --- |
| `@agentshieldhq/core` 1.x | Yes |
| `@agentshieldhq/sdk` 1.x | Yes |
| `@agentshieldhq/langchain` 1.x | Yes |

## Reporting a Vulnerability

Please do **not** open a public GitHub issue for sensitive security reports.

Instead, report privately through GitHub Security Advisories if available for this repository, or contact the maintainer directly via the GitHub profile linked from the repository.

Include:

- Affected package/version
- Reproduction steps or proof of concept
- Expected vs actual behavior
- Impact assessment
- Any suggested mitigation

## Scope

In scope:

- Policy bypasses that produce incorrect `ALLOW`, `BLOCK`, or `REQUIRE_APPROVAL` decisions
- Approval/audit integrity issues
- Sensitive data exposure in logs, traces, exports, or package artifacts
- Supply-chain or package publishing issues

Out of scope:

- Vulnerabilities in downstream apps that integrate AgentShield incorrectly
- Social engineering
- Denial-of-service reports without a practical exploit path
- Issues only affecting development/demo dependencies unless they impact production package consumers

## Security Model

AgentShield is a runtime policy and governance layer. It should be treated as defense-in-depth, not as the only security boundary for a production system.

Use it alongside:

- Least-privilege tool/API credentials
- Server-side authorization
- Audit logging
- Human approval for high-risk actions
- Secrets management
- Network and infrastructure controls
