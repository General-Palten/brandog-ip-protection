import { NextResponse, type NextRequest } from 'next/server';
import { SERVICE_CATALOG } from '@/lib/provider-registry';
import { createSupabaseServerClient } from '@/lib/supabase-server';

// Maps the first path segment to the correct OpenWebNinja API base URL
const SERVICE_URL_MAP: Record<string, string> = {};
for (const service of SERVICE_CATALOG) {
  SERVICE_URL_MAP[service.key] = service.apiBaseUrl;
}

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
  const segments = path || [];

  if (segments.length < 2) {
    return NextResponse.json(
      { error: 'Usage: /api/openwebninja/{service_key}/{endpoint}. Example: /api/openwebninja/reverse_image_search/reverse-image-search' },
      { status: 400 }
    );
  }

  const serviceKey = segments[0];
  const baseUrl = SERVICE_URL_MAP[serviceKey];
  if (!baseUrl) {
    return NextResponse.json(
      { error: `Unknown service: ${serviceKey}. Valid: ${Object.keys(SERVICE_URL_MAP).join(', ')}` },
      { status: 400 }
    );
  }

  const apiKey = (process.env.OPENWEBNINJA_API_KEY || '').trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENWEBNINJA_API_KEY is not configured on the server.' },
      { status: 500 }
    );
  }

  const endpointPath = '/' + segments.slice(1).join('/');
  const upstream = new URL(`${baseUrl}${endpointPath}`);

  request.nextUrl.searchParams.forEach((value, key) => {
    upstream.searchParams.set(key, value);
  });

  try {
    const upstreamResponse = await fetch(upstream.toString(), {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
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
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'OpenWebNinja proxy request failed' },
      { status: 502 }
    );
  }
}
