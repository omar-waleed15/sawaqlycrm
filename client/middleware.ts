import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const host = request.headers.get('host') || '';
  const { pathname } = url;

  // Check if host starts with "client."
  const isClientSubdomain = host.startsWith('client.');

  if (isClientSubdomain && !pathname.startsWith('/client-portal')) {
    // Prevent rewriting static assets, API calls, or paths with extensions (.png, .js, etc.)
    if (
      pathname.startsWith('/_next') ||
      pathname.startsWith('/api') ||
      pathname.includes('.')
    ) {
      return NextResponse.next();
    }

    // Internally rewrite path to folder structure under /client-portal/
    url.pathname = `/client-portal${pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}
