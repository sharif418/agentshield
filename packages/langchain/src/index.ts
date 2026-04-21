/**
 * AgentShield LangChain Integration
 *
 * A LangChain callback handler that automatically intercepts AI agent tool calls
 * and evaluates them through AgentShield's policy engine.
 *
 * @example
 * ```typescript
 * import { AgentShield } from 'agentshield'
 * import { AgentShieldCallbackHandler } from 'agentshield-langchain'
 * import { AgentExecutor } from 'langchain/agents'
 *
 * const shield = new AgentShield({ serverUrl: '...' })
 * const handler = new AgentShieldCallbackHandler(shield)
 *
 * const agent = new AgentExecutor({
 *   callbacks: [handler],  // All tool calls are now governed
 *   ...
 * })
 * ```
 *
 * @packageDocumentation
 */

import { AgentShield } from '../../sdk/src/client.js';
import type { EvaluateResult, PermissionLevel } from '../../core/src/types.js';

/**
 * Options for the AgentShieldCallbackHandler
 */
export interface AgentShieldCallbackHandlerOptions {
  /**
   * What to do when a tool call is blocked.
   * - 'error': Throw an error (default)
   * - 'skip': Skip the tool call and return a blocked message
   * - 'log': Log the block but allow the tool call to proceed (for monitoring)
   */
  onBlock?: 'error' | 'skip' | 'log';

  /**
   * What to do when a tool call requires approval.
   * - 'error': Throw an error
   * - 'skip': Skip the tool call and return a pending message (default)
   * - 'log': Log the approval requirement but allow the tool call
   */
  onApprovalRequired?: 'error' | 'skip' | 'log';

  /**
   * Custom logger function for blocked/approval-required events
   */
  logger?: (event: AgentShieldEvent) => void;

  /**
   * The agent role to use for evaluations (if not set, uses 'unknown')
   */
  agentRole?: string;

  /**
   * A function to extract the agent role from the run context.
   * If provided, this overrides `agentRole`.
   */
  extractAgentRole?: (serialized: Record<string, unknown>) => string;
}

/**
 * Event emitted when a tool call is evaluated
 */
export interface AgentShieldEvent {
  /** The evaluation result */
  result: EvaluateResult;
  /** The tool name that was evaluated */
  toolName: string;
  /** The agent role that triggered the evaluation */
  agentRole: string;
  /** Timestamp of the event */
  timestamp: Date;
}

/**
 * A LangChain-compatible callback handler that intercepts tool calls
 * and evaluates them through AgentShield.
 *
 * This handler integrates with LangChain's callback system to automatically
 * govern all tool calls made by AI agents. When a tool call is intercepted,
 * it is evaluated against the configured policies, and the handler can
 * block, skip, or log the call based on the evaluation result.
 *
 * ## Usage with LangChain
 *
 * ```typescript
 * import { AgentShield } from 'agentshield'
 * import { AgentShieldCallbackHandler } from 'agentshield-langchain'
 * import { AgentExecutor, createOpenAI_FUNCTIONSAgent } from 'langchain/agents'
 *
 * const shield = new AgentShield({
 *   serverUrl: 'https://agentshield.example.com',
 *   apiKey: 'sk-...'
 * })
 *
 * const handler = new AgentShieldCallbackHandler(shield, {
 *   onBlock: 'error',           // Throw error on blocked calls
 *   onApprovalRequired: 'skip', // Skip calls requiring approval
 * })
 *
 * const agent = createOpenAIFunctionsAgent(llm, tools, prompt)
 * const executor = new AgentExecutor({
 *   agent,
 *   tools,
 *   callbacks: [handler],
 * })
 * ```
 *
 * ## Usage with LangGraph
 *
 * ```typescript
 * import { AgentShieldCallbackHandler } from 'agentshield-langchain'
 *
 * const handler = new AgentShieldCallbackHandler(shield)
 *
 * const result = await graph.invoke(
 *   { messages: [...] },
 *   { callbacks: [handler] }
 * )
 * ```
 */
