/**
 * AgentShield LangChain Callback Handler
 *
 * Intercepts LangChain tool calls and evaluates them against AgentShield policies.
 * Blocks or allows tool execution based on policy decisions.
 *
 * This handler integrates with LangChain's callback system to automatically
 * govern all tool calls made by AI agents. When a tool call is intercepted,
 * it is evaluated against the configured policies, and the handler can
 * block, return a message, or allow the call based on the evaluation result.
 *
 * ## Quick Start
 *
 * ```typescript
 * import { AgentShieldCallbackHandler } from '@agentshield/langchain';
 * import { AgentExecutor } from 'langchain/agents';
 *
 * const handler = new AgentShieldCallbackHandler({
 *   mode: 'embedded',
 *   policies: [
 *     {
 *       policyId: 'POL-001',
 *       name: 'Block SQL DROP',
 *       agentRole: 'DataAgent',
 *       resource: 'PostgreSQL',
 *       action: 'DROP',
 *       permissionLevel: 'BLOCK',
 *       priority: 20,
 *       enabled: true,
 *     },
 *   ],
 *   defaultAgentRole: 'DataAgent',
 *   toolNameMap: { 'sql_db_query': 'PostgreSQL' },
 * });
 *
 * const executor = AgentExecutor.fromAgentAndTools({
 *   agent,
 *   tools,
 *   callbacks: [handler],
 * });
 * ```
 *
 * ## Usage with LangGraph
 *
 * ```typescript
 * const handler = new AgentShieldCallbackHandler({
 *   serverUrl: 'https://agentshield.example.com',
 *   apiKey: 'sk-...',
 *   defaultAgentRole: 'CodeAgent',
 * });
 *
 * const result = await graph.invoke(
 *   { messages: [...] },
 *   { callbacks: [handler] }
 * );
 * ```
 *
 * @packageDocumentation
 */

import { AgentShield } from 'agentshield';
import type { EvaluateResult } from '@agentshield/core';
import type { AgentShieldLangChainConfig, AgentShieldEvent } from './types.js';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

/**
 * Error thrown when a tool call is blocked by AgentShield.
 *
 * Contains the full evaluation result, tool name, and agent role
 * for programmatic error handling.
 */
export class AgentShieldBlockError extends Error {
  /** The evaluation result that caused the block */
  readonly result: EvaluateResult;
  /** The tool name that was blocked */
  readonly toolName: string;
  /** The agent role that was blocked */
  readonly agentRole: string;

  constructor(result: EvaluateResult, toolName: string, agentRole: string) {
    super(
      `AgentShield BLOCKED: Tool "${toolName}" called by "${agentRole}" was blocked. ` +
        `Reason: ${result.reason}`
    );
    this.name = 'AgentShieldBlockError';
    this.result = result;
    this.toolName = toolName;
    this.agentRole = agentRole;
  }
}

/**
 * Error thrown when a tool call requires approval by AgentShield.
 *
 * Contains the full evaluation result, tool name, and agent role
 * for programmatic error handling.
 */
export class AgentShieldApprovalError extends Error {
  /** The evaluation result that triggered the approval requirement */
  readonly result: EvaluateResult;
  /** The tool name that requires approval */
  readonly toolName: string;
  /** The agent role that requires approval */
  readonly agentRole: string;

  constructor(result: EvaluateResult, toolName: string, agentRole: string) {
    super(
      `AgentShield APPROVAL REQUIRED: Tool "${toolName}" called by "${agentRole}" requires human approval. ` +
        `Reason: ${result.reason}`
    );
    this.name = 'AgentShieldApprovalError';
    this.result = result;
    this.toolName = toolName;
    this.agentRole = agentRole;
  }
}

// ---------------------------------------------------------------------------
// Callback Handler
// ---------------------------------------------------------------------------

/**
 * A LangChain-compatible callback handler that intercepts tool calls
 * and evaluates them through AgentShield's policy engine.
 *
 * ### Features
 * - **Tool name mapping**: Map LangChain tool names to AgentShield resource names
 * - **Agent role mapping**: Map LangChain agent names to AgentShield roles
 * - **Custom block/approval messages**: Template-based messages with variable substitution
 * - **Flexible block behavior**: Throw errors or return messages
 * - **Evaluation callbacks**: Hook into every evaluation for logging/metrics
 * - **Pre-built client support**: Pass an existing AgentShield instance or let the handler create one
 *
 * ### Block Behavior
 * - `onBlock: 'throw'` (default) - Throws `AgentShieldBlockError`, halting tool execution
 * - `onBlock: 'return'` - Lets the tool execute but replaces the output with a block message
 *
 * ### Approval Behavior
 * - `onRequireApproval: 'throw'` (default) - Throws `AgentShieldApprovalError`
 * - `onRequireApproval: 'return'` - Replaces output with an approval message
 * - `onRequireApproval: 'allow'` - Allows the tool call through (async approval workflow)
 */
export class AgentShieldCallbackHandler {
  /** Handler name for LangChain callback identification */
  name = 'AgentShieldCallbackHandler';

