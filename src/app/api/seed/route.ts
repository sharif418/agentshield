import { NextRequest, NextResponse } from 'next/server';
import { db, prismaClient } from '@/lib/db';
import { validateApiKey } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const authError = validateApiKey(request)
  if (authError) return authError

  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Seed endpoint is disabled in production. This endpoint deletes all data and should only be used in development.' },
      { status: 403 }
    )
  }

  try {
    // Clear existing data (in reverse dependency order)
    // Use raw prismaClient for AuditLog since the extended client blocks deleteMany
    await prismaClient.auditLog.deleteMany();
    await db.approvalRequest.deleteMany();
    await db.executionTrace.deleteMany();
    await db.policy.deleteMany();
    await db.webhookConfig.deleteMany();

    // === POLICIES (15+) ===
    const policies = await Promise.all([
      db.policy.create({
        data: {
          policyId: 'POL-dataagent-postgres-allow',
          name: 'DataAgent PostgreSQL Read Access',
          description: 'Allow DataAgent to perform read operations on PostgreSQL databases',
          agentRole: 'DataAgent',
          resource: 'PostgreSQL',
          action: 'SELECT',
          permissionLevel: 'ALLOW',
          priority: 5,
          enabled: true,
        },
      }),
      db.policy.create({
        data: {
          policyId: 'POL-dataagent-postgres-block',
          name: 'DataAgent PostgreSQL Drop Block',
          description: 'Block DataAgent from dropping tables or databases in PostgreSQL',
          agentRole: 'DataAgent',
          resource: 'PostgreSQL',
          action: 'DROP',
          permissionLevel: 'BLOCK',
          conditionRules: JSON.stringify({ operation: { $in: ['DROP_TABLE', 'DROP_DATABASE', 'TRUNCATE'] } }),
          priority: 20,
          enabled: true,
        },
      }),
      db.policy.create({
        data: {
          policyId: 'POL-dataagent-postgres-write',
          name: 'DataAgent PostgreSQL Write Approval',
          description: 'DataAgent write operations on PostgreSQL require human approval',
          agentRole: 'DataAgent',
          resource: 'PostgreSQL',
          action: 'INSERT_UPDATE_DELETE',
          permissionLevel: 'REQUIRE_APPROVAL',
          conditionRules: JSON.stringify({ operation: { $in: ['INSERT', 'UPDATE', 'DELETE'] } }),
          priority: 10,
          enabled: true,
        },
      }),
      db.policy.create({
        data: {
          policyId: 'POL-codeagent-github-allow',
          name: 'CodeAgent GitHub Read Access',
          description: 'Allow CodeAgent to read repositories and pull requests on GitHub',
          agentRole: 'CodeAgent',
          resource: 'GitHub',
          action: 'READ',
          permissionLevel: 'ALLOW',
          priority: 5,
          enabled: true,
        },
      }),
      db.policy.create({
        data: {
          policyId: 'POL-codeagent-github-approval',
          name: 'CodeAgent GitHub Write Approval',
          description: 'CodeAgent write operations on GitHub require approval',
          agentRole: 'CodeAgent',
          resource: 'GitHub',
          action: 'WRITE',
          permissionLevel: 'REQUIRE_APPROVAL',
          conditionRules: JSON.stringify({ operation: { $in: ['PUSH', 'MERGE', 'DELETE_BRANCH'] } }),
          priority: 10,
          enabled: true,
        },
      }),
      db.policy.create({
        data: {
          policyId: 'POL-codeagent-github-admin-block',
          name: 'CodeAgent GitHub Admin Block',
          description: 'Block CodeAgent from admin operations on GitHub',
          agentRole: 'CodeAgent',
          resource: 'GitHub',
          action: 'ADMIN',
          permissionLevel: 'BLOCK',
          conditionRules: JSON.stringify({ operation: { $in: ['DELETE_REPO', 'CHANGE_SETTINGS', 'ADD_COLLABORATOR'] } }),
          priority: 20,
          enabled: true,
        },
      }),
      db.policy.create({
        data: {
          policyId: 'POL-financeagent-stripe-read',
          name: 'FinanceAgent Stripe Read Access',
          description: 'Allow FinanceAgent to read Stripe payment and customer data',
          agentRole: 'FinanceAgent',
          resource: 'Stripe',
          action: 'READ',
          permissionLevel: 'ALLOW',
          priority: 5,
          enabled: true,
        },
      }),
      db.policy.create({
        data: {
          policyId: 'POL-financeagent-stripe-refund-approval',
          name: 'FinanceAgent Stripe Refund Approval',
          description: 'FinanceAgent refund operations on Stripe require human approval',
          agentRole: 'FinanceAgent',
          resource: 'Stripe',
          action: 'REFUND',
          permissionLevel: 'REQUIRE_APPROVAL',
          conditionRules: JSON.stringify({ operation: 'REFUND', $or: [{ amount: { $gt: 100 } }, { currency: 'USD' }] }),
          priority: 15,
          enabled: true,
        },
      }),
      db.policy.create({
        data: {
          policyId: 'POL-financeagent-stripe-delete-block',
          name: 'FinanceAgent Stripe Delete Block',
          description: 'Block FinanceAgent from deleting Stripe resources',
          agentRole: 'FinanceAgent',
          resource: 'Stripe',
          action: 'DELETE',
          permissionLevel: 'BLOCK',
          priority: 20,
          enabled: true,
        },
      }),
      db.policy.create({
        data: {
          policyId: 'POL-supportagent-slack-allow',
          name: 'SupportAgent Slack Read Access',
          description: 'Allow SupportAgent to read Slack messages and channels',
          agentRole: 'SupportAgent',
          resource: 'SlackAPI',
          action: 'READ',
          permissionLevel: 'ALLOW',
          priority: 5,
          enabled: true,
        },
      }),
      db.policy.create({
        data: {
          policyId: 'POL-supportagent-slack-post-approval',
          name: 'SupportAgent Slack Post Approval',
          description: 'SupportAgent posting to Slack channels requires approval',
          agentRole: 'SupportAgent',
          resource: 'SlackAPI',
          action: 'POST_MESSAGE',
          permissionLevel: 'REQUIRE_APPROVAL',
          conditionRules: JSON.stringify({ channel: { $in: ['#general', '#announcements', '#executive'] } }),
          priority: 10,
          enabled: true,
        },
      }),
      db.policy.create({
        data: {
          policyId: 'POL-dataagent-filesystem-read',
          name: 'DataAgent FileSystem Read Access',
          description: 'Allow DataAgent to read files from the filesystem',
          agentRole: 'DataAgent',
          resource: 'FileSystem',
          action: 'READ',
          permissionLevel: 'ALLOW',
          priority: 5,
          enabled: true,
        },
      }),
      db.policy.create({
        data: {
          policyId: 'POL-dataagent-filesystem-block',
          name: 'DataAgent FileSystem Write Block',
          description: 'Block DataAgent from writing to critical filesystem paths',
          agentRole: 'DataAgent',
          resource: 'FileSystem',
          action: 'WRITE',
          permissionLevel: 'BLOCK',
          conditionRules: JSON.stringify({ path: { $contains: '/etc/' } }),
          priority: 20,
          enabled: true,
        },
      }),
      db.policy.create({
        data: {
          policyId: 'POL-supportagent-email-allow',
          name: 'SupportAgent Email Read Access',
          description: 'Allow SupportAgent to read and search emails',
          agentRole: 'SupportAgent',
          resource: 'EmailAPI',
          action: 'READ',
          permissionLevel: 'ALLOW',
          priority: 5,
          enabled: true,
        },
      }),
      db.policy.create({
        data: {
          policyId: 'POL-supportagent-email-send-approval',
          name: 'SupportAgent Email Send Approval',
          description: 'SupportAgent sending emails requires approval for external recipients',
          agentRole: 'SupportAgent',
          resource: 'EmailAPI',
          action: 'SEND',
          permissionLevel: 'REQUIRE_APPROVAL',
          conditionRules: JSON.stringify({ recipient_domain: { $in: ['external.com', 'partner.org'] } }),
          priority: 10,
          enabled: true,
        },
      }),
      db.policy.create({
        data: {
          policyId: 'POL-codeagent-filesystem-read',
          name: 'CodeAgent FileSystem Read Access',
          description: 'Allow CodeAgent to read source code files',
          agentRole: 'CodeAgent',
          resource: 'FileSystem',
          action: 'READ',
          permissionLevel: 'ALLOW',
          priority: 5,
          enabled: true,
        },
      }),
      db.policy.create({
        data: {
          policyId: 'POL-codeagent-filesystem-write-approval',
          name: 'CodeAgent FileSystem Write Approval',
          description: 'CodeAgent write operations to filesystem require approval',
          agentRole: 'CodeAgent',
          resource: 'FileSystem',
          action: 'WRITE',
          permissionLevel: 'REQUIRE_APPROVAL',
          conditionRules: JSON.stringify({ path: { $contains: '/production/' } }),
          priority: 10,
          enabled: true,
        },
      }),
    ]);

    // === EXECUTION TRACES (50+) ===
    const agentRoles = ['DataAgent', 'CodeAgent', 'SupportAgent', 'FinanceAgent'];
    const resources = ['PostgreSQL', 'GitHub', 'Stripe', 'FileSystem', 'EmailAPI', 'SlackAPI'];
    const evaluationResults: ('ALLOW' | 'BLOCK' | 'REQUIRE_APPROVAL')[] = ['ALLOW', 'BLOCK', 'REQUIRE_APPROVAL'];

    const traceData: {
      traceId: string;
      sessionId: string;
      agentRole: string;
      toolName: string;
      intentPayload: string;
      evaluationResult: string;
      matchedPolicyId: string | null;
      latency: number;
      timestamp: Date;
    }[] = [];

    const sessions = Array.from({ length: 10 }, (_, i) => `SES-${(1000 + i).toString(36)}-${Math.random().toString(36).substring(2, 6)}`);

    // Generate realistic traces
    const traceTemplates = [
      { agent: 'DataAgent', tool: 'PostgreSQL', action: 'SELECT', result: 'ALLOW', policyId: 'POL-dataagent-postgres-allow', intent: { query: 'SELECT * FROM users WHERE status = $1', params: ['active'], database: 'production_db' } },
      { agent: 'DataAgent', tool: 'PostgreSQL', action: 'SELECT', result: 'ALLOW', policyId: 'POL-dataagent-postgres-allow', intent: { query: 'SELECT COUNT(*) FROM orders WHERE created_at > $1', params: ['2024-01-01'], database: 'analytics_db' } },
      { agent: 'DataAgent', tool: 'PostgreSQL', action: 'DROP', result: 'BLOCK', policyId: 'POL-dataagent-postgres-block', intent: { query: 'DROP TABLE users', database: 'production_db' } },
      { agent: 'DataAgent', tool: 'PostgreSQL', action: 'INSERT', result: 'REQUIRE_APPROVAL', policyId: 'POL-dataagent-postgres-write', intent: { query: 'INSERT INTO audit_log (event, user_id) VALUES ($1, $2)', params: ['login', 42], database: 'production_db' } },
      { agent: 'DataAgent', tool: 'FileSystem', action: 'READ', result: 'ALLOW', policyId: 'POL-dataagent-filesystem-read', intent: { path: '/data/exports/report.csv', operation: 'read' } },
      { agent: 'DataAgent', tool: 'FileSystem', action: 'WRITE', result: 'BLOCK', policyId: 'POL-dataagent-filesystem-block', intent: { path: '/etc/config.yaml', operation: 'write', content: '...' } },
      { agent: 'CodeAgent', tool: 'GitHub', action: 'READ', result: 'ALLOW', policyId: 'POL-codeagent-github-allow', intent: { repo: 'org/main-app', operation: 'list_pull_requests', branch: 'main' } },
      { agent: 'CodeAgent', tool: 'GitHub', action: 'READ', result: 'ALLOW', policyId: 'POL-codeagent-github-allow', intent: { repo: 'org/main-app', operation: 'get_file_contents', path: 'src/index.ts' } },
      { agent: 'CodeAgent', tool: 'GitHub', action: 'WRITE', result: 'REQUIRE_APPROVAL', policyId: 'POL-codeagent-github-approval', intent: { repo: 'org/main-app', operation: 'PUSH', branch: 'main', files: ['src/api.ts'] } },
      { agent: 'CodeAgent', tool: 'GitHub', action: 'ADMIN', result: 'BLOCK', policyId: 'POL-codeagent-github-admin-block', intent: { repo: 'org/main-app', operation: 'DELETE_REPO' } },
      { agent: 'CodeAgent', tool: 'GitHub', action: 'WRITE', result: 'REQUIRE_APPROVAL', policyId: 'POL-codeagent-github-approval', intent: { repo: 'org/main-app', operation: 'MERGE', pull_request: 1234, target: 'main' } },
      { agent: 'CodeAgent', tool: 'FileSystem', action: 'READ', result: 'ALLOW', policyId: 'POL-codeagent-filesystem-read', intent: { path: '/home/project/src/app.ts', operation: 'read' } },
      { agent: 'CodeAgent', tool: 'FileSystem', action: 'WRITE', result: 'REQUIRE_APPROVAL', policyId: 'POL-codeagent-filesystem-write-approval', intent: { path: '/production/deploy/app.js', operation: 'write' } },
      { agent: 'FinanceAgent', tool: 'Stripe', action: 'READ', result: 'ALLOW', policyId: 'POL-financeagent-stripe-read', intent: { operation: 'list_charges', limit: 100, starting_after: 'ch_1234' } },
      { agent: 'FinanceAgent', tool: 'Stripe', action: 'READ', result: 'ALLOW', policyId: 'POL-financeagent-stripe-read', intent: { operation: 'get_customer', customer_id: 'cus_abc123' } },
      { agent: 'FinanceAgent', tool: 'Stripe', action: 'REFUND', result: 'REQUIRE_APPROVAL', policyId: 'POL-financeagent-stripe-refund-approval', intent: { operation: 'REFUND', charge_id: 'ch_xyz789', amount: 2500, currency: 'USD', reason: 'customer_request' } },
      { agent: 'FinanceAgent', tool: 'Stripe', action: 'DELETE', result: 'BLOCK', policyId: 'POL-financeagent-stripe-delete-block', intent: { operation: 'DELETE', resource: 'customer', id: 'cus_abc123' } },
      { agent: 'FinanceAgent', tool: 'Stripe', action: 'REFUND', result: 'REQUIRE_APPROVAL', policyId: 'POL-financeagent-stripe-refund-approval', intent: { operation: 'REFUND', charge_id: 'ch_def456', amount: 50, currency: 'EUR', reason: 'duplicate' } },
      { agent: 'SupportAgent', tool: 'SlackAPI', action: 'READ', result: 'ALLOW', policyId: 'POL-supportagent-slack-allow', intent: { operation: 'list_messages', channel: '#support-tickets', limit: 50 } },
      { agent: 'SupportAgent', tool: 'SlackAPI', action: 'POST_MESSAGE', result: 'REQUIRE_APPROVAL', policyId: 'POL-supportagent-slack-post-approval', intent: { operation: 'post_message', channel: '#general', text: 'System maintenance scheduled for tonight' } },
      { agent: 'SupportAgent', tool: 'EmailAPI', action: 'READ', result: 'ALLOW', policyId: 'POL-supportagent-email-allow', intent: { operation: 'search_emails', query: 'from:support@company.com', limit: 25 } },
      { agent: 'SupportAgent', tool: 'EmailAPI', action: 'SEND', result: 'REQUIRE_APPROVAL', policyId: 'POL-supportagent-email-send-approval', intent: { operation: 'send_email', to: 'client@external.com', subject: 'Your Support Ticket Update', body: '...' } },
    ];

    // Generate 50+ traces with varied timestamps over the past 7 days
    for (let i = 0; i < 55; i++) {
      const template = traceTemplates[i % traceTemplates.length];
      const daysAgo = Math.floor(Math.random() * 7);
      const hoursAgo = Math.floor(Math.random() * 24);
      const minutesAgo = Math.floor(Math.random() * 60);
      const timestamp = new Date(Date.now() - daysAgo * 86400000 - hoursAgo * 3600000 - minutesAgo * 60000);

      traceData.push({
        traceId: `TRC-${(Date.now() - i * 100000).toString(36)}-${Math.random().toString(36).substring(2, 8)}`,
        sessionId: sessions[Math.floor(Math.random() * sessions.length)],
        agentRole: template.agent,
        toolName: template.tool,
        intentPayload: JSON.stringify(template.intent),
        evaluationResult: template.result,
        matchedPolicyId: template.policyId,
        latency: parseFloat((Math.random() * 4.9 + 0.1).toFixed(3)),
        timestamp,
      });
    }

    // Sort by timestamp ascending
    traceData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const traces = await db.executionTrace.createMany({
      data: traceData,
    });

    // === APPROVAL REQUESTS (8+) ===
    // Get some traces that require approval to link approvals
    const approvalTraces = await db.executionTrace.findMany({
      where: { evaluationResult: 'REQUIRE_APPROVAL' },
      take: 10,
    });

    const approvalStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'MODIFIED'] as const;
    const reviewers = ['reviewer-alice', 'reviewer-bob', 'reviewer-carol', 'reviewer-dan'];

    const approvalRecords: Record<string, unknown>[] = [];
    for (let i = 0; i < Math.min(approvalTraces.length, 10); i++) {
      const trace = approvalTraces[i];
      const status = approvalStatuses[i % approvalStatuses.length];
      const reviewer = reviewers[i % reviewers.length];

      const data: Record<string, unknown> = {
        requestId: `APR-${(Date.now() - i * 100000).toString(36)}-${Math.random().toString(36).substring(2, 8)}`,
        traceId: trace.traceId,
        agentContext: JSON.stringify({
          agentRole: trace.agentRole,
          sessionId: trace.sessionId,
          priorActions: ['login', 'navigate', 'select_resource'],
        }),
        requestedAction: trace.intentPayload,
        status,
      };

      if (status !== 'PENDING') {
        data.humanReviewerId = reviewer;
        data.reviewNotes = status === 'APPROVED'
          ? 'Action reviewed and approved. No risk identified.'
          : status === 'REJECTED'
            ? 'Action rejected due to policy violation concerns.'
            : 'Action modified to reduce scope. Limited to read-only access.';
        data.reviewTimestamp = new Date(trace.timestamp.getTime() + Math.random() * 3600000);
      }

      if (status === 'MODIFIED') {
        data.modifiedAction = JSON.stringify({
          operation: 'READ_ONLY',
          scope: 'limited',
          reason: 'Downgraded from write to read for safety',
        });
      }

      approvalRecords.push(data);
    }

    const approvals = await db.approvalRequest.createMany({
      data: approvalRecords as any,  
    });

    // === AUDIT LOGS (30+) ===
    const auditEvents = [
      { eventType: 'POLICY_CREATED', actor: 'system', details: { message: 'Initial policy set created during system setup' } },
      { eventType: 'POLICY_CREATED', actor: 'DataAgent', details: { policyId: 'POL-dataagent-postgres-allow', name: 'DataAgent PostgreSQL Read Access' } },
      { eventType: 'POLICY_CREATED', actor: 'CodeAgent', details: { policyId: 'POL-codeagent-github-allow', name: 'CodeAgent GitHub Read Access' } },
      { eventType: 'POLICY_UPDATED', actor: 'admin', details: { policyId: 'POL-financeagent-stripe-refund-approval', change: 'increased refund threshold to $100' } },
      { eventType: 'POLICY_UPDATED', actor: 'admin', details: { policyId: 'POL-dataagent-postgres-block', change: 'added TRUNCATE to blocked operations' } },
      { eventType: 'TRACE_EVALUATED', actor: 'DataAgent', details: { toolName: 'PostgreSQL', decision: 'ALLOW', latency: 1.2 } },
      { eventType: 'TRACE_EVALUATED', actor: 'CodeAgent', details: { toolName: 'GitHub', decision: 'BLOCK', latency: 0.8 } },
      { eventType: 'TRACE_EVALUATED', actor: 'FinanceAgent', details: { toolName: 'Stripe', decision: 'REQUIRE_APPROVAL', latency: 1.5 } },
      { eventType: 'TRACE_EVALUATED', actor: 'SupportAgent', details: { toolName: 'SlackAPI', decision: 'ALLOW', latency: 0.3 } },
      { eventType: 'TRACE_EVALUATED', actor: 'DataAgent', details: { toolName: 'FileSystem', decision: 'BLOCK', latency: 0.9 } },
      { eventType: 'TRACE_EVALUATED', actor: 'CodeAgent', details: { toolName: 'GitHub', decision: 'ALLOW', latency: 1.1 } },
      { eventType: 'TRACE_EVALUATED', actor: 'FinanceAgent', details: { toolName: 'Stripe', decision: 'ALLOW', latency: 0.7 } },
      { eventType: 'TRACE_EVALUATED', actor: 'SupportAgent', details: { toolName: 'EmailAPI', decision: 'REQUIRE_APPROVAL', latency: 2.1 } },
      { eventType: 'APPROVAL_DECISION', actor: 'reviewer-alice', details: { requestId: 'APR-demo1', decision: 'APPROVED', traceId: 'TRC-demo1' } },
      { eventType: 'APPROVAL_DECISION', actor: 'reviewer-bob', details: { requestId: 'APR-demo2', decision: 'REJECTED', traceId: 'TRC-demo2' } },
      { eventType: 'APPROVAL_DECISION', actor: 'reviewer-carol', details: { requestId: 'APR-demo3', decision: 'MODIFIED', traceId: 'TRC-demo3' } },
      { eventType: 'APPROVAL_DECISION', actor: 'reviewer-dan', details: { requestId: 'APR-demo4', decision: 'APPROVED', traceId: 'TRC-demo4' } },
      { eventType: 'APPROVAL_DECISION', actor: 'reviewer-alice', details: { requestId: 'APR-demo5', decision: 'REJECTED', traceId: 'TRC-demo5' } },
      { eventType: 'POLICY_CREATED', actor: 'admin', details: { policyId: 'POL-codeagent-filesystem-read', name: 'CodeAgent FileSystem Read Access' } },
      { eventType: 'POLICY_CREATED', actor: 'admin', details: { policyId: 'POL-supportagent-email-send-approval', name: 'SupportAgent Email Send Approval' } },
      { eventType: 'POLICY_UPDATED', actor: 'admin', details: { policyId: 'POL-supportagent-slack-post-approval', change: 'added #executive to restricted channels' } },
      { eventType: 'TRACE_EVALUATED', actor: 'DataAgent', details: { toolName: 'PostgreSQL', decision: 'REQUIRE_APPROVAL', latency: 1.8 } },
      { eventType: 'TRACE_EVALUATED', actor: 'CodeAgent', details: { toolName: 'FileSystem', decision: 'ALLOW', latency: 0.5 } },
      { eventType: 'TRACE_EVALUATED', actor: 'FinanceAgent', details: { toolName: 'Stripe', decision: 'BLOCK', latency: 1.3 } },
      { eventType: 'APPROVAL_DECISION', actor: 'reviewer-bob', details: { requestId: 'APR-demo6', decision: 'APPROVED', traceId: 'TRC-demo6' } },
      { eventType: 'APPROVAL_DECISION', actor: 'reviewer-carol', details: { requestId: 'APR-demo7', decision: 'MODIFIED', traceId: 'TRC-demo7' } },
      { eventType: 'POLICY_UPDATED', actor: 'system', details: { policyId: 'POL-financeagent-stripe-delete-block', change: 'enabled policy' } },
      { eventType: 'TRACE_EVALUATED', actor: 'SupportAgent', details: { toolName: 'SlackAPI', decision: 'ALLOW', latency: 0.4 } },
      { eventType: 'TRACE_EVALUATED', actor: 'DataAgent', details: { toolName: 'PostgreSQL', decision: 'ALLOW', latency: 0.9 } },
      { eventType: 'TRACE_EVALUATED', actor: 'CodeAgent', details: { toolName: 'GitHub', decision: 'REQUIRE_APPROVAL', latency: 1.7 } },
      { eventType: 'POLICY_CREATED', actor: 'admin', details: { policyId: 'POL-codeagent-filesystem-write-approval', name: 'CodeAgent FileSystem Write Approval' } },
      { eventType: 'TRACE_EVALUATED', actor: 'FinanceAgent', details: { toolName: 'Stripe', decision: 'ALLOW', latency: 0.6 } },
      { eventType: 'APPROVAL_DECISION', actor: 'reviewer-dan', details: { requestId: 'APR-demo8', decision: 'APPROVED', traceId: 'TRC-demo8' } },
    ];

    const auditLogs = await db.auditLog.createMany({
      data: auditEvents.map((event, i) => {
        const daysAgo = Math.floor(Math.random() * 7);
        const hoursAgo = Math.floor(Math.random() * 24);
        return {
          eventType: event.eventType,
          actor: event.actor,
          details: JSON.stringify(event.details),
          timestamp: new Date(Date.now() - daysAgo * 86400000 - hoursAgo * 3600000),
          immutable: true,
        };
      }),
    });

    // === WEBHOOK CONFIGS (2) ===
    const webhooks = await Promise.all([
      db.webhookConfig.create({
        data: {
          name: 'Slack Policy Alerts',
          url: 'https://hooks.slack.com/services/T00/B00/xxx',
          channel: 'slack',
          events: JSON.stringify(['POLICY_CREATED', 'POLICY_UPDATED', 'POLICY_DELETED', 'APPROVAL_DECISION']),
          secret: 'whsec_slack_demo_secret',
          enabled: true,
        },
      }),
      db.webhookConfig.create({
        data: {
          name: 'Teams Security Notifications',
          url: 'https://outlook.office.com/webhook/xxx',
          channel: 'teams',
          events: JSON.stringify(['TRACE_EVALUATED', 'APPROVAL_DECISION']),
          secret: 'whsec_teams_demo_secret',
          enabled: true,
        },
      }),
    ]);

    return NextResponse.json({
      message: 'Database seeded successfully',
      counts: {
        policies: policies.length,
        traces: traceData.length,
        approvals: approvalRecords.length,
        auditLogs: auditEvents.length,
        webhooks: webhooks.length,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error seeding database:', error);
    return NextResponse.json(
      { error: 'Failed to seed database', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