export class AgentShieldCallbackHandler {
  private shield: AgentShield;
  private options: Required<AgentShieldCallbackHandlerOptions>;

  /**
   * Create a new AgentShieldCallbackHandler.
   *
   * @param shield - The AgentShield client instance
   * @param options - Configuration options
   */
  constructor(shield: AgentShield, options: AgentShieldCallbackHandlerOptions = {}) {
    this.shield = shield;
    this.options = {
      onBlock: options.onBlock ?? 'error',
      onApprovalRequired: options.onApprovalRequired ?? 'skip',
      logger: options.logger ?? ((event: AgentShieldEvent) => {
        console.warn(
          `[AgentShield] Tool call ${event.result.decision}: ` +
            `${event.toolName} by ${event.agentRole} - ${event.result.reason}`
        );
      }),
      agentRole: options.agentRole ?? 'unknown',
      extractAgentRole: options.extractAgentRole ?? (() => options.agentRole ?? 'unknown'),
    };
  }

  // ---------------------------------------------------------------------------
  // LangChain Callback Interface
  // ---------------------------------------------------------------------------

  /**
   * Called when a tool starts executing.
   * This is the main interception point where we evaluate the tool call.
   *
   * LangChain callback handlers expect these specific method names.
   * The handler object is passed to AgentExecutor's callbacks array.
   */
  async handleToolStart(
    tool: { name: string } | Record<string, unknown>,
    input: string | Record<string, unknown>,
    runId?: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: Record<string, unknown>,
    kwargs?: Record<string, unknown>
  ): Promise<void> {
    const toolName = typeof tool === 'object' && 'name' in tool
      ? (tool as { name: string }).name
      : 'UnknownTool';

    const toolInput = typeof input === 'string' ? { input } : input;

    const agentRole = this.options.extractAgentRole(
      metadata ?? (kwargs?.metadata as Record<string, unknown>) ?? {}
    );

    const result = await this.shield.evaluate({
      agentRole,
      toolName,
      arguments: toolInput as Record<string, unknown>,
    });

    const event: AgentShieldEvent = {
      result,
      toolName,
      agentRole,
      timestamp: new Date(),
    };

    if (result.decision === 'BLOCK') {
      this.options.logger(event);

      if (this.options.onBlock === 'error') {
        throw new AgentShieldBlockError(result, toolName, agentRole);
      }
      // 'skip' and 'log' are handled downstream
    }

    if (result.decision === 'REQUIRE_APPROVAL') {
      this.options.logger(event);

      if (this.options.onApprovalRequired === 'error') {
        throw new AgentShieldApprovalError(result, toolName, agentRole);
      }
    }
  }

  /**
   * Handle tool end - not used for governance but can be overridden for logging.
   */
  handleToolEnd?(
    output: string | Record<string, unknown>,
    runId?: string,
    parentRunId?: string,
    tags?: string[]
  ): void {
    // No-op by default
  }

  /**
   * Handle tool error - not used for governance.
   */
  handleToolError?(
    error: Error,
    runId?: string,
    parentRunId?: string,
    tags?: string[]
  ): void {
    // No-op by default
  }

  // ---------------------------------------------------------------------------
  // LangGraph / LangChain generic callback interface
  // ---------------------------------------------------------------------------

  /**
   * Get the handler as a LangChain-compatible callback object.
   * Use this when passing to LangChain's callbacks array.
   *
   * @returns A callback object compatible with LangChain
   */
  toCallbacks(): Record<string, unknown> {
    return {
      handleToolStart: this.handleToolStart.bind(this),
      handleToolEnd: this.handleToolEnd?.bind(this),
      handleToolError: this.handleToolError?.bind(this),
    };
  }
}

/**
 * Error thrown when a tool call is blocked by AgentShield.
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
