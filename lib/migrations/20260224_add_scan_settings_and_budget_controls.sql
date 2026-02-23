-- Add scan settings, daily scan budgets, and queue claim helpers.
-- This mirrors supabase/migrations/20260224010000_add_scan_settings_and_budget_controls.sql
-- for manual SQL execution contexts.

CREATE TABLE IF NOT EXISTS public.scan_settings (
  brand_id UUID PRIMARY KEY REFERENCES public.brands(id) ON DELETE CASCADE,
  max_scans_per_day INTEGER NOT NULL DEFAULT 250 CHECK (max_scans_per_day > 0),
  max_spend_usd_per_day DECIMAL(10,4) NOT NULL DEFAULT 25 CHECK (max_spend_usd_per_day >= 0),
  max_parallel_scans INTEGER NOT NULL DEFAULT 3 CHECK (max_parallel_scans BETWEEN 1 AND 20),
  high_risk_interval_hours INTEGER NOT NULL DEFAULT 24 CHECK (high_risk_interval_hours BETWEEN 1 AND 8760),
  medium_risk_interval_hours INTEGER NOT NULL DEFAULT 72 CHECK (medium_risk_interval_hours BETWEEN 1 AND 8760),
  low_risk_interval_hours INTEGER NOT NULL DEFAULT 336 CHECK (low_risk_interval_hours BETWEEN 1 AND 8760),
  stale_interval_hours INTEGER NOT NULL DEFAULT 720 CHECK (stale_interval_hours BETWEEN 1 AND 8760),
  retry_delay_hours INTEGER NOT NULL DEFAULT 6 CHECK (retry_delay_hours BETWEEN 1 AND 720),
  google_vision_estimated_cost_usd DECIMAL(10,4) NOT NULL DEFAULT 0.0015 CHECK (google_vision_estimated_cost_usd >= 0),
  serpapi_estimated_cost_usd DECIMAL(10,4) NOT NULL DEFAULT 0.01 CHECK (serpapi_estimated_cost_usd >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.scan_settings (brand_id)
SELECT id
FROM public.brands
ON CONFLICT (brand_id) DO NOTHING;

ALTER TABLE public.scan_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'scan_settings'
      AND policyname = 'Brand owners can view own scan settings'
  ) THEN
    CREATE POLICY "Brand owners can view own scan settings"
      ON public.scan_settings FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.brands
          WHERE brands.id = scan_settings.brand_id
            AND brands.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'scan_settings'
      AND policyname = 'Brand owners can insert own scan settings'
  ) THEN
    CREATE POLICY "Brand owners can insert own scan settings"
      ON public.scan_settings FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.brands
          WHERE brands.id = brand_id
            AND brands.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'scan_settings'
      AND policyname = 'Brand owners can update own scan settings'
  ) THEN
    CREATE POLICY "Brand owners can update own scan settings"
      ON public.scan_settings FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.brands
          WHERE brands.id = scan_settings.brand_id
            AND brands.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'scan_settings'
      AND policyname = 'Admins can manage all scan settings'
  ) THEN
    CREATE POLICY "Admins can manage all scan settings"
      ON public.scan_settings FOR ALL
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
    WHERE tgname = 'update_scan_settings_updated_at'
      AND tgrelid = 'public.scan_settings'::regclass
  ) THEN
    CREATE TRIGGER update_scan_settings_updated_at
      BEFORE UPDATE ON public.scan_settings
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.ensure_scan_settings_for_brand()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.scan_settings (brand_id)
  VALUES (NEW.id)
  ON CONFLICT (brand_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS create_scan_settings_for_brand ON public.brands;
CREATE TRIGGER create_scan_settings_for_brand
  AFTER INSERT ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.ensure_scan_settings_for_brand();

CREATE TABLE IF NOT EXISTS public.scan_budget_daily (
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  budget_date DATE NOT NULL,
  scans_executed INTEGER NOT NULL DEFAULT 0 CHECK (scans_executed >= 0),
  spend_usd DECIMAL(12,4) NOT NULL DEFAULT 0 CHECK (spend_usd >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (brand_id, budget_date)
);

CREATE INDEX IF NOT EXISTS idx_scan_budget_daily_brand_date
  ON public.scan_budget_daily(brand_id, budget_date DESC);

ALTER TABLE public.scan_budget_daily ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'scan_budget_daily'
      AND policyname = 'Brand owners can view own scan budgets'
  ) THEN
    CREATE POLICY "Brand owners can view own scan budgets"
      ON public.scan_budget_daily FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.brands
          WHERE brands.id = scan_budget_daily.brand_id
            AND brands.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'scan_budget_daily'
      AND policyname = 'Brand owners can manage own scan budgets'
  ) THEN
    CREATE POLICY "Brand owners can manage own scan budgets"
      ON public.scan_budget_daily FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.brands
          WHERE brands.id = scan_budget_daily.brand_id
            AND brands.owner_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.brands
          WHERE brands.id = brand_id
            AND brands.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'scan_budget_daily'
      AND policyname = 'Admins can manage all scan budgets'
  ) THEN
    CREATE POLICY "Admins can manage all scan budgets"
      ON public.scan_budget_daily FOR ALL
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
    WHERE tgname = 'update_scan_budget_daily_updated_at'
      AND tgrelid = 'public.scan_budget_daily'::regclass
  ) THEN
    CREATE TRIGGER update_scan_budget_daily_updated_at
      BEFORE UPDATE ON public.scan_budget_daily
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.claim_due_asset_scans(
  p_brand_id UUID,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  brand_id UUID,
  name TEXT,
  storage_path TEXT,
  fingerprint TEXT,
  scan_provider TEXT,
  scan_attempts INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER := GREATEST(1, LEAST(COALESCE(p_limit, 5), 50));
  v_is_allowed BOOLEAN;
BEGIN
  SELECT (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = p_brand_id
        AND b.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'lawyer')
    )
  )
  INTO v_is_allowed;

  IF NOT v_is_allowed THEN
    RAISE EXCEPTION 'Not authorized to claim scan jobs for this brand';
  END IF;

  RETURN QUERY
  WITH due AS (
    SELECT a.id
    FROM public.assets a
    WHERE a.brand_id = p_brand_id
      AND a.type = 'image'
      AND a.scan_provider IS NOT NULL
      AND a.scan_status IN ('queued', 'failed', 'success')
      AND a.next_scan_at IS NOT NULL
      AND a.next_scan_at <= NOW()
    ORDER BY a.next_scan_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT v_limit
  ),
  updated AS (
    UPDATE public.assets a
    SET scan_status = 'scanning',
        scan_attempts = COALESCE(a.scan_attempts, 0) + 1,
        last_scan_error = NULL
    FROM due
    WHERE a.id = due.id
    RETURNING a.id, a.brand_id, a.name, a.storage_path, a.fingerprint, a.scan_provider, a.scan_attempts
  )
  SELECT * FROM updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_due_asset_scans(UUID, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_scan_budget_usage(
  p_brand_id UUID,
  p_budget_date DATE DEFAULT CURRENT_DATE,
  p_scan_increment INTEGER DEFAULT 1,
  p_spend_increment DECIMAL DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_budget_date DATE := COALESCE(p_budget_date, CURRENT_DATE);
  v_scan_increment INTEGER := GREATEST(COALESCE(p_scan_increment, 0), 0);
  v_spend_increment DECIMAL := GREATEST(COALESCE(p_spend_increment, 0), 0);
  v_is_allowed BOOLEAN;
BEGIN
  SELECT (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = p_brand_id
        AND b.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'lawyer')
    )
  )
  INTO v_is_allowed;

  IF NOT v_is_allowed THEN
    RAISE EXCEPTION 'Not authorized to record budget usage for this brand';
  END IF;

  INSERT INTO public.scan_budget_daily (
    brand_id,
    budget_date,
    scans_executed,
    spend_usd
  )
  VALUES (
    p_brand_id,
    v_budget_date,
    v_scan_increment,
    v_spend_increment
  )
  ON CONFLICT (brand_id, budget_date)
  DO UPDATE SET
    scans_executed = public.scan_budget_daily.scans_executed + EXCLUDED.scans_executed,
    spend_usd = public.scan_budget_daily.spend_usd + EXCLUDED.spend_usd,
    updated_at = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_scan_budget_usage(UUID, DATE, INTEGER, DECIMAL) TO authenticated;
