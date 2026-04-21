import { describe, it, expect } from 'vitest'
import {
  evaluateConditions,
  inferAction,
  getMatchingActions,
  enrichArgsFromQuery,
} from '../policy-engine'

// ---------------------------------------------------------------------------
// evaluateConditions
// ---------------------------------------------------------------------------
describe('evaluateConditions', () => {
  // --- simple equality ---
  describe('simple equality', () => {
    it('matches when field value equals condition value', () => {
      expect(evaluateConditions({ role: 'admin' }, { role: 'admin' })).toBe(true)
    })

    it('rejects when field value differs', () => {
      expect(evaluateConditions({ role: 'admin' }, { role: 'user' })).toBe(false)
    })

    it('rejects when field is missing from args', () => {
      expect(evaluateConditions({ role: 'admin' }, {} as Record<string, unknown>)).toBe(false)
    })

    it('handles numeric equality', () => {
      expect(evaluateConditions({ count: 5 }, { count: 5 })).toBe(true)
      expect(evaluateConditions({ count: 5 }, { count: 3 })).toBe(false)
    })

    it('handles boolean equality', () => {
      expect(evaluateConditions({ active: true }, { active: true })).toBe(true)
      expect(evaluateConditions({ active: true }, { active: false })).toBe(false)
    })
  })

  // --- $contains ---
  describe('$contains', () => {
    it('matches when string contains the substring', () => {
      expect(
        evaluateConditions({ query: { $contains: 'DROP' } }, { query: 'DROP TABLE users' }),
      ).toBe(true)
    })

    it('rejects when string does not contain the substring', () => {
      expect(
        evaluateConditions({ query: { $contains: 'DROP' } }, { query: 'SELECT * FROM users' }),
      ).toBe(false)
    })

    it('is case-sensitive', () => {
      expect(
        evaluateConditions({ query: { $contains: 'drop' } }, { query: 'DROP TABLE users' }),
      ).toBe(false)
    })
  })

  // --- $equals ---
  describe('$equals', () => {
    it('matches when field equals the value', () => {
      expect(evaluateConditions({ status: { $equals: 'active' } }, { status: 'active' })).toBe(true)
    })

    it('rejects when field does not equal the value', () => {
      expect(
        evaluateConditions({ status: { $equals: 'active' } }, { status: 'inactive' }),
      ).toBe(false)
    })

    it('works with numeric values', () => {
      expect(evaluateConditions({ level: { $equals: 3 } }, { level: 3 })).toBe(true)
      expect(evaluateConditions({ level: { $equals: 3 } }, { level: 5 })).toBe(false)
    })
  })

  // --- $in ---
  describe('$in', () => {
    it('matches when field value is in the list', () => {
      expect(
        evaluateConditions({ role: { $in: ['admin', 'moderator'] } }, { role: 'admin' }),
      ).toBe(true)
    })

    it('rejects when field value is not in the list', () => {
      expect(
        evaluateConditions({ role: { $in: ['admin', 'moderator'] } }, { role: 'user' }),
      ).toBe(false)
    })
  })

  // --- $gt ---
  describe('$gt', () => {
    it('matches when numeric field is greater than threshold', () => {
      expect(evaluateConditions({ amount: { $gt: 100 } }, { amount: 150 })).toBe(true)
    })

    it('rejects when numeric field equals threshold (strict greater)', () => {
      expect(evaluateConditions({ amount: { $gt: 100 } }, { amount: 100 })).toBe(false)
    })

    it('rejects when numeric field is less than threshold', () => {
      expect(evaluateConditions({ amount: { $gt: 100 } }, { amount: 50 })).toBe(false)
    })
  })

  // --- $lt ---
  describe('$lt', () => {
    it('matches when numeric field is less than threshold', () => {
      expect(evaluateConditions({ amount: { $lt: 100 } }, { amount: 50 })).toBe(true)
    })

    it('rejects when numeric field equals threshold (strict less)', () => {
      expect(evaluateConditions({ amount: { $lt: 100 } }, { amount: 100 })).toBe(false)
    })

    it('rejects when numeric field is greater than threshold', () => {
      expect(evaluateConditions({ amount: { $lt: 100 } }, { amount: 150 })).toBe(false)
    })
  })

  // --- $and ---
  describe('$and', () => {
    it('matches when ALL conditions are true', () => {
      const rules = {
        $and: [{ role: 'admin' }, { active: true }],
      }
      expect(evaluateConditions(rules, { role: 'admin', active: true })).toBe(true)
    })

    it('rejects when ANY condition is false', () => {
      const rules = {
        $and: [{ role: 'admin' }, { active: true }],
      }
      expect(evaluateConditions(rules, { role: 'admin', active: false })).toBe(false)
    })

    it('works with nested operators', () => {
      const rules = {
        $and: [{ amount: { $gt: 50 } }, { amount: { $lt: 200 } }],
      }
      expect(evaluateConditions(rules, { amount: 100 })).toBe(true)
      expect(evaluateConditions(rules, { amount: 30 })).toBe(false)
      expect(evaluateConditions(rules, { amount: 250 })).toBe(false)
    })
  })

  // --- $or ---
  describe('$or', () => {
    it('matches when ANY condition is true', () => {
      const rules = {
        $or: [{ role: 'admin' }, { role: 'moderator' }],
      }
      expect(evaluateConditions(rules, { role: 'admin' })).toBe(true)
      expect(evaluateConditions(rules, { role: 'moderator' })).toBe(true)
    })

    it('rejects when ALL conditions are false', () => {
      const rules = {
        $or: [{ role: 'admin' }, { role: 'moderator' }],
      }
      expect(evaluateConditions(rules, { role: 'user' })).toBe(false)
    })

    it('works with nested operators', () => {
      const rules = {
        $or: [{ amount: { $gt: 1000 } }, { query: { $contains: 'DROP' } }],
      }
      expect(evaluateConditions(rules, { amount: 50, query: 'DROP TABLE x' })).toBe(true)
      expect(evaluateConditions(rules, { amount: 5000, query: 'SELECT *' })).toBe(true)
      expect(evaluateConditions(rules, { amount: 50, query: 'SELECT *' })).toBe(false)
    })
  })

  // --- nested conditions ---
  describe('nested conditions', () => {
    it('supports $and inside $or', () => {
      const rules = {
        $or: [
          { $and: [{ role: 'admin' }, { active: true }] },
          { role: 'superadmin' },
        ],
      }
      expect(evaluateConditions(rules, { role: 'admin', active: true })).toBe(true)
      expect(evaluateConditions(rules, { role: 'superadmin', active: false })).toBe(true)
      expect(evaluateConditions(rules, { role: 'admin', active: false })).toBe(false)
    })

    it('supports $or inside $and', () => {
      const rules = {
        $and: [
          { $or: [{ role: 'admin' }, { role: 'moderator' }] },
          { active: true },
        ],
      }
      expect(evaluateConditions(rules, { role: 'admin', active: true })).toBe(true)
      expect(evaluateConditions(rules, { role: 'moderator', active: true })).toBe(true)
      expect(evaluateConditions(rules, { role: 'admin', active: false })).toBe(false)
      expect(evaluateConditions(rules, { role: 'user', active: true })).toBe(false)
    })
  })

  // --- empty rules ---
  describe('empty rules', () => {
    it('returns true for empty rules object (vacuously true)', () => {
      expect(evaluateConditions({}, { anything: 'here' })).toBe(true)
    })

    it('returns true for empty rules with no args', () => {
      expect(evaluateConditions({}, {} as Record<string, unknown>)).toBe(true)
    })
  })

  // --- multiple field conditions ---
  describe('multiple field conditions (implicit AND)', () => {
    it('all fields must match', () => {
      const rules = { role: 'admin', active: true }
      expect(evaluateConditions(rules, { role: 'admin', active: true })).toBe(true)
      expect(evaluateConditions(rules, { role: 'admin', active: false })).toBe(false)
      expect(evaluateConditions(rules, { role: 'user', active: true })).toBe(false)
    })
  })
})

