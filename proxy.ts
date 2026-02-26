import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/database.types';
import { isBypassAuthEnabled, isSupabaseEnvConfigured } from '@/lib/runtime-config';
import { isLikelyHttpUrl, sanitizeEnvValue } from '@/lib/supabase-env';

const SUPABASE_URL = sanitizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_ANON_KEY = sanitizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const FALLBACK_SUPABASE_URL = 'https://placeholder.supabase.co';
const FALLBACK_SUPABASE_ANON = 'placeholder-key';

export async function proxy(request: NextRequest) {
  if (!isSupabaseEnvConfigured() || isBypassAuthEnabled()) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });
  const resolvedUrl = isLikelyHttpUrl(SUPABASE_URL) ? SUPABASE_URL : FALLBACK_SUPABASE_URL;
  const resolvedAnon = SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON;

  const supabase = createServerClient<Database>(resolvedUrl, resolvedAnon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options as CookieOptions);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthPage = pathname === '/auth';
  const isAppRoute = pathname.startsWith('/app');

  if (isAppRoute && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/auth';

    const nextPath = `${pathname}${request.nextUrl.search}`;
    redirectUrl.searchParams.set('next', nextPath || '/app');

    return NextResponse.redirect(redirectUrl);
  }

  if (isAuthPage && user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/app';
    redirectUrl.search = '';
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ['/app/:path*', '/auth'],
};
