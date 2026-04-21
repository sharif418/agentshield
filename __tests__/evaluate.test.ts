import { describe, test, expect } from 'bun:test';
import {
  evaluateConditions,
  inferAction,
  enrichArgsFromQuery,
  getMatchingActions,
} from '../src/lib/policy-engine';

// ============================================================================
// evaluateConditions
// ============================================================================

describe('evaluateConditions', () => {
  test('simple equality match', () => {
    const rules = { operation: 'DROP_TABLE' };
    const args = { operation: 'DROP_TABLE', query: 'DROP TABLE users' };
    expect(evaluateConditions(rules, args)).toBe(true);
  });

  test('simple equality mismatch', () => {
    const rules = { operation: 'DROP_TABLE' };
    const args = { operation: 'SELECT', query: 'SELECT * FROM users' };
    expect(evaluateConditions(rules, args)).toBe(false);
  });

  test('$contains operator - match', () => {
    const rules = { query: { $contains: 'DROP' } };
    const args = { query: 'DROP TABLE users' };
    expect(evaluateConditions(rules, args)).toBe(true);
  });

  test('$contains operator - no match', () => {
    const rules = { query: { $contains: 'DROP' } };
    const args = { query: 'SELECT * FROM users' };
    expect(evaluateConditions(rules, args)).toBe(false);
  });

  test('$equals operator - match', () => {
    const rules = { operation: { $equals: 'DROP_TABLE' } };
    const args = { operation: 'DROP_TABLE' };
    expect(evaluateConditions(rules, args)).toBe(true);
  });

  test('$equals operator - no match', () => {
    const rules = { operation: { $equals: 'DROP_TABLE' } };
    const args = { operation: 'SELECT' };
    expect(evaluateConditions(rules, args)).toBe(false);
  });

  test('$in operator - match', () => {
    const rules = { operation: { $in: ['DROP_TABLE', 'DROP_DATABASE', 'DROP'] } };
    const args = { operation: 'DROP_TABLE' };
    expect(evaluateConditions(rules, args)).toBe(true);
  });

  test('$in operator - no match', () => {
    const rules = { operation: { $in: ['DROP_TABLE', 'DROP_DATABASE'] } };
    const args = { operation: 'SELECT' };
    expect(evaluateConditions(rules, args)).toBe(false);
  });

  test('$gt operator - greater than', () => {
    const rules = { amount: { $gt: 100 } };
    const args = { amount: 200 };
    expect(evaluateConditions(rules, args)).toBe(true);
  });

  test('$gt operator - equal (not greater)', () => {
    const rules = { amount: { $gt: 100 } };
    const args = { amount: 100 };
    expect(evaluateConditions(rules, args)).toBe(false);
  });

  test('$gt operator - less than', () => {
    const rules = { amount: { $gt: 100 } };
    const args = { amount: 50 };
    expect(evaluateConditions(rules, args)).toBe(false);
  });

  test('$lt operator - less than', () => {
    const rules = { amount: { $lt: 1000 } };
    const args = { amount: 500 };
    expect(evaluateConditions(rules, args)).toBe(true);
  });

  test('$lt operator - equal (not less)', () => {
    const rules = { amount: { $lt: 1000 } };
    const args = { amount: 1000 };
    expect(evaluateConditions(rules, args)).toBe(false);
  });

  test('$lt operator - greater than', () => {
    const rules = { amount: { $lt: 1000 } };
    const args = { amount: 1500 };
    expect(evaluateConditions(rules, args)).toBe(false);
  });

  test('$and logical operator - all true', () => {
    const rules = {
      $and: [
        { operation: { $contains: 'DROP' } },
        { query: { $contains: 'TABLE' } },
      ],
    };
    const args = { operation: 'DROP_TABLE', query: 'DROP TABLE users' };
    expect(evaluateConditions(rules, args)).toBe(true);
  });

  test('$and logical operator - one false', () => {
    const rules = {
      $and: [
        { operation: { $contains: 'DROP' } },
        { query: { $contains: 'INSERT' } },
      ],
    };
    const args = { operation: 'DROP_TABLE', query: 'DROP TABLE users' };
    expect(evaluateConditions(rules, args)).toBe(false);
  });

  test('$or logical operator - one true', () => {
    const rules = {
      $or: [
        { operation: 'SELECT' },
        { operation: 'DROP_TABLE' },
      ],
    };
    const args = { operation: 'DROP_TABLE' };
    expect(evaluateConditions(rules, args)).toBe(true);
  });

  test('$or logical operator - all false', () => {
    const rules = {
      $or: [
        { operation: 'SELECT' },
        { operation: 'INSERT' },
      ],
    };
    const args = { operation: 'DROP_TABLE' };
    expect(evaluateConditions(rules, args)).toBe(false);
  });

  test('returns true when no conditions fail (empty rules)', () => {
    const rules = {};
    const args = { anything: 'here' };
    expect(evaluateConditions(rules, args)).toBe(true);
  });

  test('returns true when all conditions match', () => {
    const rules = { operation: 'DROP_TABLE', database: 'production' };
    const args = { operation: 'DROP_TABLE', database: 'production', extra: 'field' };
    expect(evaluateConditions(rules, args)).toBe(true);
  });

  test('returns false when arg value is missing for equality check', () => {
    const rules = { operation: 'DROP_TABLE' };
    const args = {};
    expect(evaluateConditions(rules, args)).toBe(false);
  });

  test('combined $gt and $lt operators via $and', () => {
    const rules = {
      $and: [
        { amount: { $gt: 100 } },
        { amount: { $lt: 1000 } },
      ],
    };
    const args = { amount: 500 };
    expect(evaluateConditions(rules, args)).toBe(true);
  });

  test('combined $gt and $lt via $and - value out of upper range', () => {
    const rules = {
      $and: [
        { amount: { $gt: 100 } },
        { amount: { $lt: 1000 } },
      ],
    };
    const args = { amount: 1500 };
    expect(evaluateConditions(rules, args)).toBe(false);
  });
});