// ---------------------------------------------------------------------------
// inferAction
// ---------------------------------------------------------------------------
describe('inferAction', () => {
  // --- from explicit operation fields ---
  describe('from operation/action/method fields', () => {
    it('returns operation field uppercased', () => {
      expect(inferAction({ operation: 'drop' }, 'PostgreSQL')).toBe('DROP')
    })

    it('returns action field uppercased when no operation', () => {
      expect(inferAction({ action: 'write' }, 'PostgreSQL')).toBe('WRITE')
    })

    it('returns method field uppercased when no operation or action', () => {
      expect(inferAction({ method: 'post' }, 'PostgreSQL')).toBe('POST')
    })

    it('prioritizes operation over action', () => {
      expect(inferAction({ operation: 'delete', action: 'read' }, 'PostgreSQL')).toBe('DELETE')
    })

    it('prioritizes action over method', () => {
      expect(inferAction({ action: 'write', method: 'get' }, 'PostgreSQL')).toBe('WRITE')
    })
  })

  // --- from SQL query ---
  describe('from SQL query inference', () => {
    it('infers SELECT from query', () => {
      expect(inferAction({ query: 'SELECT * FROM users' }, 'PostgreSQL')).toBe('SELECT')
    })

    it('infers INSERT from query', () => {
      expect(inferAction({ query: 'INSERT INTO users VALUES (1)' }, 'PostgreSQL')).toBe('INSERT')
    })

    it('infers UPDATE from query', () => {
      expect(inferAction({ query: 'UPDATE users SET name = "a"' }, 'PostgreSQL')).toBe('UPDATE')
    })

    it('infers DELETE from query', () => {
      expect(inferAction({ query: 'DELETE FROM users' }, 'PostgreSQL')).toBe('DELETE')
    })

    it('infers DROP from query', () => {
      expect(inferAction({ query: 'DROP TABLE users' }, 'PostgreSQL')).toBe('DROP')
    })

    it('infers TRUNCATE from query', () => {
      expect(inferAction({ query: 'TRUNCATE TABLE users' }, 'PostgreSQL')).toBe('TRUNCATE')
    })

    it('infers ALTER as ADMIN', () => {
      expect(inferAction({ query: 'ALTER TABLE users ADD col' }, 'PostgreSQL')).toBe('ADMIN')
    })

    it('infers CREATE as ADMIN', () => {
      expect(inferAction({ query: 'CREATE TABLE new_table' }, 'PostgreSQL')).toBe('ADMIN')
    })

    it('infers GRANT as ADMIN', () => {
      expect(inferAction({ query: 'GRANT ALL ON users' }, 'PostgreSQL')).toBe('ADMIN')
    })

    it('handles query with leading whitespace', () => {
      expect(inferAction({ query: '  SELECT * FROM users' }, 'PostgreSQL')).toBe('SELECT')
    })
  })

  // --- from HTTP method ---
  describe('from httpMethod', () => {
    it('infers action from httpMethod field', () => {
      expect(inferAction({ httpMethod: 'POST' }, 'RESTAPI')).toBe('POST')
      expect(inferAction({ httpMethod: 'delete' }, 'RESTAPI')).toBe('DELETE')
    })
  })

  // --- toolName heuristics ---
  describe('toolName heuristics', () => {
    it('infers SEND for EmailAPI with "to" field', () => {
      expect(inferAction({ to: 'user@example.com' }, 'EmailAPI')).toBe('SEND')
    })

    it('infers READ for EmailAPI without "to" field', () => {
      expect(inferAction({}, 'EmailAPI')).toBe('READ')
    })

    it('infers POST_MESSAGE for SlackAPI with channel and text', () => {
      expect(inferAction({ channel: '#general', text: 'hello' }, 'SlackAPI')).toBe('POST_MESSAGE')
    })

    it('infers READ for SlackAPI without channel or text', () => {
      expect(inferAction({}, 'SlackAPI')).toBe('READ')
    })

    it('infers READ for SlackAPI with only channel', () => {
      expect(inferAction({ channel: '#general' }, 'SlackAPI')).toBe('READ')
    })
  })

  // --- unknown / no inference ---
  describe('returns null for unknown', () => {
    it('returns null when no inference possible', () => {
      expect(inferAction({}, 'UnknownTool')).toBeNull()
    })

    it('returns null with unrelated args', () => {
      expect(inferAction({ foo: 'bar' }, 'UnknownTool')).toBeNull()
    })
  })
})

