import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AgentShieldCallbackHandler,
  AgentShieldBlockError,
  AgentShieldApprovalError,
} from '../src/index.js';
import type { AgentShieldLangChainConfig, AgentShieldEvent } from '../src/index.js';
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

  const baseConfig: AgentShieldLangChainConfig = {
    mode: 'embedded',
    policies: samplePolicies,
    defaultAgentRole: 'DataAgent',
  };

  // ---------------------------------------------------------------------------
  // Construction
  // ---------------------------------------------------------------------------
  describe('construction', () => {
    it('creates a handler with default options', () => {
      const handler = new AgentShieldCallbackHandler(baseConfig);
      expect(handler).toBeInstanceOf(AgentShieldCallbackHandler);
    });

    it('creates a handler with custom options', () => {
      const handler = new AgentShieldCallbackHandler({
        ...baseConfig,
        onBlock: 'return',
        onRequireApproval: 'allow',
        defaultAgentRole: 'DataAgent',
        toolNameMap: { sql_db_query: 'PostgreSQL' },
      });
      expect(handler).toBeInstanceOf(AgentShieldCallbackHandler);
    });

    it('returns a callbacks object via toCallbacks()', () => {
      const handler = new AgentShieldCallbackHandler(baseConfig);
      const callbacks = handler.toCallbacks();
      expect(callbacks.handleToolStart).toBeTypeOf('function');
      expect(callbacks.handleToolEnd).toBeTypeOf('function');
      expect(callbacks.handleToolError).toBeTypeOf('function');
    });

    it('provides access to the underlying AgentShield client', () => {
      const handler = new AgentShieldCallbackHandler(baseConfig);
      const shield = handler.getShield();
      expect(shield).toBeDefined();
      expect(shield.mode).toBe('embedded');
    });

    it('has a name property for LangChain callback identification', () => {
      const handler = new AgentShieldCallbackHandler(baseConfig);
      expect(handler.name).toBe('AgentShieldCallbackHandler');
    });
  });

  // ---------------------------------------------------------------------------
  // handleToolStart - BLOCK
  // ---------------------------------------------------------------------------
  describe('handleToolStart - BLOCK', () => {
    it('throws AgentShieldBlockError by default when tool call is blocked', async () => {
      const handler = new AgentShieldCallbackHandler({
        ...baseConfig,
        onBlock: 'throw',
      });

      await expect(
        handler.handleToolStart(
          { name: 'PostgreSQL' },
          { query: 'DROP TABLE users' },
        ),
      ).rejects.toThrow(AgentShieldBlockError);
    });

    it('throws AgentShieldBlockError with correct properties', async () => {
      const handler = new AgentShieldCallbackHandler({
        ...baseConfig,
        onBlock: 'throw',
      });

      try {
        await handler.handleToolStart(
          { name: 'PostgreSQL' },
          { query: 'DROP TABLE users' },
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

    it('stores message for handleToolEnd when onBlock is "return"', async () => {
      const onEvaluate = vi.fn();
      const handler = new AgentShieldCallbackHandler({
        ...baseConfig,
        onBlock: 'return',
        onEvaluate,
      });

      // Should NOT throw
      await handler.handleToolStart(
        { name: 'PostgreSQL' },
        { query: 'DROP TABLE users' },
        'run-1',
      );

      // onEvaluate should have been called with a BLOCK result
      expect(onEvaluate).toHaveBeenCalledTimes(1);
      expect(onEvaluate.mock.calls[0][0].result.decision).toBe('BLOCK');
    });

    it('handleToolEnd returns block message when onBlock is "return"', async () => {
      const handler = new AgentShieldCallbackHandler({
        ...baseConfig,
        onBlock: 'return',
      });

      await handler.handleToolStart(
        { name: 'PostgreSQL' },
        { query: 'DROP TABLE users' },
        'run-1',
      );

      const result = await handler.handleToolEnd('original output', 'run-1');
      expect(result).toBe(
        'Tool call blocked by AgentShield: PostgreSQL - Blocked by policy: Block DROP on PostgreSQL',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // handleToolStart - REQUIRE_APPROVAL
  // ---------------------------------------------------------------------------
  describe('handleToolStart - REQUIRE_APPROVAL', () => {
    it('throws AgentShieldApprovalError when onRequireApproval is "throw"', async () => {
      const handler = new AgentShieldCallbackHandler({
        ...baseConfig,
        defaultAgentRole: 'CodeAgent',
        onRequireApproval: 'throw',
      });

      await expect(
        handler.handleToolStart(
          { name: 'GitHub' },
          { operation: 'PUSH' },
        ),
      ).rejects.toThrow(AgentShieldApprovalError);
    });

    it('AgentShieldApprovalError has correct properties', async () => {
      const handler = new AgentShieldCallbackHandler({
        ...baseConfig,
        defaultAgentRole: 'CodeAgent',
        onRequireApproval: 'throw',
      });

      try {
        await handler.handleToolStart(
          { name: 'GitHub' },
          { operation: 'PUSH' },
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

    it('stores message for handleToolEnd when onRequireApproval is "return"', async () => {
      const handler = new AgentShieldCallbackHandler({
        ...baseConfig,
        defaultAgentRole: 'CodeAgent',
        onRequireApproval: 'return',
      });

      await handler.handleToolStart(
        { name: 'GitHub' },
        { operation: 'PUSH' },
        'run-2',
      );

      const result = await handler.handleToolEnd('original output', 'run-2');
      expect(typeof result).toBe('string');
      expect(result as string).toContain('requires approval');
    });

    it('allows tool execution when onRequireApproval is "allow"', async () => {
      const onEvaluate = vi.fn();
      const handler = new AgentShieldCallbackHandler({
        ...baseConfig,
        defaultAgentRole: 'CodeAgent',
        onRequireApproval: 'allow',
        onEvaluate,
      });

      // Should NOT throw and should NOT store a message
      await handler.handleToolStart(
        { name: 'GitHub' },
        { operation: 'PUSH' },
        'run-3',
      );

      expect(onEvaluate).toHaveBeenCalledTimes(1);
      expect(onEvaluate.mock.calls[0][0].result.decision).toBe(
        'REQUIRE_APPROVAL',
      );

      // handleToolEnd should return original output (no interception)
      const result = await handler.handleToolEnd('original output', 'run-3');
      expect(result).toBe('original output');
    });
  });

  // ---------------------------------------------------------------------------
  // handleToolStart - ALLOW
  // ---------------------------------------------------------------------------
  describe('handleToolStart - ALLOW', () => {
    it('does not throw or intercept when tool call is allowed', async () => {
      const onEvaluate = vi.fn();
      const handler = new AgentShieldCallbackHandler({
        ...baseConfig,
        onEvaluate,
      });

      await handler.handleToolStart(
        { name: 'PostgreSQL' },
        { query: 'SELECT * FROM users' },
      );

      // onEvaluate should be called with ALLOW
      expect(onEvaluate).toHaveBeenCalledTimes(1);
      expect(onEvaluate.mock.calls[0][0].result.decision).toBe('ALLOW');
    });

    it('handleToolEnd returns original output for allowed calls', async () => {
      const handler = new AgentShieldCallbackHandler(baseConfig);

      await handler.handleToolStart(
        { name: 'PostgreSQL' },
        { query: 'SELECT * FROM users' },
        'run-4',
      );

      const result = await handler.handleToolEnd('query result', 'run-4');
      expect(result).toBe('query result');
    });
  });

  // ---------------------------------------------------------------------------
  // Tool name mapping
  // ---------------------------------------------------------------------------
  describe('toolNameMap', () => {
    it('maps LangChain tool names to AgentShield resource names', async () => {
      const handler = new AgentShieldCallbackHandler({
        ...baseConfig,
        toolNameMap: { sql_db_query: 'PostgreSQL' },
        onBlock: 'throw',
      });

      // sql_db_query maps to PostgreSQL which has a BLOCK policy for DROP
      await expect(
        handler.handleToolStart(
          { name: 'sql_db_query' },
          { query: 'DROP TABLE users' },
        ),
      ).rejects.toThrow(AgentShieldBlockError);
    });

    it('uses original tool name when not in toolNameMap', async () => {
      const onEvaluate = vi.fn();
      const handler = new AgentShieldCallbackHandler({
        ...baseConfig,
        toolNameMap: { other_tool: 'Something' },
        onEvaluate,
      });

      // 'PostgreSQL' is not in toolNameMap, but maps to itself
      await handler.handleToolStart(
        { name: 'PostgreSQL' },
        { query: 'SELECT * FROM users' },
      );

      expect(onEvaluate).toHaveBeenCalledTimes(1);
      expect(onEvaluate.mock.calls[0][0].shieldResource).toBe('PostgreSQL');
    });
  });

  // ---------------------------------------------------------------------------
  // Agent role mapping
  // ---------------------------------------------------------------------------
  describe('agentRoleMap', () => {
    it('maps metadata agent names to AgentShield roles', async () => {
      const handler = new AgentShieldCallbackHandler({
        ...baseConfig,
        agentRoleMap: { 'sql-agent': 'DataAgent' },
        onBlock: 'throw',
      });

      // 'sql-agent' maps to 'DataAgent' which has a BLOCK policy for PostgreSQL DROP
      await expect(
        handler.handleToolStart(
          { name: 'PostgreSQL' },
          { query: 'DROP TABLE users' },
          'run-5',
          undefined,
          undefined,
          { agentName: 'sql-agent' },
        ),
      ).rejects.toThrow(AgentShieldBlockError);
    });

    it('uses defaultAgentRole when no mapping matches', async () => {
      const onEvaluate = vi.fn();
      const handler = new AgentShieldCallbackHandler({
        ...baseConfig,
        defaultAgentRole: 'DataAgent',
        agentRoleMap: { 'other-agent': 'OtherRole' },
        onEvaluate,
      });

      await handler.handleToolStart(
        { name: 'PostgreSQL' },
        { query: 'SELECT * FROM users' },
      );

      expect(onEvaluate.mock.calls[0][0].agentRole).toBe('DataAgent');
    });

    it('respects explicit agentRole in metadata', async () => {
      const onEvaluate = vi.fn();
      const handler = new AgentShieldCallbackHandler({
        ...baseConfig,
        defaultAgentRole: 'UnknownAgent',
        onEvaluate,
      });

      await handler.handleToolStart(
        { name: 'PostgreSQL' },
        { query: 'SELECT * FROM users' },
        'run-6',
        undefined,
        undefined,
        { agentRole: 'DataAgent' },
      );

      expect(onEvaluate.mock.calls[0][0].agentRole).toBe('DataAgent');
    });
  });

  // ---------------------------------------------------------------------------
  // Custom messages
  // ---------------------------------------------------------------------------
  describe('custom messages', () => {
    it('uses custom blockMessage template', async () => {
      const handler = new AgentShieldCallbackHandler({
        ...baseConfig,
        onBlock: 'return',
        blockMessage: 'BLOCKED: {toolName} by {agentRole} because {reason}',
      });

      await handler.handleToolStart(
        { name: 'PostgreSQL' },
        { query: 'DROP TABLE users' },
        'run-7',
      );

      const result = await handler.handleToolEnd('output', 'run-7');
      expect(result).toBe(
        'BLOCKED: PostgreSQL by DataAgent because Blocked by policy: Block DROP on PostgreSQL',
      );
    });

    it('uses custom approvalMessage template', async () => {
      const handler = new AgentShieldCallbackHandler({
        ...baseConfig,
        defaultAgentRole: 'CodeAgent',
        onRequireApproval: 'return',
        approvalMessage:
          'APPROVAL NEEDED: {toolName} - {reason} (ID: {approvalRequestId})',
      });

      await handler.handleToolStart(
        { name: 'GitHub' },
        { operation: 'PUSH' },
        'run-8',
      );

      const result = await handler.handleToolEnd('output', 'run-8');
      expect((result as string).startsWith('APPROVAL NEEDED: GitHub')).toBe(
        true,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // onEvaluate callback
  // ---------------------------------------------------------------------------
  describe('onEvaluate callback', () => {
    it('is called for every evaluation', async () => {
      const onEvaluate = vi.fn();
      const handler = new AgentShieldCallbackHandler({
        ...baseConfig,
        onEvaluate,
      });

      await handler.handleToolStart(
        { name: 'PostgreSQL' },
        { query: 'SELECT * FROM users' },
      );

      expect(onEvaluate).toHaveBeenCalledTimes(1);
      const event = onEvaluate.mock.calls[0][0] as AgentShieldEvent;
      expect(event.toolName).toBe('PostgreSQL');
      expect(event.agentRole).toBe('DataAgent');
      expect(event.result.decision).toBe('ALLOW');
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('receives mapped resource name in shieldResource', async () => {
      const onEvaluate = vi.fn();
      const handler = new AgentShieldCallbackHandler({
        ...baseConfig,
        toolNameMap: { sql_db_query: 'PostgreSQL' },
        onEvaluate,
      });

      await handler.handleToolStart(
        { name: 'sql_db_query' },
        { query: 'SELECT * FROM users' },
      );

      const event = onEvaluate.mock.calls[0][0] as AgentShieldEvent;
      expect(event.toolName).toBe('sql_db_query');
      expect(event.shieldResource).toBe('PostgreSQL');
    });
  });

  // ---------------------------------------------------------------------------
  // handleToolStart with string tool name
  // ---------------------------------------------------------------------------
  describe('string tool name', () => {
    it('handles string tool name', async () => {
      const handler = new AgentShieldCallbackHandler({
        ...baseConfig,
        onBlock: 'throw',
      });

      await expect(
        handler.handleToolStart('PostgreSQL', { query: 'DROP TABLE users' }),
      ).rejects.toThrow(AgentShieldBlockError);
    });
  });

  // ---------------------------------------------------------------------------
  // handleToolStart with string input
  // ---------------------------------------------------------------------------
  describe('string input', () => {
    it('handles string input by wrapping as { input }', async () => {
      const onEvaluate = vi.fn();
      const handler = new AgentShieldCallbackHandler({
        ...baseConfig,
        onBlock: 'return',
        onEvaluate,
      });

      // String input is wrapped as { input: "..." }.
      // No query field → action can't be inferred → zero-trust blocks
      await handler.handleToolStart({ name: 'PostgreSQL' }, 'DROP TABLE users');

      expect(onEvaluate).toHaveBeenCalledTimes(1);
      expect(onEvaluate.mock.calls[0][0].result.decision).toBe('BLOCK');
    });
  });

  // ---------------------------------------------------------------------------
  // handleToolError
  // ---------------------------------------------------------------------------
  describe('handleToolError', () => {
    it('cleans up pending state on tool error', async () => {
      const handler = new AgentShieldCallbackHandler({
        ...baseConfig,
        onBlock: 'return',
      });

      await handler.handleToolStart(
        { name: 'PostgreSQL' },
        { query: 'DROP TABLE users' },
        'run-9',
      );

      // Simulate tool error
      await handler.handleToolError(new Error('Tool failed'), 'run-9');

      // Subsequent handleToolEnd should not return a block message
      const result = await handler.handleToolEnd('output', 'run-9');
      expect(result).toBe('output');
    });
  });

  // ---------------------------------------------------------------------------
  // Concurrent tool calls (runId tracking)
  // ---------------------------------------------------------------------------
  describe('concurrent tool calls', () => {
    it('tracks interceptions by runId for concurrent calls', async () => {
      const handler = new AgentShieldCallbackHandler({
        ...baseConfig,
        onBlock: 'return',
      });

      // Start two concurrent tool calls
      await handler.handleToolStart(
        { name: 'PostgreSQL' },
        { query: 'DROP TABLE users' },
        'run-A',
      );
      await handler.handleToolStart(
        { name: 'PostgreSQL' },
        { query: 'SELECT * FROM users' },
        'run-B',
      );

      // run-A was blocked, run-B was allowed
      const resultA = await handler.handleToolEnd('output-A', 'run-A');
      const resultB = await handler.handleToolEnd('output-B', 'run-B');

      // run-A should get the block message, run-B should get original output
      expect(typeof resultA).toBe('string');
      expect(resultA as string).toContain('blocked');
      expect(resultB).toBe('output-B');
    });
  });

  // ---------------------------------------------------------------------------
  // Error classes
  // ---------------------------------------------------------------------------
  describe('error classes', () => {
    it('AgentShieldBlockError is an Error', () => {
      const error = new AgentShieldBlockError(
        {
          decision: 'BLOCK',
          reason: 'test',
          matchedPolicy: null,
          action: null,
          latencyMs: 0,
          traceId: 'test',
        },
        'TestTool',
        'TestAgent',
      );
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('AgentShieldBlockError');
    });

    it('AgentShieldApprovalError is an Error', () => {
      const error = new AgentShieldApprovalError(
        {
          decision: 'REQUIRE_APPROVAL',
          reason: 'test',
          matchedPolicy: null,
          action: null,
          latencyMs: 0,
          traceId: 'test',
        },
        'TestTool',
        'TestAgent',
      );
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('AgentShieldApprovalError');
    });
  });
});
