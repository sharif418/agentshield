/**
 * AgentShield LangChain Integration
 *
 * A LangChain callback handler that automatically intercepts AI agent tool calls
 * and evaluates them through AgentShield's policy engine.
 *
 * @example Embedded Mode
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
 * @example Hosted Mode
 * ```typescript
 * import { AgentShieldCallbackHandler } from '@agentshield/langchain';
 *
 * const handler = new AgentShieldCallbackHandler({
 *   serverUrl: 'https://agentshield.example.com',
 *   mode: 'hosted',
 *   apiKey: 'sk-...',
 *   defaultAgentRole: 'CodeAgent',
 *   onBlock: 'return',
 *   onRequireApproval: 'allow',
 * });
 * ```
 *
 * @packageDocumentation
 */

// Main handler class
export { AgentShieldCallbackHandler } from './callback-handler.js';

// Error classes
export {
  AgentShieldBlockError,
  AgentShieldApprovalError,
} from './callback-handler.js';

// LangChain-specific types (includes AgentShieldConfig re-declaration)
export type {
  AgentShieldLangChainConfig,
  AgentShieldEvent,
  AgentShieldConfig,
} from './types.js';

// Re-export core types for convenience
export type {
  Decision,
  Policy,
  PolicyDefinition,
  EvaluateInput,
  EvaluateRequest,
  EvaluateResult,
  MatchedPolicy,
  ConditionRule,
  PermissionLevel,
  Trace,
} from '../../core/src/types.js';
