import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/services/prisma';

/**
 * POST /api/webhooks/account-created
 *
 * Called by the neupgroup.com auth service when a new account is created.
 * Provisions the account in the local DB and grants the
 * `cloud.individual.default` role.
 *
 * Expected body: { accountId: string }
 * Expected header: Authorization: Bearer <WEBHOOK_SECRET>
 */

const DEFAULT_ROLE_ID = 'cloud.individual.default';

export async function POST(request: NextRequest) {
  // Verify webhook secret
  const secret = process.env.WEBHOOK_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (token !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let body: { accountId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { accountId } = body;
  if (!accountId || typeof accountId !== 'string') {
    return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
  }

  try {
    // 1. Ensure the account row exists (idempotent)
    await prisma.account.upsert({
      where: { id: accountId },
      update: {},
      create: { id: accountId },
    });

    // 2. Grant the default role to the account (owner = self for individual accounts)
    const grantId = `grant::${accountId}::${DEFAULT_ROLE_ID}`;
    await prisma.authzAccountAccessGrant.upsert({
      where: { id: grantId },
      update: {},
      create: {
        id: grantId,
        ownerAccountId: accountId,
        targetAccountId: accountId,
        roleId: DEFAULT_ROLE_ID,
      },
    });

    return NextResponse.json({ ok: true, accountId, roleId: DEFAULT_ROLE_ID });
  } catch (error) {
    console.error('[account-created webhook] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