// ============================================================================
// inferAction
// ============================================================================

describe('inferAction', () => {
  test('infers from operation field', () => {
    const args = { operation: 'DROP_TABLE' };
    expect(inferAction(args, 'PostgreSQL')).toBe('DROP_TABLE');
  });

  test('infers from action field', () => {
    const args = { action: 'write' };
    expect(inferAction(args, 'PostgreSQL')).toBe('WRITE');
  });

  test('infers from method field', () => {
    const args = { method: 'POST' };
    expect(inferAction(args, 'SomeTool')).toBe('POST');
  });

  test('infers from SQL query keyword SELECT', () => {
    const args = { query: 'SELECT * FROM users' };
    expect(inferAction(args, 'PostgreSQL')).toBe('SELECT');
  });

  test('infers from SQL query keyword DROP', () => {
    const args = { query: 'DROP TABLE users' };
    expect(inferAction(args, 'PostgreSQL')).toBe('DROP');
  });

  test('infers from SQL query keyword INSERT', () => {
    const args = { query: 'INSERT INTO users VALUES (1, "test")' };
    expect(inferAction(args, 'PostgreSQL')).toBe('INSERT');
  });

  test('infers from SQL query keyword UPDATE', () => {
    const args = { query: 'UPDATE users SET name = "test"' };
    expect(inferAction(args, 'PostgreSQL')).toBe('UPDATE');
  });

  test('infers from SQL query keyword DELETE', () => {
    const args = { query: 'DELETE FROM users WHERE id = 1' };
    expect(inferAction(args, 'PostgreSQL')).toBe('DELETE');
  });

  test('infers from SQL query keyword TRUNCATE', () => {
    const args = { query: 'TRUNCATE TABLE users' };
    expect(inferAction(args, 'PostgreSQL')).toBe('TRUNCATE');
  });

  test('infers from SQL query keyword ALTER → ADMIN', () => {
    const args = { query: 'ALTER TABLE users ADD COLUMN email TEXT' };
    expect(inferAction(args, 'PostgreSQL')).toBe('ADMIN');
  });

  test('infers from SQL query keyword CREATE → ADMIN', () => {
    const args = { query: 'CREATE TABLE new_table (id INT)' };
    expect(inferAction(args, 'PostgreSQL')).toBe('ADMIN');
  });

  test('infers from SQL query keyword GRANT → ADMIN', () => {
    const args = { query: 'GRANT ALL ON users TO admin' };
    expect(inferAction(args, 'PostgreSQL')).toBe('ADMIN');
  });

  test('infers from EmailAPI with "to" field → SEND', () => {
    const args = { to: 'user@example.com', subject: 'Hello' };
    expect(inferAction(args, 'EmailAPI')).toBe('SEND');
  });

  test('infers from EmailAPI without "to" field → READ', () => {
    const args = { folder: 'inbox' };
    expect(inferAction(args, 'EmailAPI')).toBe('READ');
  });

  test('infers from SlackAPI with channel and text → POST_MESSAGE', () => {
    const args = { channel: '#general', text: 'Hello world' };
    expect(inferAction(args, 'SlackAPI')).toBe('POST_MESSAGE');
  });

  test('infers from SlackAPI without channel/text → READ', () => {
    const args = { channel: '#general' };
    expect(inferAction(args, 'SlackAPI')).toBe('READ');
  });

  test('returns null when nothing matches', () => {
    const args = { someField: 'someValue' };
    expect(inferAction(args, 'UnknownTool')).toBeNull();
  });

  test('prioritizes operation field over query inference', () => {
    const args = { operation: 'DELETE', query: 'SELECT * FROM users' };
    expect(inferAction(args, 'PostgreSQL')).toBe('DELETE');
  });
});

