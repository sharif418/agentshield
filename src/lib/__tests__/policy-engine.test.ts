import { describe, it, expect } from 'vitest'
import {
  evaluateConditions,
  inferAction,
  enrichArgsFromQuery,
  getMatchingActions,
} from '../policy-engine'

// ---------------------------------------------------------------------------
// evaluateConditions
// ---------------------------------------------------------------------------
describe('evaluateConditions', () => {
  // ---- Simple equality ----
  describe('simple equality', () => {
    it('returns true when field value matches', () => {
      expect(evaluateConditions({ agentRole: 'DataAgent' }, { agentRole: 'DataAgent' })).toBe(true)
    })

    it('returns false when field value does not match', () => {
      expect(evaluateConditions({ agentRole: 'DataAgent' }, { agentRole: 'CodeAgent' })).toBe(false)
    })

    it('returns false when field is missing from args', () => {
      expect(evaluateConditions({ agentRole: 'DataAgent' }, {})).toBe(false)
    })

    it('handles numeric equality', () => {
      expect(evaluateConditions({ amount: 100 }, { amount: 100 })).toBe(true)
      expect(evaluateConditions({ amount: 100 }, { amount: 200 })).toBe(false)
    })

    it('handles boolean equality', () => {
      expect(evaluateConditions({ enabled: true }, { enabled: true })).toBe(true)
      expect(evaluateConditions({ enabled: true }, { enabled: false })).toBe(false)
    })

    it('handles multiple field conditions (implicit AND)', () => {
      const rules = { agentRole: 'DataAgent', resource: 'PostgreSQL' }
      expect(evaluateConditions(rules, { agentRole: 'DataAgent', resource: 'PostgreSQL' })).toBe(true)
      expect(evaluateConditions(rules, { agentRole: 'DataAgent', resource: 'MySQL' })).toBe(false)
      expect(evaluateConditions(rules, { agentRole: 'CodeAgent', resource: 'PostgreSQL' })).toBe(false)
    })
  })

  // ---- $and operator ----
  describe('$and operator', () => {
    it('returns true when all conditions in $and are satisfied', () => {
      const rules = {
        $and: [
          { agentRole: 'DataAgent' },
          { resource: 'PostgreSQL' },
        ],
      }
      expect(evaluateConditions(rules, { agentRole: 'DataAgent', resource: 'PostgreSQL' })).toBe(true)
    })

    it('returns false when one condition in $and fails', () => {
      const rules = {
        $and: [
          { agentRole: 'DataAgent' },
          { resource: 'PostgreSQL' },
        ],
      }
      expect(evaluateConditions(rules, { agentRole: 'DataAgent', resource: 'MySQL' })).toBe(false)
    })

    it('returns false when all conditions in $and fail', () => {
      const rules = {
        $and: [
          { agentRole: 'DataAgent' },
          { resource: 'PostgreSQL' },
        ],
      }
      expect(evaluateConditions(rules, { agentRole: 'CodeAgent', resource: 'MySQL' })).toBe(false)
    })

    it('handles empty $and array (every on empty is true)', () => {
      expect(evaluateConditions({ $and: [] }, { agentRole: 'DataAgent' })).toBe(true)
    })
  })

  // ---- $or operator ----
  describe('$or operator', () => {
    it('returns true when at least one condition in $or is satisfied', () => {
      const rules = {
        $or: [
          { agentRole: 'DataAgent' },
          { agentRole: 'CodeAgent' },
        ],
      }
      expect(evaluateConditions(rules, { agentRole: 'DataAgent' })).toBe(true)
      expect(evaluateConditions(rules, { agentRole: 'CodeAgent' })).toBe(true)
    })

    it('returns false when no condition in $or is satisfied', () => {
      const rules = {
        $or: [
          { agentRole: 'DataAgent' },
          { agentRole: 'CodeAgent' },
        ],
      }
      expect(evaluateConditions(rules, { agentRole: 'FinanceAgent' })).toBe(false)
    })

    it('handles empty $or array (some on empty is false)', () => {
      expect(evaluateConditions({ $or: [] }, { agentRole: 'DataAgent' })).toBe(false)
    })
  })

  // ---- $contains operator ----
  describe('$contains operator', () => {
    it('returns true when string contains the substring', () => {
      expect(evaluateConditions({ query: { $contains: 'DROP' } }, { query: 'DROP TABLE users' })).toBe(true)
    })

    it('returns false when string does not contain the substring', () => {
      expect(evaluateConditions({ query: { $contains: 'DROP' } }, { query: 'SELECT * FROM users' })).toBe(false)
    })

    it('is case-sensitive', () => {
      expect(evaluateConditions({ query: { $contains: 'DROP' } }, { query: 'drop table users' })).toBe(false)
    })

    it('skips $contains when the field is not a string (does not fail)', () => {
      // When argValue is not a string, $contains cannot be evaluated, so the condition is skipped
      // and the overall evaluation returns true (no failing condition found)
      expect(evaluateConditions({ amount: { $contains: '100' } }, { amount: 100 })).toBe(true)
    })

    it('skips $contains when the field is missing (does not fail)', () => {
      // Missing field yields undefined, which is not a string, so $contains is skipped
      expect(evaluateConditions({ query: { $contains: 'DROP' } }, {})).toBe(true)
    })

    it('handles partial matches in the middle of string', () => {
      expect(evaluateConditions({ query: { $contains: 'TABLE' } }, { query: 'DROP TABLE users' })).toBe(true)
    })
  })

  // ---- $equals operator ----
  describe('$equals operator', () => {
    it('returns true when value equals the specified value', () => {
      expect(evaluateConditions({ agentRole: { $equals: 'DataAgent' } }, { agentRole: 'DataAgent' })).toBe(true)
    })

    it('returns false when value does not equal the specified value', () => {
      expect(evaluateConditions({ agentRole: { $equals: 'DataAgent' } }, { agentRole: 'CodeAgent' })).toBe(false)
    })

    it('handles numeric equality', () => {
      expect(evaluateConditions({ amount: { $equals: 100 } }, { amount: 100 })).toBe(true)
      expect(evaluateConditions({ amount: { $equals: 100 } }, { amount: 200 })).toBe(false)
    })

    it('handles null comparison', () => {
      expect(evaluateConditions({ field: { $equals: null } }, { field: null })).toBe(true)
    })

    it('returns false when field is missing (undefined !== value)', () => {
      expect(evaluateConditions({ field: { $equals: 'test' } }, {})).toBe(false)
    })
  })

  // ---- $in operator ----
  describe('$in operator', () => {
    it('returns true when value is in the list', () => {
      expect(
        evaluateConditions(
          { agentRole: { $in: ['DataAgent', 'CodeAgent', 'FinanceAgent'] } },
          { agentRole: 'DataAgent' },
        ),
      ).toBe(true)
    })

    it('returns false when value is not in the list', () => {
      expect(
        evaluateConditions(
          { agentRole: { $in: ['DataAgent', 'CodeAgent'] } },
          { agentRole: 'FinanceAgent' },
        ),
      ).toBe(false)
    })

    it('returns false when field is missing', () => {
      expect(
        evaluateConditions(
          { agentRole: { $in: ['DataAgent', 'CodeAgent'] } },
          {},
        ),
      ).toBe(false)
    })

    it('handles numeric values in $in', () => {
      expect(evaluateConditions({ priority: { $in: [10, 20, 30] } }, { priority: 20 })).toBe(true)
      expect(evaluateConditions({ priority: { $in: [10, 20, 30] } }, { priority: 50 })).toBe(false)
    })
  })

  // ---- $gt operator ----
  describe('$gt operator', () => {
    it('returns true when numeric value is greater than threshold', () => {
      expect(evaluateConditions({ amount: { $gt: 100 } }, { amount: 200 })).toBe(true)
    })

    it('returns false when numeric value equals threshold', () => {
      expect(evaluateConditions({ amount: { $gt: 100 } }, { amount: 100 })).toBe(false)
    })

    it('returns false when numeric value is less than threshold', () => {
      expect(evaluateConditions({ amount: { $gt: 100 } }, { amount: 50 })).toBe(false)
    })

    it('skips $gt when field is not a number (does not fail)', () => {
      // When argValue is not a number, $gt cannot be evaluated, so the condition is skipped
      expect(evaluateConditions({ amount: { $gt: 100 } }, { amount: '200' })).toBe(true)
    })

    it('skips $gt when field is missing (does not fail)', () => {
      // Missing field yields undefined, which is not a number, so $gt is skipped
      expect(evaluateConditions({ amount: { $gt: 100 } }, {})).toBe(true)
    })
  })

  // ---- $lt operator ----
  describe('$lt operator', () => {
    it('returns true when numeric value is less than threshold', () => {
      expect(evaluateConditions({ amount: { $lt: 100 } }, { amount: 50 })).toBe(true)
    })

    it('returns false when numeric value equals threshold', () => {
      expect(evaluateConditions({ amount: { $lt: 100 } }, { amount: 100 })).toBe(false)
    })

    it('returns false when numeric value is greater than threshold', () => {
      expect(evaluateConditions({ amount: { $lt: 100 } }, { amount: 200 })).toBe(false)
    })

    it('skips $lt when field is not a number (does not fail)', () => {
      // When argValue is not a number, $lt cannot be evaluated, so the condition is skipped
      expect(evaluateConditions({ amount: { $lt: 100 } }, { amount: '50' })).toBe(true)
    })

    it('skips $lt when field is missing (does not fail)', () => {
      // Missing field yields undefined, which is not a number, so $lt is skipped
      expect(evaluateConditions({ amount: { $lt: 100 } }, {})).toBe(true)
    })
  })

  // ---- Nested conditions ----
  describe('nested conditions', () => {
    it('handles $and containing $or', () => {
      const rules = {
        $and: [
          { resource: 'PostgreSQL' },
          {
            $or: [
              { agentRole: 'DataAgent' },
              { agentRole: 'CodeAgent' },
            ],
          },
        ],
      }
      expect(evaluateConditions(rules, { resource: 'PostgreSQL', agentRole: 'DataAgent' })).toBe(true)
      expect(evaluateConditions(rules, { resource: 'PostgreSQL', agentRole: 'CodeAgent' })).toBe(true)
      expect(evaluateConditions(rules, { resource: 'PostgreSQL', agentRole: 'FinanceAgent' })).toBe(false)
      expect(evaluateConditions(rules, { resource: 'MySQL', agentRole: 'DataAgent' })).toBe(false)
    })

    it('handles $or containing $and', () => {
      const rules = {
        $or: [
          {
            $and: [
              { agentRole: 'DataAgent' },
              { resource: 'PostgreSQL' },
            ],
          },
          { agentRole: 'Admin' },
        ],
      }
      expect(evaluateConditions(rules, { agentRole: 'DataAgent', resource: 'PostgreSQL' })).toBe(true)
      expect(evaluateConditions(rules, { agentRole: 'Admin', resource: 'MySQL' })).toBe(true)
      expect(evaluateConditions(rules, { agentRole: 'DataAgent', resource: 'MySQL' })).toBe(false)
    })

    it('handles deeply nested conditions', () => {
      const rules = {
        $and: [
          { resource: 'PostgreSQL' },
          {
            $or: [
              {
                $and: [
                  { agentRole: 'DataAgent' },
                  { operation: 'SELECT' },
                ],
              },
              { agentRole: 'Admin' },
            ],
          },
        ],
      }
      expect(evaluateConditions(rules, { resource: 'PostgreSQL', agentRole: 'DataAgent', operation: 'SELECT' })).toBe(true)
      expect(evaluateConditions(rules, { resource: 'PostgreSQL', agentRole: 'Admin' })).toBe(true)
      expect(evaluateConditions(rules, { resource: 'PostgreSQL', agentRole: 'DataAgent', operation: 'DROP' })).toBe(false)
    })
  })

  // ---- Empty rules ----
  describe('empty rules', () => {
    it('returns true for empty rules object', () => {
      expect(evaluateConditions({}, { agentRole: 'DataAgent' })).toBe(true)
    })

    it('returns true for empty rules and empty args', () => {
      expect(evaluateConditions({}, {})).toBe(true)
    })
  })

  // ---- Mixed conditions ----
  describe('mixed operators in field conditions', () => {
    it('combines $contains with simple equality across fields', () => {
      const rules = {
        agentRole: 'DataAgent',
        query: { $contains: 'DROP' },
      }
      expect(evaluateConditions(rules, { agentRole: 'DataAgent', query: 'DROP TABLE users' })).toBe(true)
      expect(evaluateConditions(rules, { agentRole: 'CodeAgent', query: 'DROP TABLE users' })).toBe(false)
      expect(evaluateConditions(rules, { agentRole: 'DataAgent', query: 'SELECT * FROM users' })).toBe(false)
    })

    it('combines $gt and $lt for range check', () => {
      const rules = {
        amount: { $gt: 100 },
        priority: { $lt: 50 },
      }
      expect(evaluateConditions(rules, { amount: 200, priority: 30 })).toBe(true)
      expect(evaluateConditions(rules, { amount: 50, priority: 30 })).toBe(false)
      expect(evaluateConditions(rules, { amount: 200, priority: 60 })).toBe(false)
    })
  })
})

