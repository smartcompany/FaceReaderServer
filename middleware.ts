import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { pickDownloadUrl } from './lib/applink';

/**
 * `/applink` — UA 기준 다운로드 링크 302.
 * Android → Play Store, 그 외 → 웹 (face-reader-sandy).
 */
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/applink') {
    const ua = request.headers.get('user-agent') ?? '';
    return NextResponse.redirect(pickDownloadUrl(ua), 302);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/applink'],
};
