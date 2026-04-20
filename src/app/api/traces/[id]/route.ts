import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
