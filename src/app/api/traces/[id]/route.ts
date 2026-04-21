import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateApiKey } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = validateApiKey(request)
  if (authError) return authError

  try {
    const { id } = await params;
    const trace = await db.executionTrace.findUnique({
      where: { traceId: id },
      include: {
        policy: true,
        approval: true,
      },
    });

    if (!trace) {
      return NextResponse.json(
        { error: 'Trace not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(trace);
  } catch (error) {
    console.error('Error fetching trace:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trace' },
      { status: 500 }
    );
  }
}
