import type { NextRequest } from 'next/server';
import logica from '@neup/logica';
import { getCookie } from '@neup/core/helpers/cookie';

export type AuthenticatedAccount = {
  accountId: string;
  neupid: string;
  token: string;
};

type AuthPayload = {
  aid?: string;
  nid?: string;
  guest?: boolean | number;
};

// Verify a Neup account JWT and reject invalid, incomplete, or guest sessions.
export async function authenticateToken(token: string | null | undefined): Promise<AuthenticatedAccount | null> {
  const normalizedToken = token?.trim();
  if (!normalizedToken) return null;

  try {
    const verification = await logica.account.auth.verify(normalizedToken);
    if (!verification.valid) return null;

    const payload = verification.payload as AuthPayload;
    if (
      typeof payload.aid !== 'string' || !payload.aid.trim()
      || typeof payload.nid !== 'string' || !payload.nid.trim()
      || payload.guest === true || payload.guest === 1
    ) {
      return null;
    }

    return {
      accountId: payload.aid.trim(),
      neupid: payload.nid.trim(),
      token: normalizedToken,
    };
  } catch {
    return null;
  }
}

// Authenticate a request from x-auth first, then fall back to the auth cookie.
export async function authenticateRequest(request: NextRequest): Promise<AuthenticatedAccount | null> {
  const headerToken = request.headers.get('x-auth');
  const cookieToken = request.cookies.get('auth')?.value;
  return await authenticateToken(headerToken) ?? authenticateToken(cookieToken);
}

// Authenticate a server action using the current auth cookie.
export async function authenticateCurrentCookie(): Promise<AuthenticatedAccount | null> {
  try {
    return authenticateToken(await getCookie('auth'));
  } catch {
    return null;
  }
}
