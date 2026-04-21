/**
 * AgentShield SDK
 *
 * Deterministic runtime policy governance for AI agents.
 *
 * @packageDocumentation
 *
 * @example Hosted Mode
 * ```typescript
 * import { AgentShield } from 'agentshield'
 *
 * const shield = new AgentShield({
 *   mode: 'hosted',
 *   serverUrl: 'https://agentshield.example.com',
 *   apiKey: 'sk-...'
 * })
 *
 * const result = await shield.evaluate({
 *   agentRole: 'DataAgent',
 *   toolName: 'PostgreSQL',
 *   action: 'DROP',
 *   arguments: { query: 'DROP TABLE users' }
 * })
 *
 * console.log(result.decision) // 'BLOCK'
 * ```
 *
 * @example Embedded Mode
 * ```typescript
 * import { AgentShield } from 'agentshield'
 *
 * const shield = new AgentShield({
 *   mode: 'embedded',
 *   policies: [
 *     {
 *       policyId: 'POL-001',
 *       name: 'Block DROP on PostgreSQL',
 *       agentRole: 'DataAgent',
 *       resource: 'PostgreSQL',
 *       action: 'DROP',
 *       permissionLevel: 'BLOCK',
 *       priority: 20,
 *       enabled: true,
 *     },
 *   ],
 * })
 *
 * const result = await shield.evaluate({
 *   agentRole: 'DataAgent',
 *   toolName: 'PostgreSQL',
 *   arguments: { query: 'DROP TABLE users' }
 * })
 *
 * console.log(result.decision) // 'BLOCK'
 * ```
 */

// Main SDK class and factory function
export { AgentShield, createAgentShield } from './agentshield.js';

// Sub-modules for advanced usage
export { HostedClient } from './hosted-client.js';
export { EmbeddedEngine } from './embedded-engine.js';

// SDK-specific types
export type {
  AgentShieldConfig,
  PolicyCreateParams,
  PolicyListParams,
  TraceListParams,
  Trace,
} from './types.js';

// Re-export core types under both aliased and original names
export type {
  Decision,
  Policy,
  EvaluateRequest,
  EvaluateResult,
  MatchedPolicy,
  ConditionRule,
  PermissionLevel,
  PolicyDefinition,
  EvaluateInput,
} from './types.js';

// Re-export core evaluation functions for advanced usage
export {
  evaluatePolicies,
  evaluateConditions,
  inferAction,
  enrichArgsFromQuery,
  getMatchingActions,
} from '../../core/src/engine.js';
