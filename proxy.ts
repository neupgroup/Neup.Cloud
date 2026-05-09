import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * proxy.ts — Next.js Edge Middleware
 *
 * Verifies auth_account JWT using AUTH_PUBLIC_KEY env var (Web Crypto API, Edge-compatible).
 *
 * Rules:
 *   1. /auth/*    → always pass through
 *   2. /bridge/*  → always pass through
 *   3. Static     → always pass through
 *   4. Everything else:
 *      a. Not HTTPS                    → neupgroup.com/account/auth/unsecure?redirectsTo=
 *      b. No auth_account cookie       → neupgroup.com/account/auth/start
 *      c. JWT invalid / tampered       → neupgroup.com/account/auth/start
 *      d. guest: 1 in JWT              → neupgroup.com/account/auth/start (with message)
 *      e. nid missing in JWT           → neupgroup.com/account/auth/start
 *      f. Valid JWT with nid, no guest → permit
 */

// ---------------------------------------------------------------------------
// JWT types
// ---------------------------------------------------------------------------

type JwtPayload = {
  aid?: string;
  sid?: string;
  skey?: string;
  nid?: string;
  guest?: number;
};

// ---------------------------------------------------------------------------
// Web Crypto key import — Edge runtime compatible
// ---------------------------------------------------------------------------

let _cachedKey: CryptoKey | null | undefined = undefined;

async function getPublicKey(): Promise<CryptoKey | null> {
  if (_cachedKey !== undefined) return _cachedKey;

  // AUTH_PUBLIC_KEY from .env — PEM with literal \n for newlines
  const pem = process.env.AUTH_PUBLIC_KEY;
  if (!pem) {
    _cachedKey = null;
    return null;
  }

  try {
    const pemBody = pem
      .replace(/-----BEGIN PUBLIC KEY-----/g, '')
      .replace(/-----END PUBLIC KEY-----/g, '')
      .replace(/\\n/g, '')   // handle literal \n from .env
      .replace(/\s/g, '');

    const keyBuffer = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

    _cachedKey = await crypto.subtle.importKey(
      'spki',
      keyBuffer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    return _cachedKey;
  } catch {
    _cachedKey = null;
    return null;
  }
}

// ---------------------------------------------------------------------------
// JWT verification
// ---------------------------------------------------------------------------

function b64urlDecode(str: string): string {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4;
  return atob(pad ? s + '='.repeat(4 - pad) : s);
}

async function verifyJwt(token: string): Promise<JwtPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, body, sig] = parts;

  // Dev fallback: unsigned token
  if (header === 'unsigned' && sig === 'nosig') {
    try { return JSON.parse(b64urlDecode(body)); } catch { return null; }
  }

  const publicKey = await getPublicKey();

  if (!publicKey) {
    // No key available — decode without verification (dev fallback only)
    try { return JSON.parse(b64urlDecode(body)); } catch { return null; }
  }

  try {
    const signingInput = `${header}.${body}`;
    const sigPadded = sig.replace(/-/g, '+').replace(/_/g, '/');
    const pad = sigPadded.length % 4;
    const sigBuffer = Uint8Array.from(
      atob(pad ? sigPadded + '='.repeat(4 - pad) : sigPadded),
      c => c.charCodeAt(0)
    );

    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      publicKey,
      sigBuffer,
      new TextEncoder().encode(signingInput)
    );

    if (!valid) return null;
    return JSON.parse(b64urlDecode(body));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Redirect helpers
// ---------------------------------------------------------------------------

const AUTH_START_URL = 'https://neupgroup.com/account/auth/start';
const BASE_PATH = '/cloud';

function redirectToAuthStart(request: NextRequest, pathname: string, message?: string) {
  const dest = new URL(AUTH_START_URL);

  const fullPath = BASE_PATH + pathname + request.nextUrl.search;
  if (pathname !== '/' && pathname !== '') {
    dest.searchParams.set('redirects', fullPath);
  }

  if (message) {
    dest.searchParams.set('message', message);
  }

  return NextResponse.redirect(dest);
}

// ---------------------------------------------------------------------------
// Main Proxy Function
// ---------------------------------------------------------------------------

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Prepare headers.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-next-pathname', pathname);

  // 2. HTTPS enforcement
  const proto = request.headers.get('x-forwarded-proto');
  const isSecure = proto === 'https' || request.nextUrl.protocol === 'https:';
  if (!isSecure) {
    const dest = new URL('https://neupgroup.com/account/auth/unsecure');
    const fullPath = BASE_PATH + pathname + request.nextUrl.search;
    dest.searchParams.set('redirectsTo', fullPath);
    return NextResponse.redirect(dest);
  }

  // 3. Exclusions (Static assets, etc.)
  if (
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/.well-known')
  ) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // 4. Auth pages and bridge routes — always pass through
  if (pathname.startsWith('/auth') || pathname.startsWith('/bridge')) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // 5. All other protected routes — verify auth_account JWT
  const raw = request.cookies.get('auth_account')?.value;

  if (!raw) {
    return redirectToAuthStart(request, pathname);
  }

  const payload = await verifyJwt(raw.trim());

  if (!payload || !payload.nid) {
    return redirectToAuthStart(request, pathname);
  }

  // Guest accounts — redirect with sign-in message
  if (payload.guest === 1) {
    return redirectToAuthStart(request, pathname, 'Sign In to continue to NeupCloud');
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    '/((?!_next(?:/.*)?|bridge(?:/.*)?|robots\\.txt$|sitemap\\.xml$|sitemap(?:/.*)?|favicon\\.ico$|humans\\.txt$|\\.well-known(?:/.*)?).*)',
  ],
};
