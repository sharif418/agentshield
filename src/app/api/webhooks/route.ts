import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const webhooks = await db.webhookConfig.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(webhooks);
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch webhook configs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, url, channel, events, secret, enabled } = body;

    if (!name || !url || !channel || !events) {
      return NextResponse.json(
        { error: 'Missing required fields: name, url, channel, events' },
        { status: 400 }
      );
    }

    const webhook = await db.webhookConfig.create({
      data: {
        name,
        url,
        channel,
        events: typeof events === 'string' ? events : JSON.stringify(events),
        secret,
        enabled: enabled ?? true,
      },
    });

    return NextResponse.json(webhook, { status: 201 });
  } catch (error) {
    console.error('Error creating webhook:', error);
    return NextResponse.json(
      { error: 'Failed to create webhook config' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, url, channel, events, secret, enabled } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      );
    }

    const existing = await db.webhookConfig.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Webhook config not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (url !== undefined) updateData.url = url;
    if (channel !== undefined) updateData.channel = channel;
    if (events !== undefined) updateData.events = typeof events === 'string' ? events : JSON.stringify(events);
    if (secret !== undefined) updateData.secret = secret;
    if (enabled !== undefined) updateData.enabled = enabled;

    const webhook = await db.webhookConfig.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(webhook);
  } catch (error) {
    console.error('Error updating webhook:', error);
    return NextResponse.json(
      { error: 'Failed to update webhook config' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing required parameter: id' },
        { status: 400 }
      );
    }

    const existing = await db.webhookConfig.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Webhook config not found' },
        { status: 404 }
      );
    }

    await db.webhookConfig.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Webhook config deleted successfully' });
  } catch (error) {
    console.error('Error deleting webhook:', error);
    return NextResponse.json(
      { error: 'Failed to delete webhook config' },
      { status: 500 }
    );
  }
}