// ============================================================================
// enrichArgsFromQuery
// ============================================================================

describe('enrichArgsFromQuery', () => {
  test('adds operation from DROP TABLE query', () => {
    const args = { query: 'DROP TABLE users' };
    const result = enrichArgsFromQuery(args);
    expect(result.operation).toBe('DROP_TABLE');
  });

  test('adds operation from DROP DATABASE query', () => {
    const args = { query: 'DROP DATABASE production' };
    const result = enrichArgsFromQuery(args);
    expect(result.operation).toBe('DROP_DATABASE');
  });

  test('adds operation from generic DROP query', () => {
    const args = { query: 'DROP INDEX my_index' };
    const result = enrichArgsFromQuery(args);
    expect(result.operation).toBe('DROP');
  });

  test('adds operation from INSERT query', () => {
    const args = { query: 'INSERT INTO users VALUES (1, "test")' };
    const result = enrichArgsFromQuery(args);
    expect(result.operation).toBe('INSERT');
  });

  test('skips when operation already present', () => {
    const args = { query: 'DROP TABLE users', operation: 'EXISTING_OP' };
    const result = enrichArgsFromQuery(args);
    expect(result.operation).toBe('EXISTING_OP');
  });

  test('skips when no query field', () => {
    const args = { someField: 'someValue' };
    const result = enrichArgsFromQuery(args);
    expect(result.operation).toBeUndefined();
  });

  test('skips when query is not a string', () => {
    const args = { query: 123 };
    const result = enrichArgsFromQuery(args);
    expect(result.operation).toBeUndefined();
  });

  test('preserves other args when enriching', () => {
    const args = { query: 'SELECT * FROM users', database: 'production' };
    const result = enrichArgsFromQuery(args);
    expect(result.operation).toBe('SELECT');
    expect(result.database).toBe('production');
    expect(result.query).toBe('SELECT * FROM users');
  });

  test('handles UPDATE query', () => {
    const args = { query: 'UPDATE users SET name = "test"' };
    const result = enrichArgsFromQuery(args);
    expect(result.operation).toBe('UPDATE');
  });

  test('handles DELETE query', () => {
    const args = { query: 'DELETE FROM users WHERE id = 1' };
    const result = enrichArgsFromQuery(args);
    expect(result.operation).toBe('DELETE');
  });

  test('handles TRUNCATE query', () => {
    const args = { query: 'TRUNCATE TABLE users' };
    const result = enrichArgsFromQuery(args);
    expect(result.operation).toBe('TRUNCATE');
  });

  test('handles ALTER query', () => {
    const args = { query: 'ALTER TABLE users ADD COLUMN email TEXT' };
    const result = enrichArgsFromQuery(args);
    expect(result.operation).toBe('ALTER');
  });

  test('handles CREATE query', () => {
    const args = { query: 'CREATE TABLE new_table (id INT)' };
    const result = enrichArgsFromQuery(args);
    expect(result.operation).toBe('CREATE');
  });

  test('handles GRANT query', () => {
    const args = { query: 'GRANT ALL ON users TO admin' };
    const result = enrichArgsFromQuery(args);
    expect(result.operation).toBe('GRANT');
  });

  test('returns args unchanged for unrecognized query', () => {
    const args = { query: 'EXPLAIN SELECT * FROM users' };
    const result = enrichArgsFromQuery(args);
    expect(result.operation).toBeUndefined();
  });
});

