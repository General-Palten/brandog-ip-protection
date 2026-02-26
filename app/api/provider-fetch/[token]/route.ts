import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';
import { verifyProviderToken, hashProviderToken } from '@/lib/provider-token';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  let payload;
  try {
    payload = verifyProviderToken(token);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Invalid token' }, { status: 401 });
  }

  const supabase: any = getSupabaseService();
  const tokenHash = hashProviderToken(token);

  const { data: tokenRow, error: tokenReadError } = await supabase
    .from('provider_fetch_tokens')
    .select('token_hash, expires_at, max_fetches, fetch_count, revoked')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (tokenReadError) {
    return NextResponse.json(
      { error: 'Provider token ledger unavailable. Ensure latest DB migrations are applied.' },
      { status: 500 }
    );
  }
  if (!tokenRow) {
    return NextResponse.json({ error: 'Unknown provider token' }, { status: 401 });
  }
  if (tokenRow.revoked) {
    return NextResponse.json({ error: 'Provider token revoked' }, { status: 401 });
  }
  if (new Date(tokenRow.expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: 'Provider token expired' }, { status: 401 });
  }
  if (Number(tokenRow.fetch_count || 0) >= Number(tokenRow.max_fetches || 0)) {
    return NextResponse.json({ error: 'Provider token fetch limit reached' }, { status: 429 });
  }

  const { error: tokenUpdateError } = await supabase
    .from('provider_fetch_tokens')
    .update({
      fetch_count: Number(tokenRow.fetch_count || 0) + 1,
      last_fetched_at: new Date().toISOString(),
    })
    .eq('token_hash', tokenHash);

  if (tokenUpdateError) {
    return NextResponse.json({ error: 'Failed to update provider token usage' }, { status: 500 });
  }

  const { data: asset, error: assetError } = await supabase
    .from('assets')
    .select('storage_path, brand_id')
    .eq('id', payload.assetId)
    .eq('brand_id', payload.brandId)
    .single();

  if (assetError || !asset?.storage_path) {
    return NextResponse.json({ error: 'Asset not found or unauthorized' }, { status: 404 });
  }

  const { data: blob, error: downloadError } = await supabase.storage
    .from('assets')
    .download(asset.storage_path);

  if (downloadError || !blob) {
    return NextResponse.json({ error: 'Failed to read asset' }, { status: 502 });
  }

  const arrayBuffer = await blob.arrayBuffer();
  const contentType = blob.type || 'application/octet-stream';

  const res = new NextResponse(Buffer.from(arrayBuffer), {
    status: 200,
    headers: {
      'content-type': contentType,
      'cache-control': 'no-store',
    },
  });
  return res;
}