// ---------------------------------------------------------------------------
// getMatchingActions
// ---------------------------------------------------------------------------
describe('getMatchingActions', () => {
  describe('known actions return expanded lists', () => {
    it('SELECT expands to read-type actions', () => {
      const result = getMatchingActions('SELECT')
      expect(result).toContain('SELECT')
      expect(result).toContain('READ')
      expect(result).toContain('GET')
      expect(result).toContain('LIST')
      expect(result).toContain('SEARCH')
    })

    it('DROP expands to admin-type actions', () => {
      const result = getMatchingActions('DROP')
      expect(result).toContain('DROP')
      expect(result).toContain('ADMIN')
      expect(result).toContain('WRITE')
    })

    it('WRITE expands to write-type actions', () => {
      const result = getMatchingActions('WRITE')
      expect(result).toContain('WRITE')
      expect(result).toContain('INSERT')
      expect(result).toContain('UPDATE')
      expect(result).toContain('DELETE')
    })

    it('always includes the original action', () => {
      const actions = ['SELECT', 'INSERT', 'DELETE', 'DROP', 'REFUND', 'ADMIN']
      for (const action of actions) {
        expect(getMatchingActions(action)).toContain(action)
      }
    })

    it('deduplicates results', () => {
      const result = getMatchingActions('SELECT')
      const unique = [...new Set(result)]
      expect(result.length).toBe(unique.length)
    })
  })

  describe('unknown actions return [action]', () => {
    it('returns only the action itself for unknown actions', () => {
      const result = getMatchingActions('UNKNOWN_ACTION')
      expect(result).toEqual(['UNKNOWN_ACTION'])
    })

    it('returns only the action for custom tool actions', () => {
      const result = getMatchingActions('CUSTOM_OP')
      expect(result).toEqual(['CUSTOM_OP'])
    })
  })
})

