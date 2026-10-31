import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { listServersTool } from '../list';
import { authenticateRequest } from '@/services/auth/authentication';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RESPONSE_HEADERS = { 'Cache-Control': 'no-store' };

// Return the servers visible to the authenticated account as JSON.
export async function GET(request: NextRequest) {
  const account = await authenticateRequest(request);
  if (!account) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401, headers: RESPONSE_HEADERS }
    );
  }

  try {
    const servers = await listServersTool({ accountId: account.accountId });
    return NextResponse.json({ servers }, { headers: RESPONSE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list servers.' },
      { status: 500, headers: RESPONSE_HEADERS }
    );
  }
}
