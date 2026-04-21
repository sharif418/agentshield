# Task QA-2 + ENH-1: Fix Evaluate API Action Inference Bug + Enhance Evaluate Panel

**Agent:** Main
**Date:** 2026-04-21
**Status:** ✅ Complete

## Summary

Fixed the critical evaluate API bug where action inference from arguments was missing, causing incorrect policy evaluations (e.g., DROP TABLE returning ALLOW instead of BLOCK). Also enhanced the Evaluate Panel with action field, scenario templates, and contextual help.

## Changes Made

### 1. Evaluate API Route (`src/app/api/evaluate/route.ts`)

#### Added `inferAction(args, toolName)` function
- Checks explicit `operation`, `action`, `method` fields first
- SQL query inference: parses first keyword (SELECT→SELECT, DROP→DROP, ALTER→ADMIN, etc.)
- HTTP method inference via `args.httpMethod`
- Email-specific: EmailAPI + `to` → SEND, otherwise → READ
- Slack-specific: SlackAPI + `channel` + `text` → POST_MESSAGE, otherwise → READ

#### Added `enrichArgsFromQuery(args)` function
- Enriches SQL query args with an inferred `operation` field
- Maps "DROP TABLE x" → operation:"DROP_TABLE", "DROP DATABASE x" → "DROP_DATABASE", etc.
- Ensures policy condition rules can match even when caller only provides `query` field

#### Updated action inference in POST handler
- Changed from `body.action ?? args?.operation ?? null` to `body.action ?? inferAction(rawArgs, toolName)`
- Uses original (non-enriched) args for action inference, enriched args for condition matching

#### Implemented zero-trust mode when action is null
- Collects all matching policies into BLOCK/APPROVAL/ALLOW buckets
- Returns most restrictive decision: BLOCK > REQUIRE_APPROVAL > ALLOW
- Default deny when no policies match
- Reason messages include "(zero-trust: action unknown)" suffix

### 2. Evaluate Panel (`src/components/dashboard/EvaluatePanel.tsx`)

#### Added Action Select dropdown
- Between Tool Name and Arguments fields
- Options: Auto-detect (default), SELECT, INSERT, UPDATE, DELETE, DROP, READ, WRITE, ADMIN, SEND, POST_MESSAGE, PUSH, MERGE, REFUND
- "Auto-detect" sends no action (API infers); specific action sends it in request body
- Contextual info text explains the auto-detection behavior

#### Added Scenario Templates dropdown
- 6 pre-built test scenarios at the top of the form
- Auto-fills all fields: agent role, tool name, action, arguments
- Scenarios: SQL SELECT, SQL DROP TABLE, GitHub Push, Stripe Refund, Email Send, Read .env file

#### Updated mutation type
- Added optional `action` field to the mutation body type
- Only includes `action` in request body when it's not "auto"

## Verification Results

| Test | Expected | Actual |
|------|----------|--------|
| DROP TABLE users | BLOCK | ✅ BLOCK |
| SELECT * FROM users | ALLOW | ✅ ALLOW |
| GitHub PUSH to main | REQUIRE_APPROVAL | ✅ REQUIRE_APPROVAL |
| Stripe REFUND (amount>100) | REQUIRE_APPROVAL | ✅ REQUIRE_APPROVAL |
| FinanceAgent+Stripe empty args (zero-trust) | BLOCK | ✅ BLOCK |
| `bun run lint` | Pass | ✅ Pass |
