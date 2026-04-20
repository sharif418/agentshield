import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const [
      totalPolicies,
      policiesByLevel,
      totalTraces,
      tracesByResult,
      pendingApprovals,
      recentTraces,
      avgLatencyResult,
      auditLogCount,
    ] = await Promise.all([
      db.policy.count(),

      db.policy.groupBy({
        by: ['permissionLevel'],
        _count: { permissionLevel: true },
      }),

      db.executionTrace.count(),

      db.executionTrace.groupBy({
        by: ['evaluationResult'],
        _count: { evaluationResult: true },
      }),

      db.approvalRequest.count({
        where: { status: 'PENDING' },
      }),

      db.executionTrace.findMany({
        where: {
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { timestamp: 'desc' },
        include: { policy: true },
        take: 10,
      }),

      db.executionTrace.aggregate({
        _avg: { latency: true },
      }),

      db.auditLog.count(),
    ]);

    const policyBreakdown: Record<string, number> = {};
    for (const item of policiesByLevel) {
      policyBreakdown[item.permissionLevel] = item._count.permissionLevel;
    }

    const traceBreakdown: Record<string, number> = {};
    for (const item of tracesByResult) {
      traceBreakdown[item.evaluationResult] = item._count.evaluationResult;
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
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    );
  }
}
