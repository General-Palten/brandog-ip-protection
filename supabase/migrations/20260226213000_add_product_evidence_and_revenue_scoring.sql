-- Add commerce evidence, provider run telemetry, and revenue scoring persistence.
-- Safe to run multiple times.

-- ============================================
-- Extend scan settings for cadence and scoring policy
-- ============================================
ALTER TABLE public.scan_settings
  ADD COLUMN IF NOT EXISTS base_interval_days INTEGER NOT NULL DEFAULT 14 CHECK (base_interval_days BETWEEN 1 AND 365);

ALTER TABLE public.scan_settings
  ADD COLUMN IF NOT EXISTS found_interval_days INTEGER NOT NULL DEFAULT 3 CHECK (found_interval_days BETWEEN 1 AND 365);

ALTER TABLE public.scan_settings
  ADD COLUMN IF NOT EXISTS lookback_scans INTEGER NOT NULL DEFAULT 5 CHECK (lookback_scans BETWEEN 1 AND 50);

ALTER TABLE public.scan_settings
  ADD COLUMN IF NOT EXISTS revenue_scoring_order TEXT NOT NULL DEFAULT 'openrouter_first'
    CHECK (revenue_scoring_order IN ('openrouter_first', 'deterministic_first'));

ALTER TABLE public.scan_settings
  ADD COLUMN IF NOT EXISTS openrouter_model TEXT NOT NULL DEFAULT 'arcee-ai/trinity-large-preview:free';

ALTER TABLE public.scan_settings
  ALTER COLUMN openrouter_model SET DEFAULT 'arcee-ai/trinity-large-preview:free';

UPDATE public.scan_settings
SET openrouter_model = 'arcee-ai/trinity-large-preview:free'
WHERE openrouter_model IS NULL
   OR openrouter_model = ''
   OR openrouter_model = 'openai/gpt-4o-mini';

ALTER TABLE public.scan_settings
  ADD COLUMN IF NOT EXISTS openrouter_max_tokens INTEGER NOT NULL DEFAULT 500 CHECK (openrouter_max_tokens BETWEEN 100 AND 4000);

ALTER TABLE public.scan_settings
  ADD COLUMN IF NOT EXISTS max_provider_calls_per_scan INTEGER NOT NULL DEFAULT 3 CHECK (max_provider_calls_per_scan BETWEEN 1 AND 10);

ALTER TABLE public.scan_settings
  ADD COLUMN IF NOT EXISTS max_spend_usd_per_month DECIMAL(12,4) NOT NULL DEFAULT 250 CHECK (max_spend_usd_per_month >= 0);

-- ============================================
-- Provider search run telemetry
-- ============================================
CREATE TABLE IF NOT EXISTS public.provider_search_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  request_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_status INTEGER,
  response_time_ms INTEGER,
  estimated_cost_usd DECIMAL(10,4),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provider_search_runs_brand_created
  ON public.provider_search_runs (brand_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_provider_search_runs_asset_created
  ON public.provider_search_runs (asset_id, created_at DESC);

ALTER TABLE public.provider_search_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'provider_search_runs'
      AND policyname = 'Brand owners can view own provider search runs'
  ) THEN
    CREATE POLICY "Brand owners can view own provider search runs"
      ON public.provider_search_runs FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.brands
          WHERE brands.id = provider_search_runs.brand_id
            AND brands.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'provider_search_runs'
      AND policyname = 'Admins can manage all provider search runs'
  ) THEN
    CREATE POLICY "Admins can manage all provider search runs"
      ON public.provider_search_runs FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
            AND role IN ('admin', 'lawyer')
        )
      );
  END IF;
END $$;

-- ============================================
-- Infringement evidence snapshots
-- ============================================
CREATE TABLE IF NOT EXISTS public.infringement_evidence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  infringement_id UUID NOT NULL REFERENCES public.infringements(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  provider_run_id UUID REFERENCES public.provider_search_runs(id) ON DELETE SET NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  evidence_version INTEGER NOT NULL DEFAULT 1,
  normalized_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_url_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_infringement_evidence_infringement_captured
  ON public.infringement_evidence (infringement_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_infringement_evidence_asset_captured
  ON public.infringement_evidence (asset_id, captured_at DESC);

ALTER TABLE public.infringement_evidence ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'infringement_evidence'
      AND policyname = 'Brand owners can view own infringement evidence'
  ) THEN
    CREATE POLICY "Brand owners can view own infringement evidence"
      ON public.infringement_evidence FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.infringements i
          JOIN public.brands b ON b.id = i.brand_id
          WHERE i.id = infringement_evidence.infringement_id
            AND b.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'infringement_evidence'
      AND policyname = 'Admins can manage all infringement evidence'
  ) THEN
    CREATE POLICY "Admins can manage all infringement evidence"
      ON public.infringement_evidence FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
            AND role IN ('admin', 'lawyer')
        )
      );
  END IF;
END $$;

