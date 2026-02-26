-- Provider fetch token ledger for secure, revocable, capped remote fetch URLs.
-- Used by /api/assets/[assetId]/provider-image-url and /api/provider-fetch/[token].

CREATE TABLE IF NOT EXISTS public.provider_fetch_tokens (
  token_hash TEXT PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('serpapi_lens')),
  expires_at TIMESTAMPTZ NOT NULL,
  max_fetches INTEGER NOT NULL DEFAULT 3 CHECK (max_fetches > 0 AND max_fetches <= 50),
  fetch_count INTEGER NOT NULL DEFAULT 0 CHECK (fetch_count >= 0),
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_fetched_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_provider_fetch_tokens_brand
  ON public.provider_fetch_tokens (brand_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_provider_fetch_tokens_expires
  ON public.provider_fetch_tokens (expires_at);

ALTER TABLE public.provider_fetch_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'provider_fetch_tokens'
      AND policyname = 'Brand owners can view own provider tokens'
  ) THEN
    CREATE POLICY "Brand owners can view own provider tokens"
      ON public.provider_fetch_tokens FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.brands
          WHERE brands.id = provider_fetch_tokens.brand_id
            AND brands.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'provider_fetch_tokens'
      AND policyname = 'Brand owners can revoke own provider tokens'
  ) THEN
    CREATE POLICY "Brand owners can revoke own provider tokens"
      ON public.provider_fetch_tokens FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.brands
          WHERE brands.id = provider_fetch_tokens.brand_id
            AND brands.owner_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.brands
          WHERE brands.id = provider_fetch_tokens.brand_id
            AND brands.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Optional periodic cleanup helper.
CREATE OR REPLACE FUNCTION public.cleanup_expired_provider_fetch_tokens()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.provider_fetch_tokens
  WHERE expires_at < NOW() - INTERVAL '1 day'
     OR revoked = TRUE
     OR fetch_count >= max_fetches;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_provider_fetch_tokens() TO authenticated;