// ---------------------------------------------------------------------------
// inferAction
// ---------------------------------------------------------------------------
describe('inferAction', () => {
  // ---- Explicit operation field ----
  describe('explicit operation field', () => {
    it('returns uppercase operation when args.operation is set', () => {
      expect(inferAction({ operation: 'drop' }, 'PostgreSQL')).toBe('DROP')
      expect(inferAction({ operation: 'SELECT' }, 'PostgreSQL')).toBe('SELECT')
    })
  })

  // ---- Explicit action field ----
  describe('explicit action field', () => {
    it('returns uppercase action when args.action is set (and no operation)', () => {
      expect(inferAction({ action: 'write' }, 'PostgreSQL')).toBe('WRITE')
      expect(inferAction({ action: 'READ' }, 'PostgreSQL')).toBe('READ')
    })

    it('prioritizes operation over action', () => {
      expect(inferAction({ operation: 'DROP', action: 'READ' }, 'PostgreSQL')).toBe('DROP')
    })
  })

  // ---- Explicit method field ----
  describe('explicit method field', () => {
    it('returns uppercase method when args.method is set (and no operation/action)', () => {
      expect(inferAction({ method: 'post' }, 'HTTPClient')).toBe('POST')
      expect(inferAction({ method: 'GET' }, 'HTTPClient')).toBe('GET')
    })

    it('prioritizes operation and action over method', () => {
      expect(inferAction({ operation: 'DROP', method: 'GET' }, 'PostgreSQL')).toBe('DROP')
      expect(inferAction({ action: 'WRITE', method: 'GET' }, 'PostgreSQL')).toBe('WRITE')
    })
  })

  // ---- SQL query inference ----
  describe('SQL query inference', () => {
    it('infers SELECT from a SELECT query', () => {
      expect(inferAction({ query: 'SELECT * FROM users' }, 'PostgreSQL')).toBe('SELECT')
    })

    it('infers INSERT from an INSERT query', () => {
      expect(inferAction({ query: 'INSERT INTO users VALUES (1, "test")' }, 'PostgreSQL')).toBe('INSERT')
    })

    it('infers UPDATE from an UPDATE query', () => {
      expect(inferAction({ query: 'UPDATE users SET name = "test"' }, 'PostgreSQL')).toBe('UPDATE')
    })

    it('infers DELETE from a DELETE query', () => {
      expect(inferAction({ query: 'DELETE FROM users WHERE id = 1' }, 'PostgreSQL')).toBe('DELETE')
    })

    it('infers DROP from a DROP query', () => {
      expect(inferAction({ query: 'DROP TABLE users' }, 'PostgreSQL')).toBe('DROP')
    })

    it('infers TRUNCATE from a TRUNCATE query', () => {
      expect(inferAction({ query: 'TRUNCATE TABLE users' }, 'PostgreSQL')).toBe('TRUNCATE')
    })

    it('infers ADMIN from ALTER query', () => {
      expect(inferAction({ query: 'ALTER TABLE users ADD COLUMN email TEXT' }, 'PostgreSQL')).toBe('ADMIN')
    })

    it('infers ADMIN from CREATE query', () => {
      expect(inferAction({ query: 'CREATE TABLE users (id INT)' }, 'PostgreSQL')).toBe('ADMIN')
    })

    it('infers ADMIN from GRANT query', () => {
      expect(inferAction({ query: 'GRANT ALL ON users TO public' }, 'PostgreSQL')).toBe('ADMIN')
    })

    it('handles lowercase SQL keywords', () => {
      expect(inferAction({ query: 'select * from users' }, 'PostgreSQL')).toBe('SELECT')
      expect(inferAction({ query: 'drop table users' }, 'PostgreSQL')).toBe('DROP')
    })

    it('handles leading whitespace in query', () => {
      expect(inferAction({ query: '  DROP TABLE users' }, 'PostgreSQL')).toBe('DROP')
    })

    it('prioritizes explicit operation over SQL query inference', () => {
      expect(inferAction({ operation: 'READ', query: 'DROP TABLE users' }, 'PostgreSQL')).toBe('READ')
    })

    it('does not infer from non-string query', () => {
      expect(inferAction({ query: 123 }, 'PostgreSQL')).toBe(null)
    })
  })

  // ---- HTTP method inference ----
  describe('HTTP method inference', () => {
    it('infers from httpMethod field', () => {
      expect(inferAction({ httpMethod: 'POST' }, 'HTTPClient')).toBe('POST')
      expect(inferAction({ httpMethod: 'GET' }, 'HTTPClient')).toBe('GET')
      expect(inferAction({ httpMethod: 'delete' }, 'HTTPClient')).toBe('DELETE')
    })

    it('prioritizes operation/action/method over httpMethod', () => {
      expect(inferAction({ operation: 'WRITE', httpMethod: 'GET' }, 'HTTPClient')).toBe('WRITE')
      expect(inferAction({ action: 'READ', httpMethod: 'POST' }, 'HTTPClient')).toBe('READ')
      expect(inferAction({ method: 'PUT', httpMethod: 'GET' }, 'HTTPClient')).toBe('PUT')
    })
  })

  // ---- Tool-specific inference: EmailAPI ----
  describe('EmailAPI-specific inference', () => {
    it('infers SEND when to field is present', () => {
      expect(inferAction({ to: 'user@example.com' }, 'EmailAPI')).toBe('SEND')
    })

    it('infers SEND when to and other fields are present', () => {
      expect(inferAction({ to: 'user@example.com', subject: 'Hello', body: 'World' }, 'EmailAPI')).toBe('SEND')
    })

    it('infers READ when no to field is present', () => {
      expect(inferAction({}, 'EmailAPI')).toBe('READ')
      expect(inferAction({ subject: 'Hello' }, 'EmailAPI')).toBe('READ')
    })

    it('still prioritizes explicit operation over EmailAPI inference', () => {
      expect(inferAction({ operation: 'DELETE', to: 'user@example.com' }, 'EmailAPI')).toBe('DELETE')
    })
  })

  // ---- Tool-specific inference: SlackAPI ----
  describe('SlackAPI-specific inference', () => {
    it('infers POST_MESSAGE when channel and text are both present', () => {
      expect(inferAction({ channel: '#general', text: 'Hello world' }, 'SlackAPI')).toBe('POST_MESSAGE')
    })

    it('infers READ when only channel is present (no text)', () => {
      expect(inferAction({ channel: '#general' }, 'SlackAPI')).toBe('READ')
    })

    it('infers READ when only text is present (no channel)', () => {
      expect(inferAction({ text: 'Hello world' }, 'SlackAPI')).toBe('READ')
    })

    it('infers READ when neither channel nor text is present', () => {
      expect(inferAction({}, 'SlackAPI')).toBe('READ')
    })

    it('still prioritizes explicit operation over SlackAPI inference', () => {
      expect(inferAction({ operation: 'DELETE', channel: '#general', text: 'Hello' }, 'SlackAPI')).toBe('DELETE')
    })
  })

  // ---- Unknown tool with no hints ----
  describe('unknown tool with no hints', () => {
    it('returns null when no inference is possible', () => {
      expect(inferAction({}, 'UnknownTool')).toBe(null)
    })

    it('returns null for tool with only unrecognized fields', () => {
      expect(inferAction({ foo: 'bar' }, 'UnknownTool')).toBe(null)
    })
  })
})

