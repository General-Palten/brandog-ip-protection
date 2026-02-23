-- Add scan queue metadata for assets and scan event telemetry.
-- This mirrors supabase/migrations/20260223203000_add_asset_scan_queue_and_events.sql
-- for manual SQL execution contexts.

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS fingerprint TEXT;

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS scan_status TEXT;

UPDATE public.assets
SET scan_status = 'pending'
WHERE scan_status IS NULL;

ALTER TABLE public.assets
  ALTER COLUMN scan_status SET DEFAULT 'pending';

ALTER TABLE public.assets
  ALTER COLUMN scan_status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'assets_scan_status_check'
      AND conrelid = 'public.assets'::regclass
  ) THEN
    ALTER TABLE public.assets
      ADD CONSTRAINT assets_scan_status_check
      CHECK (scan_status IN ('pending', 'queued', 'scanning', 'success', 'failed', 'skipped'));
  END IF;
END $$;

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS scan_attempts INTEGER;

UPDATE public.assets
SET scan_attempts = 0
WHERE scan_attempts IS NULL;

ALTER TABLE public.assets
  ALTER COLUMN scan_attempts SET DEFAULT 0;

ALTER TABLE public.assets
  ALTER COLUMN scan_attempts SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'assets_scan_attempts_non_negative'
      AND conrelid = 'public.assets'::regclass
  ) THEN
    ALTER TABLE public.assets
      ADD CONSTRAINT assets_scan_attempts_non_negative
      CHECK (scan_attempts >= 0);
  END IF;
END $$;

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS last_scanned_at TIMESTAMPTZ;

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS next_scan_at TIMESTAMPTZ;

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS scan_provider TEXT;

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS last_scan_error TEXT;

CREATE INDEX IF NOT EXISTS idx_assets_fingerprint ON public.assets(brand_id, fingerprint);
CREATE INDEX IF NOT EXISTS idx_assets_scan_queue
  ON public.assets(brand_id, next_scan_at)
  WHERE type = 'image' AND scan_status IN ('queued', 'failed');

ALTER TABLE public.infringements
  ADD COLUMN IF NOT EXISTS detection_provider TEXT DEFAULT 'google_vision';

UPDATE public.infringements
SET detection_provider = 'google_vision'
WHERE detection_provider IS NULL;

ALTER TABLE public.infringements
  ADD COLUMN IF NOT EXISTS detection_method TEXT DEFAULT 'web_detection';

UPDATE public.infringements
SET detection_method = 'web_detection'
WHERE detection_method IS NULL;

ALTER TABLE public.infringements
  ADD COLUMN IF NOT EXISTS source_fingerprint TEXT;

CREATE INDEX IF NOT EXISTS idx_infringements_source_fingerprint
  ON public.infringements(brand_id, source_fingerprint);

CREATE TABLE IF NOT EXISTS public.scan_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'success', 'failed', 'skipped')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  matches_found INTEGER DEFAULT 0,
  duplicates_skipped INTEGER DEFAULT 0,
  invalid_results INTEGER DEFAULT 0,
  failed_results INTEGER DEFAULT 0,
  estimated_cost_usd DECIMAL(10,4),
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scan_events_brand_started
  ON public.scan_events(brand_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_scan_events_asset_started
  ON public.scan_events(asset_id, started_at DESC);
