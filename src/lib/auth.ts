import { NextRequest, NextResponse } from 'next/server'

/**
 * API key authentication middleware for AgentShield.
 * In development mode, all requests are allowed.
 * In production, requires AGENTSHIELD_API_KEY env var to be set and matched.
 */
const API_KEY_HEADER = 'x-api-key'
const API_KEY_QUERY = 'api_key'

export function getApiKey(): string {
  return process.env.AGENTSHIELD_API_KEY ?? ''
}

export function isAuthEnabled(): boolean {
  return process.env.NODE_ENV === 'production'
}

export function validateApiKey(request: NextRequest): NextResponse | null {
  // In development mode, skip auth
  if (!isAuthEnabled()) return null

  const apiKey = getApiKey()
  if (!apiKey) {
    console.warn('[AUTH] AGENTSHIELD_API_KEY not set - API is unprotected!')
    return null
  }

  const providedKey =
    request.headers.get(API_KEY_HEADER) ??
    new URL(request.url).searchParams.get(API_KEY_QUERY)

  if (!providedKey || providedKey !== apiKey) {
    return NextResponse.json(
      {
        error:
          'Unauthorized. Provide a valid API key via x-api-key header or api_key query parameter.',
      },
      { status: 401 }
    )
  }

  return null // Auth passed
}
