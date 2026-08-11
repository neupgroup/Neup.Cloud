/*
::neup.documentation::root-auth-proxy
::title Root Auth Proxy

::public

Protects application page routes by verifying the `auth_account` JWT locally
and redirecting unauthenticated, invalid, or guest sessions to NeupID
authorization.

::public end

::private

Uses `logica.account.auth.verify()` so middleware authorization does not depend
on a browser or server round trip to the account auth endpoint.

::private end

::end
*/

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { buildPublicAppUrl } from '@/core/helpers/link/url';
import logica from '@/logica';
import { ensureAccountProfile, type AccountProfile } from '@/services/account-profile';

type JwtPayload = {
  aid?: string;
  sid?: string;
  skey?: string;
  nid?: string;
  guest?: boolean | number;
};

const NEUPID_AUTH_START_URL = 'https://neupgroup.com/account/auth/start';

async function verifyJwt(token: string): Promise<JwtPayload | null> {
  const verification = await logica.account.auth.verify(token);
  if (!verification.valid) return null;

  return {
    aid: typeof verification.payload.aid === 'string' ? verification.payload.aid : undefined,
    sid: typeof verification.payload.sid === 'string' ? verification.payload.sid : undefined,
    skey: typeof verification.payload.skey === 'string' ? verification.payload.skey : undefined,
    nid: typeof verification.payload.nid === 'string' ? verification.payload.nid : undefined,
    guest: verification.payload.guest === true
      ? 1
      : verification.payload.guest === false
        ? 0
        : verification.payload.guest,
  };
}

function redirectToNeupStart(request: NextRequest, pathname: string): NextResponse {
  const destination = new URL(NEUPID_AUTH_START_URL);
  destination.searchParams.set(
    'authorizeTo',
    buildPublicAppUrl(request, `${pathname}${request.nextUrl.search}`),
  );
  return NextResponse.redirect(destination);
}

function hasAuthenticatedSession(payload: JwtPayload | null): payload is JwtPayload & { aid: string; nid: string } {
  return Boolean(payload?.aid && payload.nid && payload.guest !== 1 && payload.guest !== true);
}

function setProfileCookies(response: NextResponse, profile: AccountProfile | null) {
  if (!profile) return;

  const cookieOptions = {
    path: '/',
    sameSite: 'lax' as const,
  };

  if (profile.displayName) {
    response.cookies.set('neup_profile_display_name', profile.displayName, cookieOptions);
  }

  if (profile.displayImage) {
    response.cookies.set('neup_profile_display_image', profile.displayImage, cookieOptions);
  }

  if (profile.neupid) {
    response.cookies.set('neup_profile_neupid', profile.neupid, cookieOptions);
  }
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-next-pathname', pathname);

  const pass = () => NextResponse.next({ request: { headers: requestHeaders } });

  if (pathname.startsWith('/bridge')) {
    return pass();
  }

  if (
    pathname.startsWith('/_next')
    || pathname === '/favicon.ico'
    || pathname.startsWith('/.well-known')
  ) {
    return pass();
  }

  const rawToken = request.cookies.get('auth_account')?.value.trim();
  const payload = rawToken ? await verifyJwt(rawToken) : null;

  if (payload?.aid) {
    requestHeaders.set('x-account-id', payload.aid);
  }

  if (!hasAuthenticatedSession(payload)) {
    return redirectToNeupStart(request, pathname);
  }

  const response = pass();
  try {
    const profile = await ensureAccountProfile({
      accountId: payload.aid,
      neupid: payload.nid,
    });
    setProfileCookies(response, profile);
  } catch (error) {
    console.error('[auth proxy] failed to sync account profile:', error);
  }
  return response;
}

export const config = {
  matcher: [
    '/((?!_next(?:/.*)?|bridge(?:/.*)?|api(?:/.*)?|robots\\.txt$|sitemap\\.xml$|sitemap(?:/.*)?|favicon\\.ico$|humans\\.txt$|\\.well-known(?:/.*)?|.*\\..*).*)',
  ],
};
