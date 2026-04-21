import { describe, it, expect } from 'vitest';
import {
  evaluateConditions,
  inferAction,
  enrichArgsFromQuery,
  getMatchingActions,
  evaluatePolicies,
} from '../src/index.js';
import type { PolicyDefinition, EvaluateInput } from '../src/index.js';

// ---------------------------------------------------------------------------
// evaluateConditions (imported from policy-engine, same tests)
// ---------------------------------------------------------------------------
describe('evaluateConditions', () => {
  it('returns true when field value matches', () => {
    expect(evaluateConditions({ agentRole: 'DataAgent' }, { agentRole: 'DataAgent' })).toBe(true);
  });

  it('returns false when field value does not match', () => {
    expect(evaluateConditions({ agentRole: 'DataAgent' }, { agentRole: 'CodeAgent' })).toBe(false);
  });

  it('handles $and operator', () => {
    const rules = { $and: [{ agentRole: 'DataAgent' }, { resource: 'PostgreSQL' }] };
    expect(evaluateConditions(rules, { agentRole: 'DataAgent', resource: 'PostgreSQL' })).toBe(true);
    expect(evaluateConditions(rules, { agentRole: 'DataAgent', resource: 'MySQL' })).toBe(false);
  });

  it('handles $or operator', () => {
    const rules = { $or: [{ agentRole: 'DataAgent' }, { agentRole: 'CodeAgent' }] };
    expect(evaluateConditions(rules, { agentRole: 'DataAgent' })).toBe(true);
    expect(evaluateConditions(rules, { agentRole: 'FinanceAgent' })).toBe(false);
  });

  it('handles $contains operator', () => {
    expect(evaluateConditions({ query: { $contains: 'DROP' } }, { query: 'DROP TABLE users' })).toBe(true);
    expect(evaluateConditions({ query: { $contains: 'DROP' } }, { query: 'SELECT * FROM users' })).toBe(false);
  });

  it('handles $equals operator', () => {
    expect(evaluateConditions({ agentRole: { $equals: 'DataAgent' } }, { agentRole: 'DataAgent' })).toBe(true);
    expect(evaluateConditions({ agentRole: { $equals: 'DataAgent' } }, { agentRole: 'CodeAgent' })).toBe(false);
  });

  it('handles $in operator', () => {
    expect(evaluateConditions({ agentRole: { $in: ['DataAgent', 'CodeAgent'] } }, { agentRole: 'DataAgent' })).toBe(true);
    expect(evaluateConditions({ agentRole: { $in: ['DataAgent', 'CodeAgent'] } }, { agentRole: 'FinanceAgent' })).toBe(false);
  });

  it('handles $gt operator', () => {
    expect(evaluateConditions({ amount: { $gt: 100 } }, { amount: 200 })).toBe(true);
    expect(evaluateConditions({ amount: { $gt: 100 } }, { amount: 50 })).toBe(false);
  });

  it('handles $lt operator', () => {
    expect(evaluateConditions({ amount: { $lt: 100 } }, { amount: 50 })).toBe(true);
    expect(evaluateConditions({ amount: { $lt: 100 } }, { amount: 200 })).toBe(false);
  });

  it('handles nested conditions', () => {
    const rules = {
      $and: [
        { resource: 'PostgreSQL' },
        { $or: [{ agentRole: 'DataAgent' }, { agentRole: 'CodeAgent' }] },
      ],
    };
    expect(evaluateConditions(rules, { resource: 'PostgreSQL', agentRole: 'DataAgent' })).toBe(true);
    expect(evaluateConditions(rules, { resource: 'PostgreSQL', agentRole: 'FinanceAgent' })).toBe(false);
  });

  it('returns true for empty rules', () => {
    expect(evaluateConditions({}, { agentRole: 'DataAgent' })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// inferAction
// ---------------------------------------------------------------------------
describe('inferAction', () => {
  it('returns uppercase operation when args.operation is set', () => {
    expect(inferAction({ operation: 'drop' }, 'PostgreSQL')).toBe('DROP');
  });

  it('prioritizes operation over action', () => {
    expect(inferAction({ operation: 'DROP', action: 'READ' }, 'PostgreSQL')).toBe('DROP');
  });

  it('infers from SQL query', () => {
    expect(inferAction({ query: 'DROP TABLE users' }, 'PostgreSQL')).toBe('DROP');
    expect(inferAction({ query: 'SELECT * FROM users' }, 'PostgreSQL')).toBe('SELECT');
  });

  it('infers SEND for EmailAPI with to field', () => {
    expect(inferAction({ to: 'user@example.com' }, 'EmailAPI')).toBe('SEND');
  });

  it('returns null for unknown tool with no hints', () => {
    expect(inferAction({}, 'UnknownTool')).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// enrichArgsFromQuery
// ---------------------------------------------------------------------------
describe('enrichArgsFromQuery', () => {
  it('enriches DROP TABLE query', () => {
    expect(enrichArgsFromQuery({ query: 'DROP TABLE users' })).toEqual({
      query: 'DROP TABLE users',
      operation: 'DROP_TABLE',
    });
  });

  it('does not enrich when operation already set', () => {
    expect(enrichArgsFromQuery({ query: 'DROP TABLE users', operation: 'CUSTOM' })).toEqual({
      query: 'DROP TABLE users',
      operation: 'CUSTOM',
    });
  });

  it('returns args unchanged when no query', () => {
    expect(enrichArgsFromQuery({ agentRole: 'DataAgent' })).toEqual({ agentRole: 'DataAgent' });
  });
});

// ---------------------------------------------------------------------------
// getMatchingActions
// ---------------------------------------------------------------------------
describe('getMatchingActions', () => {
  it('returns correct mappings for SELECT', () => {
    const result = getMatchingActions('SELECT');
    expect(result).toContain('SELECT');
    expect(result).toContain('READ');
    expect(result).toContain('GET');
  });

  it('returns correct mappings for WRITE', () => {
    const result = getMatchingActions('WRITE');
    expect(result).toContain('WRITE');
    expect(result).toContain('INSERT');
    expect(result).toContain('UPDATE');
    expect(result).toContain('DELETE');
  });

  it('returns only the action for unknown actions', () => {
    expect(getMatchingActions('CUSTOM_ACTION')).toEqual(['CUSTOM_ACTION']);
  });
});

// ---------------------------------------------------------------------------
// evaluatePolicies (the main orchestrator)
// ---------------------------------------------------------------------------
describe('evaluatePolicies', () => {
  const policies: PolicyDefinition[] = [
    {
      policyId: 'POL-001',
      name: 'Block DROP on PostgreSQL',
      description: 'Block DROP operations on PostgreSQL',
      agentRole: 'DataAgent',
      resource: 'PostgreSQL',
      action: 'DROP',
      permissionLevel: 'BLOCK',
      priority: 20,
      enabled: true,
    },
    {
      policyId: 'POL-002',
      name: 'Allow SELECT on PostgreSQL',
      description: 'Allow SELECT operations on PostgreSQL',
      agentRole: 'DataAgent',
      resource: 'PostgreSQL',
      action: 'SELECT',
      permissionLevel: 'ALLOW',
      priority: 10,
      enabled: true,
    },
    {
      policyId: 'POL-003',
      name: 'Require approval for WRITE on GitHub',
      description: 'Write operations on GitHub require approval',
      agentRole: 'CodeAgent',
      resource: 'GitHub',
      action: 'WRITE',
      permissionLevel: 'REQUIRE_APPROVAL',
      priority: 10,
      enabled: true,
    },
    {
      policyId: 'POL-004',
      name: 'Wildcard block admin',
      description: 'Block all agents from admin operations',
      agentRole: '*',
      resource: 'FileSystem',
      action: 'ADMIN',
      permissionLevel: 'BLOCK',
      priority: 30,
      enabled: true,
    },
    {
      policyId: 'POL-005',
      name: 'Conditional block large transactions',
      description: 'Block large Stripe transactions',
      agentRole: 'FinanceAgent',
      resource: 'Stripe',
      action: 'WRITE',
      permissionLevel: 'BLOCK',
      priority: 25,
      enabled: true,
      conditionRules: { amount: { $gt: 10000 } },
    },
    {
      policyId: 'POL-006',
      name: 'Allow FinanceAgent Stripe writes',
      description: 'Allow normal Stripe transactions',
      agentRole: 'FinanceAgent',
      resource: 'Stripe',
      action: 'WRITE',
      permissionLevel: 'ALLOW',
      priority: 5,
      enabled: true,
    },
  ];

  it('BLOCKs a DROP operation on PostgreSQL', () => {
    const result = evaluatePolicies(policies, {
      agentRole: 'DataAgent',
      toolName: 'PostgreSQL',
      arguments: { query: 'DROP TABLE users' },
    });
    expect(result.decision).toBe('BLOCK');
    expect(result.matchedPolicy?.policyId).toBe('POL-001');
  });

  it('ALLOWs a SELECT operation on PostgreSQL', () => {
    const result = evaluatePolicies(policies, {
      agentRole: 'DataAgent',
      toolName: 'PostgreSQL',
      arguments: { query: 'SELECT * FROM users' },
    });
    expect(result.decision).toBe('ALLOW');
    expect(result.matchedPolicy?.policyId).toBe('POL-002');
  });

  it('returns REQUIRE_APPROVAL for WRITE on GitHub', () => {
    const result = evaluatePolicies(policies, {
      agentRole: 'CodeAgent',
      toolName: 'GitHub',
      action: 'PUSH',
    });
    expect(result.decision).toBe('REQUIRE_APPROVAL');
    expect(result.matchedPolicy?.policyId).toBe('POL-003');
  });

  it('matches wildcard agentRole policies', () => {
    const result = evaluatePolicies(policies, {
      agentRole: 'AnyAgent',
      toolName: 'FileSystem',
      action: 'DELETE',
    });
    // POL-004 has agentRole: '*' which matches any agent
    expect(result.decision).toBe('BLOCK');
    expect(result.matchedPolicy?.policyId).toBe('POL-004');
  });

  it('evaluates condition rules correctly', () => {
    // Large transaction should be blocked (WRITE matches because REFUND maps to WRITE)
    const blocked = evaluatePolicies(policies, {
      agentRole: 'FinanceAgent',
      toolName: 'Stripe',
      action: 'REFUND',
      arguments: { amount: 15000 },
    });
    expect(blocked.decision).toBe('BLOCK');
    expect(blocked.matchedPolicy?.policyId).toBe('POL-005');

    // Small transaction should be allowed (amount < 10000, so condition doesn't match)
    const allowed = evaluatePolicies(policies, {
      agentRole: 'FinanceAgent',
      toolName: 'Stripe',
      action: 'REFUND',
      arguments: { amount: 500 },
    });
    expect(allowed.decision).toBe('ALLOW');
    expect(allowed.matchedPolicy?.policyId).toBe('POL-006');
  });

  it('defaults to BLOCK when zero-trust is enabled and no policy matches', () => {
    const result = evaluatePolicies(policies, {
      agentRole: 'UnknownAgent',
      toolName: 'UnknownTool',
      action: 'UNKNOWN',
    });
    // zero-trust is enabled by default, so default deny
    expect(result.decision).toBe('BLOCK');
    expect(result.reason).toContain('No matching policy');
  });

  it('defaults to ALLOW when zero-trust is disabled and no policy matches', () => {
    const result = evaluatePolicies(policies, {
      agentRole: 'UnknownAgent',
      toolName: 'UnknownTool',
      action: 'UNKNOWN',
    }, { zeroTrust: false });
    expect(result.decision).toBe('ALLOW');
    expect(result.matchedPolicy).toBeNull();
  });

  it('defaults to BLOCK when action is unknown and no policy matches (zero-trust)', () => {
    const result = evaluatePolicies(policies, {
      agentRole: 'UnknownAgent',
      toolName: 'UnknownTool',
      arguments: {}, // No action can be inferred
    });
    // When action cannot be inferred and no policies match, default deny
    expect(result.decision).toBe('BLOCK');
    expect(result.reason).toContain('No matching policy');
  });

  it('skips disabled policies and defaults to BLOCK (zero-trust)', () => {
    const disabledPolicies: PolicyDefinition[] = [
      {
        policyId: 'POL-DISABLED',
        name: 'Disabled policy',
        agentRole: 'DataAgent',
        resource: 'PostgreSQL',
        action: 'DROP',
        permissionLevel: 'BLOCK',
        priority: 20,
        enabled: false,
      },
    ];
    const result = evaluatePolicies(disabledPolicies, {
      agentRole: 'DataAgent',
      toolName: 'PostgreSQL',
      action: 'DROP',
    });
    // All matching policies are disabled, zero-trust default is BLOCK
    expect(result.decision).toBe('BLOCK');
    expect(result.matchedPolicy).toBeNull();
  });

  it('infers action from SQL query when not provided', () => {
    const result = evaluatePolicies(policies, {
      agentRole: 'DataAgent',
      toolName: 'PostgreSQL',
      arguments: { query: 'DROP TABLE users' },
    });
    expect(result.decision).toBe('BLOCK');
  });

  it('uses explicit action when provided', () => {
    const result = evaluatePolicies(policies, {
      agentRole: 'DataAgent',
      toolName: 'PostgreSQL',
      action: 'SELECT',
      arguments: { query: 'DROP TABLE users' }, // action overrides query inference
    });
    expect(result.decision).toBe('ALLOW');
  });

  it('handles zero-trust mode when action cannot be inferred', () => {
    const result = evaluatePolicies(policies, {
      agentRole: 'DataAgent',
      toolName: 'PostgreSQL',
      arguments: {}, // No way to infer action
    });
    // Should be BLOCK because we have matching policies for DataAgent+PostgreSQL
    // but can't determine the action, so most restrictive wins
    expect(result.decision).toBe('BLOCK');
    expect(result.reason).toContain('zero-trust');
  });

  it('respects priority ordering (BLOCK > REQUIRE_APPROVAL > ALLOW)', () => {
    const mixedPolicies: PolicyDefinition[] = [
      {
        policyId: 'POL-ALLOW',
        name: 'Allow policy',
        agentRole: 'DataAgent',
        resource: 'PostgreSQL',
        action: 'WRITE',
        permissionLevel: 'ALLOW',
        priority: 5,
        enabled: true,
      },
      {
        policyId: 'POL-BLOCK',
        name: 'Block policy',
        agentRole: 'DataAgent',
        resource: 'PostgreSQL',
        action: 'WRITE',
        permissionLevel: 'BLOCK',
        priority: 15,
        enabled: true,
      },
      {
        policyId: 'POL-APPROVAL',
        name: 'Approval policy',
        agentRole: 'DataAgent',
        resource: 'PostgreSQL',
        action: 'WRITE',
        permissionLevel: 'REQUIRE_APPROVAL',
        priority: 10,
        enabled: true,
      },
    ];

    const result = evaluatePolicies(mixedPolicies, {
      agentRole: 'DataAgent',
      toolName: 'PostgreSQL',
      action: 'WRITE',
    });
    expect(result.decision).toBe('BLOCK');
    expect(result.matchedPolicy?.policyId).toBe('POL-BLOCK');
  });
});
