import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentShield } from '../../sdk/src/client.js';
import { AgentShieldCallbackHandler, AgentShieldBlockError, AgentShieldApprovalError } from '../src/index.js';
import type { AgentShieldEvent, AgentShieldCallbackHandlerOptions } from '../src/index.js';
import type { PolicyDefinition } from '../../core/src/types.js';

describe('AgentShieldCallbackHandler', () => {
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
      name: 'Approval for GitHub writes',
      agentRole: 'CodeAgent',
      resource: 'GitHub',
      action: 'WRITE',
      permissionLevel: 'REQUIRE_APPROVAL',
      priority: 10,
      enabled: true,
    },
  ];

  let shield: AgentShield;

  beforeEach(() => {
    shield = new AgentShield({ mode: 'embedded', policies: samplePolicies });
  });

  // ---------------------------------------------------------------------------
  // Construction
  // ---------------------------------------------------------------------------
  describe('construction', () => {
    it('creates a handler with default options', () => {
      const handler = new AgentShieldCallbackHandler(shield);
      expect(handler).toBeInstanceOf(AgentShieldCallbackHandler);
    });

    it('creates a handler with custom options', () => {
      const handler = new AgentShieldCallbackHandler(shield, {
        onBlock: 'skip',
        onApprovalRequired: 'log',
        agentRole: 'DataAgent',
      });
      expect(handler).toBeInstanceOf(AgentShieldCallbackHandler);
    });

    it('returns a callbacks object via toCallbacks()', () => {
      const handler = new AgentShieldCallbackHandler(shield);
      const callbacks = handler.toCallbacks();
      expect(callbacks.handleToolStart).toBeTypeOf('function');
    });
  });

  // ---------------------------------------------------------------------------
  // handleToolStart - BLOCK
  // ---------------------------------------------------------------------------
  describe('handleToolStart - BLOCK', () => {
    it('throws AgentShieldBlockError by default when tool call is blocked', async () => {
      const handler = new AgentShieldCallbackHandler(shield, {
        agentRole: 'DataAgent',
        onBlock: 'error',
      });

      await expect(
        handler.handleToolStart(
          { name: 'PostgreSQL' },
          { query: 'DROP TABLE users' }
        )
      ).rejects.toThrow(AgentShieldBlockError);
    });

    it('logs but does not throw when onBlock is "log"', async () => {
      const logger = vi.fn();
      const handler = new AgentShieldCallbackHandler(shield, {
        agentRole: 'DataAgent',
        onBlock: 'log',
        logger,
      });

      // Should NOT throw
      await handler.handleToolStart(
        { name: 'PostgreSQL' },
        { query: 'DROP TABLE users' }
      );

      expect(logger).toHaveBeenCalledTimes(1);
      expect(logger.mock.calls[0][0].result.decision).toBe('BLOCK');
    });

    it('skips (does not throw) when onBlock is "skip"', async () => {
      const logger = vi.fn();
      const handler = new AgentShieldCallbackHandler(shield, {
        agentRole: 'DataAgent',
        onBlock: 'skip',
        logger,
      });

      await handler.handleToolStart(
        { name: 'PostgreSQL' },
        { query: 'DROP TABLE users' }
      );

      expect(logger).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // handleToolStart - REQUIRE_APPROVAL
  // ---------------------------------------------------------------------------
  describe('handleToolStart - REQUIRE_APPROVAL', () => {
    it('throws AgentShieldApprovalError when onApprovalRequired is "error"', async () => {
      const handler = new AgentShieldCallbackHandler(shield, {
        agentRole: 'CodeAgent',
        onApprovalRequired: 'error',
      });

      await expect(
        handler.handleToolStart(
          { name: 'GitHub' },
          { operation: 'PUSH' }
        )
      ).rejects.toThrow(AgentShieldApprovalError);
    });

    it('logs when onApprovalRequired is "log"', async () => {
      const logger = vi.fn();
      const handler = new AgentShieldCallbackHandler(shield, {
        agentRole: 'CodeAgent',
        onApprovalRequired: 'log',
        logger,
      });

      await handler.handleToolStart(
        { name: 'GitHub' },
        { operation: 'PUSH' }
      );

      expect(logger).toHaveBeenCalledTimes(1);
      expect(logger.mock.calls[0][0].result.decision).toBe('REQUIRE_APPROVAL');
    });

    it('skips by default when onApprovalRequired is not set', async () => {
      const logger = vi.fn();
      const handler = new AgentShieldCallbackHandler(shield, {
        agentRole: 'CodeAgent',
        logger,
      });

      // Default for onApprovalRequired is 'skip', so it should NOT throw
      await handler.handleToolStart(
        { name: 'GitHub' },
        { operation: 'PUSH' }
      );

      expect(logger).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // handleToolStart - ALLOW
  // ---------------------------------------------------------------------------
  describe('handleToolStart - ALLOW', () => {
    it('does not throw or log when tool call is allowed', async () => {
      const logger = vi.fn();
      const handler = new AgentShieldCallbackHandler(shield, {
        agentRole: 'DataAgent',
        logger,
      });

      await handler.handleToolStart(
        { name: 'PostgreSQL' },
        { query: 'SELECT * FROM users' }
      );

      // Logger should NOT be called for ALLOW decisions
      expect(logger).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Error classes
  // ---------------------------------------------------------------------------
  describe('error classes', () => {
    it('AgentShieldBlockError has correct properties', async () => {
      const handler = new AgentShieldCallbackHandler(shield, {
        agentRole: 'DataAgent',
        onBlock: 'error',
      });

      try {
        await handler.handleToolStart(
          { name: 'PostgreSQL' },
          { query: 'DROP TABLE users' }
        );
      } catch (error) {
        expect(error).toBeInstanceOf(AgentShieldBlockError);
        const blockError = error as AgentShieldBlockError;
        expect(blockError.toolName).toBe('PostgreSQL');
        expect(blockError.agentRole).toBe('DataAgent');
        expect(blockError.result.decision).toBe('BLOCK');
        expect(blockError.message).toContain('BLOCKED');
        return;
      }
      expect.unreachable('Expected AgentShieldBlockError to be thrown');
    });

    it('AgentShieldApprovalError has correct properties', async () => {
      const handler = new AgentShieldCallbackHandler(shield, {
        agentRole: 'CodeAgent',
        onApprovalRequired: 'error',
      });

      try {
        await handler.handleToolStart(
          { name: 'GitHub' },
          { operation: 'PUSH' }
        );
      } catch (error) {
        expect(error).toBeInstanceOf(AgentShieldApprovalError);
        const approvalError = error as AgentShieldApprovalError;
        expect(approvalError.toolName).toBe('GitHub');
        expect(approvalError.agentRole).toBe('CodeAgent');
        expect(approvalError.result.decision).toBe('REQUIRE_APPROVAL');
        expect(approvalError.message).toContain('APPROVAL REQUIRED');
        return;
      }
      expect.unreachable('Expected AgentShieldApprovalError to be thrown');
    });
  });

  // ---------------------------------------------------------------------------
  // Tool name extraction
  // ---------------------------------------------------------------------------
  describe('tool name extraction', () => {
    it('extracts tool name from tool object', async () => {
      const handler = new AgentShieldCallbackHandler(shield, {
        agentRole: 'DataAgent',
        onBlock: 'log',
        logger: vi.fn(),
      });

      await handler.handleToolStart(
        { name: 'PostgreSQL' },
        { query: 'DROP TABLE users' }
      );

      // If we get here without error, tool name was extracted correctly
    });

    it('handles string input without error when onBlock is not error', async () => {
      const logger = vi.fn();
      const handler = new AgentShieldCallbackHandler(shield, {
        agentRole: 'DataAgent',
        onBlock: 'log',
        logger,
      });

      // String input is wrapped as { input: "..." }, no query field,
      // so action can't be inferred → zero-trust blocks → logged, not thrown
      await handler.handleToolStart(
        { name: 'PostgreSQL' },
        'SELECT * FROM users'
      );

      expect(logger).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // extractAgentRole function
  // ---------------------------------------------------------------------------
  describe('extractAgentRole', () => {
    it('uses custom extractAgentRole function', async () => {
      const handler = new AgentShieldCallbackHandler(shield, {
        extractAgentRole: (metadata) => 'DataAgent',
        onBlock: 'error',
      });

      await expect(
        handler.handleToolStart(
          { name: 'PostgreSQL' },
          { query: 'DROP TABLE users' }
        )
      ).rejects.toThrow(AgentShieldBlockError);
    });
  });
});
