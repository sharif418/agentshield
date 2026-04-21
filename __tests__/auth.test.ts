import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { validateApiKey, isAuthEnabled, getApiKey } from '../src/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

describe('Auth Middleware', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalApiKey = process.env.AGENTSHEILD_API_KEY;

  beforeEach(() => {
    // Reset env before each test
    process.env.AGENTSHEILD_API_KEY = originalApiKey;
    process.env.NODE_ENV = originalEnv;
  });

  afterEach(() => {
    // Restore env after each test
    process.env.NODE_ENV = originalEnv;
    process.env.AGENTSHEILD_API_KEY = originalApiKey;
  });

  describe('isAuthEnabled()', () => {
    test('returns false in development', () => {
      process.env.NODE_ENV = 'development';
      expect(isAuthEnabled()).toBe(false);
    });

    test('returns true in production', () => {
      process.env.NODE_ENV = 'production';
      expect(isAuthEnabled()).toBe(true);
    });
  });

  describe('getApiKey()', () => {
    test('returns the env variable value', () => {
      process.env.AGENTSHEILD_API_KEY = 'test-secret-key-123';
      expect(getApiKey()).toBe('test-secret-key-123');
    });

    test('returns empty string when env variable is not set', () => {
      delete process.env.AGENTSHEILD_API_KEY;
      expect(getApiKey()).toBe('');
    });
  });

  describe('validateApiKey()', () => {
    test('returns null in development mode (NODE_ENV !== production)', () => {
      process.env.NODE_ENV = 'development';
      process.env.AGENTSHEILD_API_KEY = 'some-key';
      const request = new NextRequest('http://localhost:3000/api/test');
      const result = validateApiKey(request);
      expect(result).toBeNull();
    });

    test('returns 401 response when in production with no API key provided', () => {
      process.env.NODE_ENV = 'production';
      process.env.AGENTSHEILD_API_KEY = 'required-key';
      const request = new NextRequest('http://localhost:3000/api/test');
      const result = validateApiKey(request);
      expect(result).not.toBeNull();
      expect(result!.status).toBe(401);
    });

    test('returns 401 when wrong API key provided', () => {
      process.env.NODE_ENV = 'production';
      process.env.AGENTSHEILD_API_KEY = 'correct-key';
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-api-key': 'wrong-key' },
      });
      const result = validateApiKey(request);
      expect(result).not.toBeNull();
      expect(result!.status).toBe(401);
    });

    test('returns null (auth passed) when correct API key provided via header', async () => {
      process.env.NODE_ENV = 'production';
      process.env.AGENTSHEILD_API_KEY = 'correct-key';
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-api-key': 'correct-key' },
      });
      const result = validateApiKey(request);
      expect(result).toBeNull();
    });

    test('returns null when correct API key provided via query param', () => {
      process.env.NODE_ENV = 'production';
      process.env.AGENTSHEILD_API_KEY = 'correct-key';
      const request = new NextRequest('http://localhost:3000/api/test?api_key=correct-key');
      const result = validateApiKey(request);
      expect(result).toBeNull();
    });

    test('returns null in production when AGENTSHEILD_API_KEY is not set (unprotected)', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.AGENTSHEILD_API_KEY;
      const request = new NextRequest('http://localhost:3000/api/test');
      const result = validateApiKey(request);
      expect(result).toBeNull();
    });

    test('401 response body contains error message', async () => {
      process.env.NODE_ENV = 'production';
      process.env.AGENTSHEILD_API_KEY = 'required-key';
      const request = new NextRequest('http://localhost:3000/api/test');
      const result = validateApiKey(request);
      expect(result).not.toBeNull();
      const body = await result!.json();
      expect(body.error).toBeDefined();
      expect(typeof body.error).toBe('string');
    });
  });
});