-- ============================================
-- Offer-level normalized commerce data
-- ============================================
CREATE TABLE IF NOT EXISTS public.listing_offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  infringement_id UUID NOT NULL REFERENCES public.infringements(id) ON DELETE CASCADE,
  listing_url TEXT NOT NULL,
  seller_name TEXT,
  store_name TEXT,
  price_value DECIMAL(12,4),
  currency TEXT,
  price_text TEXT,
  rating DECIMAL(4,2),
  reviews_count INTEGER,
  in_stock BOOLEAN,
  condition TEXT,
  shipping_cost DECIMAL(12,4),
  shipping_currency TEXT,
  tax_info TEXT,
  position INTEGER,
  confidence DECIMAL(5,4),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS listing_offers_unique_listing_per_infringement
  ON public.listing_offers (infringement_id, listing_url);

CREATE INDEX IF NOT EXISTS idx_listing_offers_infringement_last_seen
  ON public.listing_offers (infringement_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_listing_offers_price
  ON public.listing_offers (price_value);

ALTER TABLE public.listing_offers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'listing_offers'
      AND policyname = 'Brand owners can view own listing offers'
  ) THEN
    CREATE POLICY "Brand owners can view own listing offers"
      ON public.listing_offers FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.infringements i
          JOIN public.brands b ON b.id = i.brand_id
          WHERE i.id = listing_offers.infringement_id
            AND b.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'listing_offers'
      AND policyname = 'Admins can manage all listing offers'
  ) THEN
    CREATE POLICY "Admins can manage all listing offers"
      ON public.listing_offers FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
            AND role IN ('admin', 'lawyer')
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_updated_at_column'
      AND pg_function_is_visible(oid)
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_listing_offers_updated_at'
      AND tgrelid = 'public.listing_offers'::regclass
  ) THEN
    CREATE TRIGGER update_listing_offers_updated_at
      BEFORE UPDATE ON public.listing_offers
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- Revenue scoring audit
-- ============================================
CREATE TABLE IF NOT EXISTS public.revenue_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  infringement_id UUID NOT NULL REFERENCES public.infringements(id) ON DELETE CASCADE,
  scored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  model_provider TEXT NOT NULL,
  model_name TEXT,
  scoring_order TEXT,
  fallback_used BOOLEAN NOT NULL DEFAULT FALSE,
  revenue_at_risk_usd DECIMAL(12,2) NOT NULL DEFAULT 0,
  confidence DECIMAL(5,4) NOT NULL DEFAULT 0,
  score_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  explainability_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revenue_scores_infringement_scored
  ON public.revenue_scores (infringement_id, scored_at DESC);

ALTER TABLE public.revenue_scores ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'revenue_scores'
      AND policyname = 'Brand owners can view own revenue scores'
  ) THEN
    CREATE POLICY "Brand owners can view own revenue scores"
      ON public.revenue_scores FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.infringements i
          JOIN public.brands b ON b.id = i.brand_id
          WHERE i.id = revenue_scores.infringement_id
            AND b.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'revenue_scores'
      AND policyname = 'Admins can manage all revenue scores'
  ) THEN
    CREATE POLICY "Admins can manage all revenue scores"
      ON public.revenue_scores FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
            AND role IN ('admin', 'lawyer')
        )
      );
  END IF;
END $$;

-- ============================================
-- Extend infringement record with first-class commerce fields
-- ============================================
ALTER TABLE public.infringements
  ADD COLUMN IF NOT EXISTS primary_listing_price_value DECIMAL(12,4);

ALTER TABLE public.infringements
  ADD COLUMN IF NOT EXISTS primary_listing_currency TEXT;

ALTER TABLE public.infringements
  ADD COLUMN IF NOT EXISTS primary_seller_name TEXT;

ALTER TABLE public.infringements
  ADD COLUMN IF NOT EXISTS primary_rating DECIMAL(4,2);

ALTER TABLE public.infringements
  ADD COLUMN IF NOT EXISTS primary_reviews_count INTEGER;

ALTER TABLE public.infringements
  ADD COLUMN IF NOT EXISTS primary_in_stock BOOLEAN;

ALTER TABLE public.infringements
  ADD COLUMN IF NOT EXISTS primary_condition TEXT;

ALTER TABLE public.infringements
  ADD COLUMN IF NOT EXISTS primary_listing_position INTEGER;

ALTER TABLE public.infringements
  ADD COLUMN IF NOT EXISTS revenue_score_version TEXT;

ALTER TABLE public.infringements
  ADD COLUMN IF NOT EXISTS revenue_confidence DECIMAL(5,4);

ALTER TABLE public.infringements
  ADD COLUMN IF NOT EXISTS revenue_at_risk_usd DECIMAL(12,2);

ALTER TABLE public.infringements
  ADD COLUMN IF NOT EXISTS last_evidence_at TIMESTAMPTZ;

ALTER TABLE public.infringements
  ADD COLUMN IF NOT EXISTS evidence_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.infringements
SET revenue_at_risk_usd = COALESCE(revenue_at_risk_usd, revenue_lost, 0)
WHERE revenue_at_risk_usd IS NULL;

CREATE INDEX IF NOT EXISTS idx_infringements_revenue_at_risk
  ON public.infringements (brand_id, revenue_at_risk_usd DESC);

CREATE INDEX IF NOT EXISTS idx_infringements_last_evidence
  ON public.infringements (brand_id, last_evidence_at DESC);