// ============================================================================
// getMatchingActions
// ============================================================================

describe('getMatchingActions', () => {
  test('returns matching actions for known actions - SELECT', () => {
    const result = getMatchingActions('SELECT');
    expect(result).toContain('SELECT');
    expect(result).toContain('READ');
    expect(result).toContain('GET');
    expect(result).toContain('LIST');
    expect(result).toContain('SEARCH');
  });

  test('returns matching actions for known actions - DROP', () => {
    const result = getMatchingActions('DROP');
    expect(result).toContain('DROP');
    expect(result).toContain('ADMIN');
    expect(result).toContain('WRITE');
  });

  test('returns matching actions for known actions - INSERT', () => {
    const result = getMatchingActions('INSERT');
    expect(result).toContain('INSERT');
    expect(result).toContain('WRITE');
    expect(result).toContain('INSERT_UPDATE_DELETE');
  });

  test('returns [action] for unknown actions', () => {
    const result = getMatchingActions('UNKNOWN_ACTION');
    expect(result).toEqual(['UNKNOWN_ACTION']);
  });

  test('deduplicates actions', () => {
    const result = getMatchingActions('SELECT');
    // SELECT appears in the actionMap value and is also prepended,
    // but Set deduplication should ensure it only appears once
    const selectCount = result.filter((a) => a === 'SELECT').length;
    expect(selectCount).toBe(1);
  });

  test('always includes the original action', () => {
    const result = getMatchingActions('DELETE');
    expect(result[0]).toBe('DELETE');
  });

  test('handles REFUND action', () => {
    const result = getMatchingActions('REFUND');
    expect(result).toContain('REFUND');
    expect(result).toContain('WRITE');
  });

  test('handles POST_MESSAGE action', () => {
    const result = getMatchingActions('POST_MESSAGE');
    expect(result).toContain('POST_MESSAGE');
    expect(result).toContain('WRITE');
  });

  test('handles SEND action', () => {
    const result = getMatchingActions('SEND');
    expect(result).toContain('SEND');
    expect(result).toContain('WRITE');
  });

  test('handles TRUNCATE action', () => {
    const result = getMatchingActions('TRUNCATE');
    expect(result).toContain('TRUNCATE');
    expect(result).toContain('DROP');
    expect(result).toContain('ADMIN');
    expect(result).toContain('WRITE');
  });
});