  private shield: AgentShield;
  private config: Required<
    Pick<
      AgentShieldLangChainConfig,
      | 'onBlock'
      | 'onRequireApproval'
      | 'blockMessage'
      | 'approvalMessage'
      | 'defaultAgentRole'
    >
  > &
    Pick<
      AgentShieldLangChainConfig,
      | 'toolNameMap'
      | 'agentRoleMap'
      | 'onEvaluate'
      | 'mode'
      | 'serverUrl'
      | 'apiKey'
      | 'policies'
      | 'zeroTrust'
      | 'fetch'
    >;

  /**
   * When a tool is blocked with `onBlock: 'return'`, this stores the
   * message so `handleToolEnd` can replace the output.
   */
  private _pendingBlockMessage: string | null = null;

  /**
   * Track whether the current tool call was intercepted (for handleToolEnd).
   * Keyed by runId to handle concurrent tool calls correctly.
   */
  private _interceptedRuns: Map<string, string> = new Map();

  /**
   * Create a new AgentShieldCallbackHandler.
   *
   * @param config - Configuration for the handler. Can include AgentShield
   *   client config (mode, policies, serverUrl, etc.) plus LangChain-specific
   *   options (onBlock, onRequireApproval, toolNameMap, etc.)
   */
  constructor(config: AgentShieldLangChainConfig = {}) {
    this.config = {
      // LangChain-specific defaults
      onBlock: config.onBlock ?? 'throw',
      onRequireApproval: config.onRequireApproval ?? 'throw',
      blockMessage:
        config.blockMessage ??
        'Tool call blocked by AgentShield: {toolName} - {reason}',
      approvalMessage:
        config.approvalMessage ??
        'Tool call requires approval: {toolName} - {reason} (Request: {approvalRequestId})',
      defaultAgentRole: config.defaultAgentRole ?? 'DefaultAgent',
      // Passthrough config fields
      toolNameMap: config.toolNameMap,
      agentRoleMap: config.agentRoleMap,
      onEvaluate: config.onEvaluate,
      mode: config.mode,
      serverUrl: config.serverUrl,
      apiKey: config.apiKey,
      policies: config.policies,
      zeroTrust: config.zeroTrust,
      fetch: config.fetch,
    };

    // Create the AgentShield client from the config
    // Default to 'embedded' mode if not specified
    const mode = config.mode ?? (config.serverUrl ? 'hosted' : 'embedded');
    this.shield = new AgentShield({
      mode,
      serverUrl: config.serverUrl,
      apiKey: config.apiKey,
      policies: config.policies,
      zeroTrust: config.zeroTrust,
      fetch: config.fetch,
    });
  }

  // ---------------------------------------------------------------------------
  // LangChain Callback Interface
  // ---------------------------------------------------------------------------

  /**
   * LangChain callback: called before a tool executes.
   *
   * This is the main interception point where we evaluate the tool call
   * against AgentShield policies. Based on the evaluation result and the
   * configured behavior, the handler may:
   * - Throw an error (blocking the tool call)
   * - Set a pending message (replacing the tool output)
   * - Allow the tool call to proceed
   *
   * @param tool - The tool being called (object with `name` property, or string)
   * @param input - The input to the tool (string or object)
   * @param runId - Unique identifier for this tool run
   * @param parentRunId - Parent run identifier (for nested calls)
   * @param tags - Optional tags associated with the run
   * @param metadata - Optional metadata associated with the run
   * @param kwargs - Additional keyword arguments
   */
  async handleToolStart(
    tool: { name: string; description?: string } | string,
    input: string | Record<string, unknown>,
    runId?: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: Record<string, unknown>,
    kwargs?: Record<string, unknown>,
  ): Promise<void> {
    // Extract tool name
    const toolName =
      typeof tool === 'string' ? tool : tool.name ?? 'UnknownTool';

    // Normalize input to object
    const args = typeof input === 'string' ? { input } : input;

    // Map tool name to AgentShield resource name
    const shieldResource =
      this.config.toolNameMap?.[toolName] ?? toolName;

    // Resolve agent role
    const agentRole = this.resolveAgentRole(metadata, tags, kwargs);

    // Evaluate the tool call against policies
    const result = await this.shield.evaluate({
      agentRole,
      toolName: shieldResource,
      arguments: args as Record<string, unknown>,
    });

    // Build and emit evaluation event
    const event: AgentShieldEvent = {
      result,
      toolName,
      shieldResource,
      agentRole,
      args: args as Record<string, unknown>,
      timestamp: new Date(),
    };

    // Call onEvaluate callback if provided
    this.config.onEvaluate?.(event);

    // Handle BLOCK decision
    if (result.decision === 'BLOCK') {
      const message = this.formatBlockMessage(toolName, agentRole, result);

      if (this.config.onBlock === 'throw') {
        throw new AgentShieldBlockError(result, toolName, agentRole);
      }

      // onBlock: 'return' - store message for handleToolEnd
      if (runId) {
        this._interceptedRuns.set(runId, message);
      } else {
        this._pendingBlockMessage = message;
      }
      return;
    }

    // Handle REQUIRE_APPROVAL decision
    if (result.decision === 'REQUIRE_APPROVAL') {
      const message = this.formatApprovalMessage(
        toolName,
        agentRole,
        result,
      );

      if (this.config.onRequireApproval === 'throw') {
        throw new AgentShieldApprovalError(result, toolName, agentRole);
      }

      if (this.config.onRequireApproval === 'return') {
        if (runId) {
          this._interceptedRuns.set(runId, message);
        } else {
          this._pendingBlockMessage = message;
        }
        return;
      }

      // onRequireApproval: 'allow' - tool execution continues
    }
  }

