import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/services/auth/authentication';
import { listServerFiles } from '../list';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const RESPONSE_HEADERS = { 'Cache-Control': 'no-store' };

// List a remote directory for an authenticated account's server.
export async function GET(request: NextRequest) {
  const account = await authenticateRequest(request);
  if (!account) return NextResponse.json({ error: 'Authentication required.' }, { status: 401, headers: RESPONSE_HEADERS });

  try {
    const files = await listServerFiles({
      serverId: request.nextUrl.searchParams.get('serverId') ?? '',
      path: request.nextUrl.searchParams.get('path') ?? undefined,
      accountId: account.accountId,
    });
    return NextResponse.json({ files }, { headers: RESPONSE_HEADERS });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to list server files.' }, { status: 400, headers: RESPONSE_HEADERS });
  }
}
