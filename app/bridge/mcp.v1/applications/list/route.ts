import { NextResponse } from 'next/server';
import { listApplicationsTool } from '../list';
import type { NextRequest } from 'next/server';
import { authenticateRequest } from '@/services/auth/authentication';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RESPONSE_HEADERS = { 'Cache-Control': 'no-store' };

// Return all applications as JSON.
export async function GET(request: NextRequest) {
  try {
    const serverId = request.nextUrl.searchParams.get('serverId') ?? undefined;
    const serverName = request.nextUrl.searchParams.get('serverName') ?? undefined;
    const serverIdentifier = serverId ?? serverName;
    const account = serverIdentifier ? await authenticateRequest(request) : null;
    if (serverIdentifier && !account) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401, headers: RESPONSE_HEADERS });
    }

    const applications = await listApplicationsTool({ serverId, serverName, accountId: account?.accountId });
    return NextResponse.json({ applications }, { headers: RESPONSE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list applications.' },
      { status: 500, headers: RESPONSE_HEADERS }
    );
  }
}
