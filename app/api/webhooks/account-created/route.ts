import { NextRequest, NextResponse } from 'next/server';
import { ensureAccountProfile } from '@/services/account-profile';

/**
 * POST /api/webhooks/account-created
 *
 * Called by the neupgroup.com auth service when a new account is created.
 * Provisions the account in the local DB. New accounts receive no server
 * access until an explicit `authz_access` record is created for them.
 *
 * Expected body: { accountId: string }
 * Expected header: Authorization: Bearer <WEBHOOK_SECRET>
 */

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
    // 1. Ensure the account row exists with profile fields (idempotent)
    await ensureAccountProfile({ accountId });

    return NextResponse.json({ ok: true, accountId });
  } catch (error) {
    console.error('[account-created webhook] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
