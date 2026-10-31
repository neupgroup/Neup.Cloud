import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/services/auth/authentication';
import { listServerCommandLogs } from '../log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const RESPONSE_HEADERS = { 'Cache-Control': 'no-store' };

// Return recent command logs for an authenticated account's server.
export async function GET(request: NextRequest) {
  const account = await authenticateRequest(request);
  if (!account) return NextResponse.json({ error: 'Authentication required.' }, { status: 401, headers: RESPONSE_HEADERS });

  try {
    const serverId = request.nextUrl.searchParams.get('serverId') ?? '';
    const requestedLimit = Number(request.nextUrl.searchParams.get('limit'));
    const logs = await listServerCommandLogs({ serverId, accountId: account.accountId, limit: requestedLimit || undefined });
    return NextResponse.json({ logs }, { headers: RESPONSE_HEADERS });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to list command logs.' }, { status: 400, headers: RESPONSE_HEADERS });
  }
}
