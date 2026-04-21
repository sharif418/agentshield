import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

function getTimeRangeCutoff(timeRange: string | null): Date {
  const range = timeRange ?? '24h';
  const now = Date.now();
  switch (range) {
    case '24h': return new Date(now - 24 * 60 * 60 * 1000);
    case '7d': return new Date(now - 7 * 24 * 60 * 60 * 1000);
    case '30d': return new Date(now - 30 * 24 * 60 * 60 * 1000);
    case '90d': return new Date(now - 90 * 24 * 60 * 60 * 1000);
    default: return new Date(now - 24 * 60 * 60 * 1000);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange');
    const cutoff = getTimeRangeCutoff(timeRange);

    const [
      totalPolicies,
      policiesByLevel,
      totalTraces,
      tracesByResult,
      pendingApprovals,
      recentTraces,
      avgLatencyResult,
      auditLogCount,
      policiesByRoleData,
    ] = await Promise.all([
      db.policy.count(),

      db.policy.groupBy({
        by: ['permissionLevel'],
        _count: { permissionLevel: true },
      }),

      db.executionTrace.count({
        where: { timestamp: { gte: cutoff } },
      }),

      db.executionTrace.groupBy({
        by: ['evaluationResult'],
        _count: { evaluationResult: true },
        where: { timestamp: { gte: cutoff } },
      }),

      db.approvalRequest.count({
        where: { status: 'PENDING' },
      }),

      db.executionTrace.findMany({
        where: {
          timestamp: { gte: cutoff },
        },
        orderBy: { timestamp: 'desc' },
        include: { policy: true },
        take: 10,
      }),

      db.executionTrace.aggregate({
        _avg: { latency: true },
        where: { timestamp: { gte: cutoff } },
      }),

      db.auditLog.count(),

      db.policy.groupBy({
        by: ['agentRole'],
        _count: { agentRole: true },
      }),
    ]);

    const policyBreakdown: Record<string, number> = {};
    for (const item of policiesByLevel) {
      policyBreakdown[item.permissionLevel] = item._count.permissionLevel;
    }

    const traceBreakdown: Record<string, number> = {};
    for (const item of tracesByResult) {
      traceBreakdown[item.evaluationResult] = item._count.evaluationResult;
    }

    const policiesByRole: Record<string, number> = {};
    for (const item of policiesByRoleData) {
      policiesByRole[item.agentRole] = item._count.agentRole;
    }

    return NextResponse.json({
      totalPolicies,
      policyBreakdown,
      totalTraces,
      traceBreakdown,
      pendingApprovals,
      recentTracesCount: recentTraces.length,
      recentTraces,
      averageLatency: avgLatencyResult._avg.latency
        ? parseFloat(avgLatencyResult._avg.latency.toFixed(3))
        : 0,
      auditLogCount,
      policiesByRole,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    );
  }
}
