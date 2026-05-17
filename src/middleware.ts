import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

// Routes that require authentication
const PROTECTED_ROUTES = ['/dashboard'];

// Routes that should redirect to dashboard if already logged in
const AUTH_ROUTES = ['/', '/reset-password'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
  const isAuthRoute = AUTH_ROUTES.some(route => pathname === route);

  if (isProtected) {
    const ssoToken = request.nextUrl.searchParams.get('sso_token');
    const isIframeParam = request.nextUrl.searchParams.get('iframe') === 'true';
    const isIframeHeader = request.headers.get('sec-fetch-dest') === 'iframe';
    const isSharePointReferer = request.headers.get('referer')?.includes('sharepoint.com') || 
                                request.headers.get('referer')?.includes('microsoft.com') ||
                                request.headers.get('referer')?.includes('msteams');
    
    const isIframeContext = isIframeParam || isIframeHeader || isSharePointReferer;
    
    // Si viene con un token SSO o es un contexto de iframe, permitimos que pase.
    // Esto es vital porque los navegadores bloquean cookies de terceros en iframes (SharePoint).
    if (isIframeContext) {
      const response = NextResponse.next();
      if (ssoToken) {
        response.cookies.set('bedasoft_token', ssoToken, {
          httpOnly: true,
          secure: true, 
          sameSite: 'none',
          maxAge: 60 * 60 * 24 * 7,
          path: '/',
        });
      }
      return response;
    }

    const session = await getSession(request);
    if (!session) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