// ---------------------------------------------------------------------------
// enrichArgsFromQuery
// ---------------------------------------------------------------------------
describe('enrichArgsFromQuery', () => {
  describe('enriches SQL queries with operation field', () => {
    it('enriches DROP TABLE query', () => {
      const result = enrichArgsFromQuery({ query: 'DROP TABLE users' })
      expect(result).toEqual({ query: 'DROP TABLE users', operation: 'DROP_TABLE' })
    })

    it('enriches DROP DATABASE query', () => {
      const result = enrichArgsFromQuery({ query: 'DROP DATABASE mydb' })
      expect(result).toEqual({ query: 'DROP DATABASE mydb', operation: 'DROP_DATABASE' })
    })

    it('enriches generic DROP query', () => {
      const result = enrichArgsFromQuery({ query: 'DROP INDEX idx' })
      expect(result).toEqual({ query: 'DROP INDEX idx', operation: 'DROP' })
    })

    it('enriches TRUNCATE query', () => {
      const result = enrichArgsFromQuery({ query: 'TRUNCATE TABLE users' })
      expect(result).toEqual({ query: 'TRUNCATE TABLE users', operation: 'TRUNCATE' })
    })

    it('enriches ALTER query', () => {
      const result = enrichArgsFromQuery({ query: 'ALTER TABLE users ADD col' })
      expect(result).toEqual({ query: 'ALTER TABLE users ADD col', operation: 'ALTER' })
    })

    it('enriches CREATE query', () => {
      const result = enrichArgsFromQuery({ query: 'CREATE TABLE new_tbl' })
      expect(result).toEqual({ query: 'CREATE TABLE new_tbl', operation: 'CREATE' })
    })

    it('enriches GRANT query', () => {
      const result = enrichArgsFromQuery({ query: 'GRANT ALL ON users' })
      expect(result).toEqual({ query: 'GRANT ALL ON users', operation: 'GRANT' })
    })

    it('enriches INSERT query', () => {
      const result = enrichArgsFromQuery({ query: 'INSERT INTO users VALUES (1)' })
      expect(result).toEqual({ query: 'INSERT INTO users VALUES (1)', operation: 'INSERT' })
    })

    it('enriches UPDATE query', () => {
      const result = enrichArgsFromQuery({ query: 'UPDATE users SET x = 1' })
      expect(result).toEqual({ query: 'UPDATE users SET x = 1', operation: 'UPDATE' })
    })

    it('enriches DELETE query', () => {
      const result = enrichArgsFromQuery({ query: 'DELETE FROM users' })
      expect(result).toEqual({ query: 'DELETE FROM users', operation: 'DELETE' })
    })

    it('enriches SELECT query', () => {
      const result = enrichArgsFromQuery({ query: 'SELECT * FROM users' })
      expect(result).toEqual({ query: 'SELECT * FROM users', operation: 'SELECT' })
    })

    it('handles lowercase queries by uppercasing for matching', () => {
      const result = enrichArgsFromQuery({ query: 'drop table users' })
      expect(result).toEqual({ query: 'drop table users', operation: 'DROP_TABLE' })
    })
  })

  describe('skips enrichment when operation already set', () => {
    it('returns args unchanged when operation field exists', () => {
      const args = { query: 'DROP TABLE users', operation: 'CUSTOM' }
      const result = enrichArgsFromQuery(args)
      expect(result).toEqual(args)
      expect(result.operation).toBe('CUSTOM')
    })
  })

  describe('skips enrichment when no query field', () => {
    it('returns args unchanged when no query field', () => {
      const args = { action: 'write' }
      const result = enrichArgsFromQuery(args)
      expect(result).toEqual(args)
    })
  })

  describe('skips enrichment when query is not a string', () => {
    it('returns args unchanged when query is not a string', () => {
      const args = { query: 123 }
      const result = enrichArgsFromQuery(args)
      expect(result).toEqual(args)
    })
  })

  describe('preserves other args fields', () => {
    it('keeps existing fields when enriching', () => {
      const result = enrichArgsFromQuery({ query: 'SELECT * FROM users', agentRole: 'DataAgent' })
      expect(result).toEqual({
        query: 'SELECT * FROM users',
        agentRole: 'DataAgent',
        operation: 'SELECT',
      })
    })
  })

  describe('returns unchanged args for unrecognized queries', () => {
    it('returns args as-is for query that does not match any SQL keyword', () => {
      const args = { query: 'EXPLAIN ANALYZE SELECT * FROM users' }
      const result = enrichArgsFromQuery(args)
      // EXPLAIN is not in the SQL map, so should return unchanged
      expect(result).toEqual(args)
    })
  })
})
