import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createProviderToken, hashProviderToken } from '@/lib/provider-token';
import { getSupabaseService } from '@/lib/supabase-service';

const TOKEN_TTL_SECONDS = 120;
const PUBLIC_APP_URL = (process.env.NEXT_PUBLIC_APP_URL || process.env.PUBLIC_APP_URL || '').trim();

const resolvePublicOrigin = (request: NextRequest): string => {
  if (PUBLIC_APP_URL) {
    return PUBLIC_APP_URL.replace(/\/+$/, '');
  }
  return request.nextUrl.origin.replace(/\/+$/, '');
};

const isPrivateHost = (origin: string): boolean => {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') return true;
    if (host.endsWith('.local')) return true;
    if (host.startsWith('10.') || host.startsWith('192.168.')) return true;
    const parts = host.split('.');
    if (parts.length === 4 && parts.every(part => /^\d+$/.test(part))) {
      const a = Number(parts[0]);
      const b = Number(parts[1]);
      if (a === 172 && b >= 16 && b <= 31) return true;
    }
    return false;
  } catch {
    return true;
  }
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ assetId: string }> }
) {
  const { assetId } = await context.params;
  if (!assetId) {
    return NextResponse.json({ error: 'Missing asset id' }, { status: 400 });
  }

  let body: { provider?: string } = {};
  try {
    body = await request.json();
  } catch {
    // allow empty body
  }

  const provider = body.provider?.trim();
  if (provider !== 'serpapi_lens' && provider !== 'openwebninja') {
    return NextResponse.json(
      { error: 'Unsupported provider. Allowed: serpapi_lens, openwebninja.' },
      { status: 400 }
    );
  }

  const supabase: any = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: asset, error: assetError } = await supabase
    .from('assets')
    .select('id, brand_id, storage_path, type')
    .eq('id', assetId)
    .single();

  if (assetError || !asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  if (!asset.storage_path) {
    return NextResponse.json(
      { error: 'Asset is not persisted in storage; save it first.' },
      { status: 400 }
    );
  }

  const { data: brand, error: brandError } = await supabase
    .from('brands')
    .select('id')
    .eq('id', asset.brand_id)
    .eq('owner_id', user.id)
    .single();

  if (brandError || !brand) {
    return NextResponse.json({ error: 'Not authorized for this asset' }, { status: 403 });
  }

  const tokenProvider = provider as 'serpapi_lens' | 'openwebninja';
  const token = createProviderToken(
    {
      assetId,
      brandId: asset.brand_id,
      provider: tokenProvider,
    },
    TOKEN_TTL_SECONDS
  );
  const expiresAt = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toISOString();
  const origin = resolvePublicOrigin(request);
  const useTokenizedFetch = !isPrivateHost(origin);

  if (!useTokenizedFetch) {
    const { data: signed, error: signedError } = await supabase.storage
      .from('assets')
      .createSignedUrl(asset.storage_path, TOKEN_TTL_SECONDS);

    if (signedError || !signed?.signedUrl) {
      return NextResponse.json(
        { error: 'Failed to create a remotely accessible asset URL for the image search provider.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        providerImageUrl: signed.signedUrl,
        expiresAt,
        mode: 'signed_storage_fallback',
      },
      { status: 200 }
    );
  }

  try {
    const service: any = getSupabaseService();
    const { error: tokenError } = await service
      .from('provider_fetch_tokens')
      .upsert({
        token_hash: hashProviderToken(token),
        asset_id: assetId,
        brand_id: asset.brand_id,
        provider: tokenProvider,
        expires_at: expiresAt,
        max_fetches: 3,
        fetch_count: 0,
        revoked: false,
        created_by: user.id,
      });
    if (tokenError) {
      return NextResponse.json(
        { error: 'Failed to register provider token. Ensure latest DB migrations are applied.' },
        { status: 500 }
      );
    }
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to initialize provider token service client.' },
      { status: 500 }
    );
  }

  const providerFetchUrl = `${origin}/api/provider-fetch/${token}`;

  return NextResponse.json(
    {
      providerImageUrl: providerFetchUrl,
      expiresAt,
      mode: 'tokenized_provider_fetch',
    },
    { status: 200 }
  );
}
