import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateApiKey } from '@/lib/auth';
import { z } from 'zod'

const CreateWebhookSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().min(1).max(500).url(),
  channel: z.enum(['slack', 'teams', 'telegram']),
  events: z.union([z.string(), z.array(z.string())]),
  secret: z.string().max(200).optional(),
  enabled: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  const authError = validateApiKey(request)
  if (authError) return authError

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
  const authError = validateApiKey(request)
  if (authError) return authError

  try {
    const rawBody = await request.json();
    const parseResult = CreateWebhookSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { name, url, channel, events, secret, enabled } = parseResult.data;

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
  const authError = validateApiKey(request)
  if (authError) return authError

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
  const authError = validateApiKey(request)
  if (authError) return authError

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
