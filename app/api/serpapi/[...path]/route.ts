import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

const SERPAPI_BASE_URL = 'https://serpapi.com';

const buildUpstreamUrl = (request: NextRequest, pathSegments: string[] | undefined): URL => {
  const normalizedPath = (pathSegments || []).join('/').replace(/^\/+/, '');
  const upstream = new URL(normalizedPath, `${SERPAPI_BASE_URL}/`);

  request.nextUrl.searchParams.forEach((value, key) => {
    upstream.searchParams.set(key, value);
  });

  return upstream;
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { path } = await context.params;
  const upstreamUrl = buildUpstreamUrl(request, path);

  if (!upstreamUrl.pathname || upstreamUrl.pathname === '/') {
    return NextResponse.json(
      { error: 'Missing SerpApi path. Use /api/serpapi/search.json.' },
      { status: 400 }
    );
  }

  const serverApiKey = (process.env.SERPAPI_API_KEY || '').trim();
  if (serverApiKey && !upstreamUrl.searchParams.has('api_key')) {
    upstreamUrl.searchParams.set('api_key', serverApiKey);
  }

  if (!upstreamUrl.searchParams.has('api_key')) {
    return NextResponse.json(
      { error: 'SerpApi key missing. Set SERPAPI_API_KEY or provide a key in Settings.' },
      { status: 400 }
    );
  }

  const upstreamResponse = await fetch(upstreamUrl.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  const responseBody = await upstreamResponse.text();

  return new NextResponse(responseBody, {
    status: upstreamResponse.status,
    headers: {
      'content-type': upstreamResponse.headers.get('content-type') || 'application/json',
      'cache-control': 'no-store',
    },
  });
}