  /**
   * LangChain callback: called after a tool executes.
   *
   * If the tool call was intercepted (blocked or approval-required with
   * 'return' behavior), the output is replaced with the appropriate message.
   *
   * @param output - The tool output
   * @param runId - Unique identifier for this tool run
   * @param parentRunId - Parent run identifier
   * @param tags - Optional tags associated with the run
   * @returns The original output, or a replacement message if intercepted
   */
  async handleToolEnd(
    output: string | Record<string, unknown>,
    runId?: string,
    parentRunId?: string,
    tags?: string[],
  ): Promise<string | Record<string, unknown>> {
    // Check for intercepted run by runId first, then fallback to pending message
    if (runId && this._interceptedRuns.has(runId)) {
      const message = this._interceptedRuns.get(runId)!;
      this._interceptedRuns.delete(runId);
      return message;
    }

    if (this._pendingBlockMessage) {
      const message = this._pendingBlockMessage;
      this._pendingBlockMessage = null;
      return message;
    }

    return output;
  }

  /**
   * LangChain callback: called when a tool throws an error.
   *
   * Cleans up any pending interception state for this run.
   *
   * @param error - The error that was thrown
   * @param runId - Unique identifier for this tool run
   * @param parentRunId - Parent run identifier
   * @param tags - Optional tags associated with the run
   */
  async handleToolError(
    error: Error | string,
    runId?: string,
    parentRunId?: string,
    tags?: string[],
  ): Promise<void> {
    // Clean up any pending state for this run
    if (runId) {
      this._interceptedRuns.delete(runId);
    }
    this._pendingBlockMessage = null;
  }

  // ---------------------------------------------------------------------------
  // Utility Methods
  // ---------------------------------------------------------------------------

  /**
   * Get the handler as a LangChain-compatible callback object.
   *
   * Use this when passing to LangChain's callbacks array if you need
   * a plain object instead of a class instance.
   *
   * @returns A callback object compatible with LangChain
   */
  toCallbacks(): Record<string, unknown> {
    return {
      handleToolStart: this.handleToolStart.bind(this),
      handleToolEnd: this.handleToolEnd.bind(this),
      handleToolError: this.handleToolError.bind(this),
    };
  }

  /**
   * Get the underlying AgentShield instance for direct access.
   *
   * Useful for adding/removing policies at runtime, checking health,
   * or performing evaluations outside of the callback flow.
   *
   * @returns The AgentShield client instance
   */
  getShield(): AgentShield {
    return this.shield;
  }

  // ---------------------------------------------------------------------------
  // Private Methods
  // ---------------------------------------------------------------------------

  /**
   * Resolve the agent role from metadata, tags, kwargs, or config.
   */
  private resolveAgentRole(
    metadata?: Record<string, unknown>,
    tags?: string[],
    kwargs?: Record<string, unknown>,
  ): string {
    // Check agentRoleMap against metadata/tags first
    if (this.config.agentRoleMap) {
      // Try to find agent name from metadata
      const agentName =
        (metadata?.agentName as string) ??
        (metadata?.agent_type as string) ??
        (kwargs?.agentName as string) ??
        null;

      if (agentName && this.config.agentRoleMap[agentName]) {
        return this.config.agentRoleMap[agentName];
      }

      // Try matching against tags
      if (tags) {
        for (const tag of tags) {
          if (this.config.agentRoleMap[tag]) {
            return this.config.agentRoleMap[tag];
          }
        }
      }
    }

    // Check for explicit agentRole in metadata
    if (metadata?.agentRole && typeof metadata.agentRole === 'string') {
      return metadata.agentRole;
    }

    // Fall back to default
    return this.config.defaultAgentRole;
  }

  /**
   * Format the block message with variable substitution.
   */
  private formatBlockMessage(
    toolName: string,
    agentRole: string,
    result: EvaluateResult,
  ): string {
    return this.config.blockMessage
      .replace(/\{toolName\}/g, toolName)
      .replace(/\{reason\}/g, result.reason ?? 'Policy violation')
      .replace(/\{agentRole\}/g, agentRole);
  }

  /**
   * Format the approval message with variable substitution.
   */
  private formatApprovalMessage(
    toolName: string,
    agentRole: string,
    result: EvaluateResult,
  ): string {
    return this.config.approvalMessage
      .replace(/\{toolName\}/g, toolName)
      .replace(/\{reason\}/g, result.reason ?? 'Approval required')
      .replace(/\{approvalRequestId\}/g, result.approvalRequestId ?? 'N/A')
      .replace(/\{agentRole\}/g, agentRole);
  }
}
