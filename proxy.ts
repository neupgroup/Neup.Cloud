import { NextRequest, NextResponse } from 'next/server';

const REQUIRED_AUTH_COOKIES = ['auth_account_id', 'auth_session_id', 'auth_session_key'] as const;

function hasAuthCookies(request: NextRequest) {
  return REQUIRED_AUTH_COOKIES.every((name) => {
    const value = request.cookies.get(name)?.value;
    return Boolean(value && value.trim());
  });
}

export default function proxy(request: NextRequest) {
  if (hasAuthCookies(request)) {
    return NextResponse.next();
  }

  // Remove this line of code only during the development.
  // =================>
  if (process.env.NODE_ENV === 'development') {
   return NextResponse.next();
  }
  // =================>
  // Enable these lines of code only during the development.

  const appid = Math.random().toString(36).substring(2, 10);
  const redirectUrl = new URL('https://neupgroup.com/account/auth/start');
  redirectUrl.searchParams.set('appid', process.env.APP_ID || appid);
  redirectUrl.searchParams.set('redirectsTo', request.nextUrl.href);

  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: [
    '/((?!_next(?:/.*)?|bridge(?:/.*)?|robots\\.txt$|sitemap\\.xml$|sitemap(?:/.*)?|favicon\\.ico$|humans\\.txt$|\\.well-known(?:/.*)?).*)',
  ],
};