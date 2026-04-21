import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentShield, createAgentShield } from '../src/client.js';
import type { PolicyDefinition, EvaluateResult } from '../../core/src/types.js';

describe('AgentShield SDK', () => {
  const samplePolicies: PolicyDefinition[] = [
    {
      policyId: 'POL-001',
      name: 'Block DROP on PostgreSQL',
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
      agentRole: 'DataAgent',
      resource: 'PostgreSQL',
      action: 'SELECT',
      permissionLevel: 'ALLOW',
      priority: 10,
      enabled: true,
    },
    {
      policyId: 'POL-003',
      name: 'Wildcard block admin',
      agentRole: '*',
      resource: 'FileSystem',
      action: 'ADMIN',
      permissionLevel: 'BLOCK',
      priority: 30,
      enabled: true,
    },
  ];

  // ---------------------------------------------------------------------------
  // Embedded mode
  // ---------------------------------------------------------------------------
  describe('embedded mode', () => {
    it('creates an embedded client when no serverUrl is provided', () => {
      const shield = new AgentShield({ mode: 'embedded', policies: samplePolicies });
      expect(shield.getMode()).toBe('embedded');
    });

    it('auto-detects embedded mode when no serverUrl and no mode', () => {
      const shield = new AgentShield({ policies: samplePolicies });
      expect(shield.getMode()).toBe('embedded');
    });

    it('evaluates a BLOCK decision', async () => {
      const shield = new AgentShield({ mode: 'embedded', policies: samplePolicies });
      const result = await shield.evaluate({
        agentRole: 'DataAgent',
        toolName: 'PostgreSQL',
        arguments: { query: 'DROP TABLE users' },
      });
      expect(result.decision).toBe('BLOCK');
      expect(result.matchedPolicy?.policyId).toBe('POL-001');
      expect(result.action).toBe('DROP');
      expect(result.traceId).toBeTruthy();
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('evaluates an ALLOW decision', async () => {
      const shield = new AgentShield({ mode: 'embedded', policies: samplePolicies });
      const result = await shield.evaluate({
        agentRole: 'DataAgent',
        toolName: 'PostgreSQL',
        arguments: { query: 'SELECT * FROM users' },
      });
      expect(result.decision).toBe('ALLOW');
      expect(result.matchedPolicy?.policyId).toBe('POL-002');
    });

    it('defaults to BLOCK in zero-trust mode for unknown tools', async () => {
      const shield = new AgentShield({ mode: 'embedded', policies: samplePolicies, zeroTrust: true });
      const result = await shield.evaluate({
        agentRole: 'UnknownAgent',
        toolName: 'UnknownTool',
        action: 'UNKNOWN',
      });
      expect(result.decision).toBe('BLOCK');
    });

    it('defaults to ALLOW when zero-trust is disabled', async () => {
      const shield = new AgentShield({ mode: 'embedded', policies: samplePolicies, zeroTrust: false });
      const result = await shield.evaluate({
        agentRole: 'UnknownAgent',
        toolName: 'UnknownTool',
        action: 'UNKNOWN',
      });
      expect(result.decision).toBe('ALLOW');
    });

    it('matches wildcard agentRole policies', async () => {
      const shield = new AgentShield({ mode: 'embedded', policies: samplePolicies });
      const result = await shield.evaluate({
        agentRole: 'AnyAgent',
        toolName: 'FileSystem',
        action: 'DELETE',
      });
      expect(result.decision).toBe('BLOCK');
      expect(result.matchedPolicy?.policyId).toBe('POL-003');
    });
  });

  // ---------------------------------------------------------------------------
  // Policy management (embedded mode)
  // ---------------------------------------------------------------------------
  describe('policy management', () => {
    it('adds a policy', () => {
      const shield = new AgentShield({ mode: 'embedded', policies: [] });
      shield.addPolicy(samplePolicies[0]);
      expect(shield.listPolicies()).toHaveLength(1);
    });

    it('updates an existing policy by policyId', () => {
      const shield = new AgentShield({ mode: 'embedded', policies: [...samplePolicies] });
      const updated = { ...samplePolicies[0], name: 'Updated Policy' };
      shield.addPolicy(updated);
      expect(shield.listPolicies()).toHaveLength(3);
      expect(shield.listPolicies()[0].name).toBe('Updated Policy');
    });

    it('removes a policy', () => {
      const shield = new AgentShield({ mode: 'embedded', policies: [...samplePolicies] });
      expect(shield.removePolicy('POL-001')).toBe(true);
      expect(shield.listPolicies()).toHaveLength(2);
    });

    it('returns false when removing non-existent policy', () => {
      const shield = new AgentShield({ mode: 'embedded', policies: samplePolicies });
      expect(shield.removePolicy('NON-EXISTENT')).toBe(false);
    });

    it('sets all policies', () => {
      const shield = new AgentShield({ mode: 'embedded', policies: samplePolicies });
      shield.setPolicies([samplePolicies[0]]);
      expect(shield.listPolicies()).toHaveLength(1);
    });

    it('throws for policy operations in hosted mode', () => {
      const shield = new AgentShield({ serverUrl: 'http://localhost:3000' });
      expect(() => shield.addPolicy(samplePolicies[0])).toThrow('embedded mode');
      expect(() => shield.removePolicy('POL-001')).toThrow('embedded mode');
      expect(() => shield.listPolicies()).toThrow('embedded mode');
      expect(() => shield.setPolicies([])).toThrow('embedded mode');
    });
  });

  // ---------------------------------------------------------------------------
  // Hosted mode
  // ---------------------------------------------------------------------------
  describe('hosted mode', () => {
    it('auto-detects hosted mode when serverUrl is provided', () => {
      const shield = new AgentShield({ serverUrl: 'http://localhost:3000' });
      expect(shield.getMode()).toBe('hosted');
    });

    it('throws when mode is hosted but no serverUrl', () => {
      expect(() => new AgentShield({ mode: 'hosted' })).toThrow('serverUrl is required');
    });

    it('sends evaluation request to the server', async () => {
      const mockResponse: EvaluateResult = {
        decision: 'BLOCK',
        reason: 'Blocked by policy: Block DROP on PostgreSQL',
        matchedPolicy: {
          policyId: 'POL-001',
          name: 'Block DROP on PostgreSQL',
          permissionLevel: 'BLOCK',
          priority: 20,
          action: 'DROP',
        },
        action: 'DROP',
        latencyMs: 5.2,
        traceId: 'TRC-abc123',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const shield = new AgentShield({
        serverUrl: 'http://localhost:3000',
        apiKey: 'test-key',
        fetch: mockFetch as unknown as typeof fetch,
      });

      const result = await shield.evaluate({
        agentRole: 'DataAgent',
        toolName: 'PostgreSQL',
        arguments: { query: 'DROP TABLE users' },
      });

      expect(result.decision).toBe('BLOCK');
      expect(result.traceId).toBe('TRC-abc123');

      // Verify the fetch was called correctly
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:3000/api/evaluate');
      expect(options.method).toBe('POST');
      expect(options.headers['x-api-key']).toBe('test-key');
      expect(options.headers['Content-Type']).toBe('application/json');
    });

    it('throws on server error', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      const shield = new AgentShield({
        serverUrl: 'http://localhost:3000',
        fetch: mockFetch as unknown as typeof fetch,
      });

      await expect(
        shield.evaluate({
          agentRole: 'DataAgent',
          toolName: 'PostgreSQL',
          action: 'DROP',
        })
      ).rejects.toThrow('HTTP 500');
    });

    it('throws on connection failure', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

      const shield = new AgentShield({
        serverUrl: 'http://localhost:3000',
        fetch: mockFetch as unknown as typeof fetch,
      });

      await expect(
        shield.evaluate({
          agentRole: 'DataAgent',
          toolName: 'PostgreSQL',
          action: 'DROP',
        })
      ).rejects.toThrow('Failed to connect');
    });
  });

  // ---------------------------------------------------------------------------
  // Health check
  // ---------------------------------------------------------------------------
  describe('health check', () => {
    it('returns true for embedded mode', async () => {
      const shield = new AgentShield({ mode: 'embedded', policies: samplePolicies });
      expect(await shield.isHealthy()).toBe(true);
    });

    it('returns true when server is healthy', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      const shield = new AgentShield({
        serverUrl: 'http://localhost:3000',
        fetch: mockFetch as unknown as typeof fetch,
      });
      expect(await shield.isHealthy()).toBe(true);
    });

    it('returns false when server is unhealthy', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Connection refused'));
      const shield = new AgentShield({
        serverUrl: 'http://localhost:3000',
        fetch: mockFetch as unknown as typeof fetch,
      });
      expect(await shield.isHealthy()).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // createAgentShield factory
  // ---------------------------------------------------------------------------
  describe('createAgentShield', () => {
    it('creates a client via factory function', () => {
      const shield = createAgentShield({ mode: 'embedded', policies: samplePolicies });
      expect(shield).toBeInstanceOf(AgentShield);
      expect(shield.getMode()).toBe('embedded');
    });
  });
});
