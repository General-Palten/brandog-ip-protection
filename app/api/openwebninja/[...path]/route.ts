import { NextResponse, type NextRequest } from 'next/server';
import { SERVICE_CATALOG } from '@/lib/provider-registry';

// Maps the first path segment to the correct RapidAPI host
const SERVICE_HOST_MAP: Record<string, string> = {};
for (const service of SERVICE_CATALOG) {
  SERVICE_HOST_MAP[service.key] = service.rapidApiHost;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  const segments = path || [];

  if (segments.length < 2) {
    return NextResponse.json(
      { error: 'Usage: /api/openwebninja/{service_key}/{endpoint}. Example: /api/openwebninja/reverse_image_search/reverse-image-search' },
      { status: 400 }
    );
  }

  const serviceKey = segments[0];
  const host = SERVICE_HOST_MAP[serviceKey];
  if (!host) {
    return NextResponse.json(
      { error: `Unknown service: ${serviceKey}. Valid: ${Object.keys(SERVICE_HOST_MAP).join(', ')}` },
      { status: 400 }
    );
  }

  const apiKey = (process.env.RAPIDAPI_KEY || '').trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: 'RAPIDAPI_KEY is not configured on the server.' },
      { status: 500 }
    );
  }

  const endpointPath = '/' + segments.slice(1).join('/');
  const upstream = new URL(`https://${host}${endpointPath}`);

  request.nextUrl.searchParams.forEach((value, key) => {
    upstream.searchParams.set(key, value);
  });

  try {
    const upstreamResponse = await fetch(upstream.toString(), {
      method: 'GET',
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': host,
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