// ---------------------------------------------------------------------------
// enrichArgsFromQuery
// ---------------------------------------------------------------------------
describe('enrichArgsFromQuery', () => {
  // ---- DROP TABLE ----
  it('enriches DROP TABLE query with operation DROP_TABLE', () => {
    const result = enrichArgsFromQuery({ query: 'DROP TABLE users' })
    expect(result).toEqual({ query: 'DROP TABLE users', operation: 'DROP_TABLE' })
  })

  // ---- DROP DATABASE ----
  it('enriches DROP DATABASE query with operation DROP_DATABASE', () => {
    const result = enrichArgsFromQuery({ query: 'DROP DATABASE production' })
    expect(result).toEqual({ query: 'DROP DATABASE production', operation: 'DROP_DATABASE' })
  })

  // ---- Generic DROP (not TABLE or DATABASE) ----
  it('enriches generic DROP query with operation DROP', () => {
    const result = enrichArgsFromQuery({ query: 'DROP INDEX idx_name' })
    expect(result).toEqual({ query: 'DROP INDEX idx_name', operation: 'DROP' })
  })

  // ---- TRUNCATE ----
  it('enriches TRUNCATE query with operation TRUNCATE', () => {
    const result = enrichArgsFromQuery({ query: 'TRUNCATE TABLE users' })
    expect(result).toEqual({ query: 'TRUNCATE TABLE users', operation: 'TRUNCATE' })
  })

  // ---- ALTER ----
  it('enriches ALTER query with operation ALTER', () => {
    const result = enrichArgsFromQuery({ query: 'ALTER TABLE users ADD COLUMN email TEXT' })
    expect(result).toEqual({ query: 'ALTER TABLE users ADD COLUMN email TEXT', operation: 'ALTER' })
  })

  // ---- CREATE ----
  it('enriches CREATE query with operation CREATE', () => {
    const result = enrichArgsFromQuery({ query: 'CREATE TABLE users (id INT)' })
    expect(result).toEqual({ query: 'CREATE TABLE users (id INT)', operation: 'CREATE' })
  })

  // ---- GRANT ----
  it('enriches GRANT query with operation GRANT', () => {
    const result = enrichArgsFromQuery({ query: 'GRANT ALL ON users TO public' })
    expect(result).toEqual({ query: 'GRANT ALL ON users TO public', operation: 'GRANT' })
  })

  // ---- INSERT ----
  it('enriches INSERT query with operation INSERT', () => {
    const result = enrichArgsFromQuery({ query: 'INSERT INTO users VALUES (1, "test")' })
    expect(result).toEqual({ query: 'INSERT INTO users VALUES (1, "test")', operation: 'INSERT' })
  })

  // ---- UPDATE ----
  it('enriches UPDATE query with operation UPDATE', () => {
    const result = enrichArgsFromQuery({ query: 'UPDATE users SET name = "test"' })
    expect(result).toEqual({ query: 'UPDATE users SET name = "test"', operation: 'UPDATE' })
  })

  // ---- DELETE ----
  it('enriches DELETE query with operation DELETE', () => {
    const result = enrichArgsFromQuery({ query: 'DELETE FROM users WHERE id = 1' })
    expect(result).toEqual({ query: 'DELETE FROM users WHERE id = 1', operation: 'DELETE' })
  })

  // ---- SELECT ----
  it('enriches SELECT query with operation SELECT', () => {
    const result = enrichArgsFromQuery({ query: 'SELECT * FROM users' })
    expect(result).toEqual({ query: 'SELECT * FROM users', operation: 'SELECT' })
  })

  // ---- No enrichment when operation already set ----
  it('does not enrich when operation is already set', () => {
    const args = { query: 'DROP TABLE users', operation: 'CUSTOM_OP' }
    const result = enrichArgsFromQuery(args)
    expect(result).toEqual({ query: 'DROP TABLE users', operation: 'CUSTOM_OP' })
  })

  it('does not enrich when operation is an empty string (falsy)', () => {
    const args = { query: 'DROP TABLE users', operation: '' }
    const result = enrichArgsFromQuery(args)
    // Empty string is falsy, so enrichment should happen
    expect(result).toEqual({ query: 'DROP TABLE users', operation: 'DROP_TABLE' })
  })

  // ---- No enrichment when no query ----
  it('returns args unchanged when no query field', () => {
    const args = { agentRole: 'DataAgent' }
    expect(enrichArgsFromQuery(args)).toEqual({ agentRole: 'DataAgent' })
  })

  // ---- No enrichment when query is not a string ----
  it('returns args unchanged when query is not a string', () => {
    const args = { query: 123 }
    expect(enrichArgsFromQuery(args)).toEqual({ query: 123 })
  })

  // ---- Case-insensitive matching ----
  it('matches SQL keywords case-insensitively', () => {
    const result = enrichArgsFromQuery({ query: 'drop table users' })
    expect(result).toEqual({ query: 'drop table users', operation: 'DROP_TABLE' })
  })

  // ---- Preserves other args ----
  it('preserves other args when enriching', () => {
    const args = { query: 'DROP TABLE users', agentRole: 'DataAgent', toolName: 'PostgreSQL' }
    const result = enrichArgsFromQuery(args)
    expect(result).toEqual({
      query: 'DROP TABLE users',
      agentRole: 'DataAgent',
      toolName: 'PostgreSQL',
      operation: 'DROP_TABLE',
    })
  })

  // ---- DROP TABLE vs DROP DATABASE priority ----
  it('distinguishes DROP TABLE from DROP DATABASE', () => {
    expect(enrichArgsFromQuery({ query: 'DROP TABLE users' })).toEqual(
      expect.objectContaining({ operation: 'DROP_TABLE' }),
    )
    expect(enrichArgsFromQuery({ query: 'DROP DATABASE prod' })).toEqual(
      expect.objectContaining({ operation: 'DROP_DATABASE' }),
    )
  })

  // ---- Unknown query pattern ----
  it('returns args unchanged for unrecognized query pattern', () => {
    const args = { query: 'EXPLAIN SELECT * FROM users' }
    expect(enrichArgsFromQuery(args)).toEqual({ query: 'EXPLAIN SELECT * FROM users' })
  })
})

