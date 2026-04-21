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

// Re-export all types from core
export type {
  PermissionLevel,
  ConditionRule,
  PolicyDefinition,
  EvaluateInput,
  EvaluateResult,
  MatchedPolicy,
  AgentShieldConfig,
} from '../../core/src/types.js';

// Re-export evaluation functions from core for advanced usage
export {
  getMatchingActions,
  evaluateConditions,
  inferAction,
  enrichArgsFromQuery,
  evaluatePolicies,
} from '../../core/src/engine.js';

// Export SDK client
export { AgentShield, createAgentShield } from './client.js';
