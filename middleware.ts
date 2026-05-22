import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isAdmin, isLoggedIn, verifyJwt } from './src/lib/auth';

const REFRESH_TOKEN_COOKIE = 'refresh_token';
const LOGIN_PATH = '/login';

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL(LOGIN_PATH, request.url);
  loginUrl.searchParams.set('redirectedFrom', request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!token) return redirectToLogin(request);

  const payload = await verifyJwt(token);
  if (!isLoggedIn(payload)) return redirectToLogin(request);

  if (pathname.startsWith('/admin') && !isAdmin(payload)) {
    return redirectToLogin(request);
  }

  if (pathname.startsWith('/jastiper') && payload?.role !== 'JASTIPER' && !isAdmin(payload)) {
    return redirectToLogin(request);
  }

  const requestHeaders = new Headers(request.headers);
  if (payload?.sub) requestHeaders.set('x-user-id', payload.sub);
  if (payload?.role) requestHeaders.set('x-role', payload.role);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/orders/:path*',
    '/wallet/:path*',
    '/profile/:path*',
    '/jastiper/:path*',
    '/checkout/:path*',
    '/admin/:path*',
  ],
};