import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { validateApiKey, getApiKey, isAuthEnabled } from '../auth'

// ---------------------------------------------------------------------------
// Helper to create a mock NextRequest
// ---------------------------------------------------------------------------
function createMockRequest(options: {
  url?: string
  headers?: Record<string, string>
}): {
  headers: { get: (name: string) => string | null }
  url: string
} {
  return {
    headers: {
      get: (name: string) => options.headers?.[name] ?? null,
    },
    url: options.url ?? 'http://localhost:3000/api/test',
  }
}

// We need to mock NextResponse.json since it's used in validateApiKey.
// The auth module imports from 'next/server', so we mock that module.
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      type: 'NextResponse',
      body,
      status: init?.status ?? 200,
    }),
  },
  NextRequest: class NextRequest {},
}))

// ---------------------------------------------------------------------------
// getApiKey
// ---------------------------------------------------------------------------
describe('getApiKey', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns the AGENTSHEILD_API_KEY env var when set', () => {
    process.env.AGENTSHEILD_API_KEY = 'test-secret-key'
    expect(getApiKey()).toBe('test-secret-key')
  })

  it('returns empty string when AGENTSHEILD_API_KEY is not set', () => {
    delete process.env.AGENTSHEILD_API_KEY
    expect(getApiKey()).toBe('')
  })
})

// ---------------------------------------------------------------------------
// isAuthEnabled
// ---------------------------------------------------------------------------
describe('isAuthEnabled', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns true when NODE_ENV is production', () => {
    process.env.NODE_ENV = 'production'
    expect(isAuthEnabled()).toBe(true)
  })

  it('returns false when NODE_ENV is development', () => {
    process.env.NODE_ENV = 'development'
    expect(isAuthEnabled()).toBe(false)
  })

  it('returns false when NODE_ENV is test', () => {
    process.env.NODE_ENV = 'test'
    expect(isAuthEnabled()).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// validateApiKey
// ---------------------------------------------------------------------------
describe('validateApiKey', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('development mode (auth disabled)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development'
    })

    it('returns null (no auth required) regardless of headers', () => {
      const req = createMockRequest({})
      expect(validateApiKey(req as never)).toBeNull()
    })

    it('returns null even without any API key header', () => {
      const req = createMockRequest({ headers: {} })
      expect(validateApiKey(req as never)).toBeNull()
    })
  })

  describe('production mode (auth enabled)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production'
      process.env.AGENTSHEILD_API_KEY = 'valid-secret-key'
    })

    it('returns null when valid API key is provided via header', () => {
      const req = createMockRequest({
        headers: { 'x-api-key': 'valid-secret-key' },
      })
      expect(validateApiKey(req as never)).toBeNull()
    })

    it('returns null when valid API key is provided via query parameter', () => {
      const req = createMockRequest({
        url: 'http://localhost:3000/api/test?api_key=valid-secret-key',
      })
      expect(validateApiKey(req as never)).toBeNull()
    })

    it('returns 401 response when invalid API key is provided via header', () => {
      const req = createMockRequest({
        headers: { 'x-api-key': 'wrong-key' },
      })
      const result = validateApiKey(req as never)
      expect(result).not.toBeNull()
      expect(result).toEqual({
        type: 'NextResponse',
        body: {
          error:
            'Unauthorized. Provide a valid API key via x-api-key header or api_key query parameter.',
        },
        status: 401,
      })
    })

    it('returns 401 response when no API key is provided', () => {
      const req = createMockRequest({})
      const result = validateApiKey(req as never)
      expect(result).not.toBeNull()
      expect(result).toEqual(
        expect.objectContaining({
          status: 401,
        }),
      )
    })

    it('prioritizes header over query parameter (header checked first)', () => {
      // When header has a wrong key but query has correct key, the header is checked first
      // In the current implementation, the header is checked first with ??, so if header is present
      // (even if wrong), the query is not checked. Let's verify this behavior:
      const req = createMockRequest({
        headers: { 'x-api-key': 'wrong-key' },
        url: 'http://localhost:3000/api/test?api_key=valid-secret-key',
      })
      const result = validateApiKey(req as never)
      // Header has "wrong-key" which doesn't match, so it should return 401
      expect(result).not.toBeNull()
      expect(result).toEqual(expect.objectContaining({ status: 401 }))
    })

    it('returns null when API key matches via query parameter and no header', () => {
      const req = createMockRequest({
        url: 'http://localhost:3000/api/test?api_key=valid-secret-key',
      })
      expect(validateApiKey(req as never)).toBeNull()
    })
  })

  describe('production mode without AGENTSHEILD_API_KEY set', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production'
      delete process.env.AGENTSHEILD_API_KEY
    })

    it('returns null (unprotected) when no API key is configured', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const req = createMockRequest({})
      // When no API key is set, the function warns but returns null (unprotected)
      expect(validateApiKey(req as never)).toBeNull()
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[AUTH] AGENTSHEILD_API_KEY not set - API is unprotected!',
      )
      consoleWarnSpy.mockRestore()
    })
  })
})