// ---------------------------------------------------------------------------
// getMatchingActions
// ---------------------------------------------------------------------------
describe('getMatchingActions', () => {
  // ---- Read-type actions ----
  describe('read-type actions', () => {
    it('returns correct mappings for SELECT', () => {
      const result = getMatchingActions('SELECT')
      expect(result).toContain('SELECT')
      expect(result).toContain('READ')
      expect(result).toContain('GET')
      expect(result).toContain('LIST')
      expect(result).toContain('SEARCH')
    })

    it('returns correct mappings for READ', () => {
      const result = getMatchingActions('READ')
      expect(result).toContain('READ')
      expect(result).toContain('SELECT')
      expect(result).toContain('GET')
      expect(result).toContain('LIST')
      expect(result).toContain('SEARCH')
    })

    it('returns correct mappings for GET', () => {
      const result = getMatchingActions('GET')
      expect(result).toContain('GET')
      expect(result).toContain('READ')
      expect(result).toContain('SELECT')
      expect(result).not.toContain('LIST')
    })

    it('returns correct mappings for LIST', () => {
      const result = getMatchingActions('LIST')
      expect(result).toContain('LIST')
      expect(result).toContain('READ')
      expect(result).toContain('SELECT')
    })

    it('returns correct mappings for SEARCH', () => {
      const result = getMatchingActions('SEARCH')
      expect(result).toContain('SEARCH')
      expect(result).toContain('READ')
      expect(result).toContain('SELECT')
    })
  })

  // ---- Write-type actions ----
  describe('write-type actions', () => {
    it('returns correct mappings for INSERT', () => {
      const result = getMatchingActions('INSERT')
      expect(result).toContain('INSERT')
      expect(result).toContain('WRITE')
      expect(result).toContain('INSERT_UPDATE_DELETE')
    })

    it('returns correct mappings for UPDATE', () => {
      const result = getMatchingActions('UPDATE')
      expect(result).toContain('UPDATE')
      expect(result).toContain('WRITE')
      expect(result).toContain('INSERT_UPDATE_DELETE')
    })

    it('returns correct mappings for DELETE', () => {
      const result = getMatchingActions('DELETE')
      expect(result).toContain('DELETE')
      expect(result).toContain('WRITE')
      expect(result).toContain('INSERT_UPDATE_DELETE')
      expect(result).toContain('ADMIN')
    })

    it('returns correct mappings for WRITE', () => {
      const result = getMatchingActions('WRITE')
      expect(result).toContain('WRITE')
      expect(result).toContain('INSERT')
      expect(result).toContain('UPDATE')
      expect(result).toContain('DELETE')
      expect(result).toContain('INSERT_UPDATE_DELETE')
    })

    it('returns correct mappings for INSERT_UPDATE_DELETE', () => {
      const result = getMatchingActions('INSERT_UPDATE_DELETE')
      expect(result).toContain('INSERT_UPDATE_DELETE')
      expect(result).toContain('WRITE')
      expect(result).toContain('INSERT')
      expect(result).toContain('UPDATE')
      expect(result).toContain('DELETE')
    })
  })

  // ---- Admin-type actions ----
  describe('admin-type actions', () => {
    it('returns correct mappings for DROP', () => {
      const result = getMatchingActions('DROP')
      expect(result).toContain('DROP')
      expect(result).toContain('ADMIN')
      expect(result).toContain('WRITE')
    })

    it('returns correct mappings for ADMIN', () => {
      const result = getMatchingActions('ADMIN')
      expect(result).toContain('ADMIN')
      expect(result).toContain('DROP')
      expect(result).toContain('DELETE')
      expect(result).toContain('WRITE')
    })

    it('returns correct mappings for TRUNCATE', () => {
      const result = getMatchingActions('TRUNCATE')
      expect(result).toContain('TRUNCATE')
      expect(result).toContain('DROP')
      expect(result).toContain('ADMIN')
      expect(result).toContain('WRITE')
    })
  })

  // ---- VCS-type actions ----
  describe('VCS-type actions', () => {
    it('returns correct mappings for PUSH', () => {
      const result = getMatchingActions('PUSH')
      expect(result).toContain('PUSH')
      expect(result).toContain('WRITE')
    })

    it('returns correct mappings for MERGE', () => {
      const result = getMatchingActions('MERGE')
      expect(result).toContain('MERGE')
      expect(result).toContain('WRITE')
    })

    it('returns correct mappings for DELETE_BRANCH', () => {
      const result = getMatchingActions('DELETE_BRANCH')
      expect(result).toContain('DELETE_BRANCH')
      expect(result).toContain('WRITE')
      expect(result).toContain('ADMIN')
    })

    it('returns correct mappings for DELETE_REPO', () => {
      const result = getMatchingActions('DELETE_REPO')
      expect(result).toContain('DELETE_REPO')
      expect(result).toContain('ADMIN')
      expect(result).toContain('DELETE')
    })

    it('returns correct mappings for CHANGE_SETTINGS', () => {
      const result = getMatchingActions('CHANGE_SETTINGS')
      expect(result).toContain('CHANGE_SETTINGS')
      expect(result).toContain('ADMIN')
    })

    it('returns correct mappings for ADD_COLLABORATOR', () => {
      const result = getMatchingActions('ADD_COLLABORATOR')
      expect(result).toContain('ADD_COLLABORATOR')
      expect(result).toContain('ADMIN')
    })
  })

  // ---- Finance/communication actions ----
  describe('finance and communication actions', () => {
    it('returns correct mappings for REFUND', () => {
      const result = getMatchingActions('REFUND')
      expect(result).toContain('REFUND')
      expect(result).toContain('WRITE')
    })

    it('returns correct mappings for POST_MESSAGE', () => {
      const result = getMatchingActions('POST_MESSAGE')
      expect(result).toContain('POST_MESSAGE')
      expect(result).toContain('WRITE')
    })

    it('returns correct mappings for SEND', () => {
      const result = getMatchingActions('SEND')
      expect(result).toContain('SEND')
      expect(result).toContain('WRITE')
    })
  })

  // ---- Unknown action fallback ----
  describe('unknown action fallback', () => {
    it('returns only the action itself for unknown actions', () => {
      const result = getMatchingActions('CUSTOM_ACTION')
      expect(result).toEqual(['CUSTOM_ACTION'])
    })

    it('returns only the action itself for empty string', () => {
      const result = getMatchingActions('')
      expect(result).toEqual([''])
    })
  })

  // ---- Deduplication ----
  describe('deduplication', () => {
    it('does not duplicate the action when it is already in the map', () => {
      const result = getMatchingActions('SELECT')
      const selectCount = result.filter((a) => a === 'SELECT').length
      expect(selectCount).toBe(1)
    })

    it('deduplicates when map already contains the action', () => {
      // WRITE is both in the map and added via [action, ...matches]
      const result = getMatchingActions('WRITE')
      const writeCount = result.filter((a) => a === 'WRITE').length
      expect(writeCount).toBe(1)
    })

    it('deduplicates overlapping entries in map', () => {
      // ADMIN map includes DELETE which may overlap with action itself
      const result = getMatchingActions('ADMIN')
      const unique = new Set(result)
      expect(result.length).toBe(unique.size)
    })
  })

  // ---- Always includes the action itself ----
  describe('always includes original action', () => {
    it('includes the original action even if not in the map', () => {
      // For mapped actions, the action is included both via the map and the explicit addition
      const result = getMatchingActions('DROP')
      expect(result).toContain('DROP')
    })
  })
})
