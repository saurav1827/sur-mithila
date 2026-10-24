import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/songs(.*)',
  '/works(.*)',
  '/artists(.*)',
  '/categories(.*)',
  '/playlists(.*)',
  '/community(.*)',
  '/about(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
]);

const isPublicApi = createRouteMatcher([
  '/api/webhooks(.*)',
  '/api/events(.*)',
  '/api/search(.*)',
  '/api/songs(.*)',
  '/api/community(.*)',
  '/api/comments(.*)',
  '/api/edit-requests(.*)',
  '/api/feed(.*)',
  '/api/ai(.*)',
  '/api/history(.*)',
  '/api/track-play(.*)',
  '/api/playlists(.*)',
  '/api/categories(.*)',
  '/api/notifications(.*)',
]);

const isAdminRoute = createRouteMatcher([
  '/admin(.*)',
  '/api/admin(.*)',
]);

const isProtectedRoute = createRouteMatcher([
  '/profile(.*)',
  '/studio(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth();
  const { pathname } = req.nextUrl;

  // 1. Admin routes: require admin role
  if (isAdminRoute(req)) {
    const metadata = (sessionClaims?.metadata || sessionClaims?.public_metadata || (sessionClaims as any)?.publicMetadata) as { role?: string } | undefined;
    const role = metadata?.role || (sessionClaims as any)?.role;
    if (!userId) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const redirectUrl = new URL('/', req.url);
      redirectUrl.searchParams.set('signin', '1');
      redirectUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(redirectUrl);
    }
    // Allow the request to reach the server handler (app/admin/page.js or API),
    // where getAuthRole() verifies direct MongoDB authority even if Clerk JWT is still refreshing.
    return;
  }

  // 2. Protected client routes: redirect with ?signin=1&redirect=/target
  if (isProtectedRoute(req)) {
    if (!userId) {
      const redirectUrl = new URL('/', req.url);
      redirectUrl.searchParams.set('signin', '1');
      redirectUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(redirectUrl);
    }
    return;
  }

  // 3. API protection: reject unauthenticated mutating requests (POST/PUT/DELETE)
  // unless explicitly whitelisted in isPublicApi
  if (pathname.startsWith('/api/')) {
    const isMutating = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
    if (isMutating && !isPublicApi(req) && !userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
