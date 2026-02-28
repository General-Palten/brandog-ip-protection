-- Add Real-Time Amazon Data toggle and cost columns to scan_settings.
-- Separate from existing enable_amazon_data (which is used for Lens Data).

ALTER TABLE public.scan_settings
  ADD COLUMN IF NOT EXISTS enable_realtime_amazon BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS realtime_amazon_cost_usd DECIMAL(10,6) NOT NULL DEFAULT 0.0025;

COMMENT ON COLUMN public.scan_settings.enable_realtime_amazon IS 'Toggle: OpenWebNinja Real-Time Amazon Data (Amazon product/seller search for counterfeit detection)';
COMMENT ON COLUMN public.scan_settings.realtime_amazon_cost_usd IS 'Per-call cost estimate for Real-Time Amazon Data API';
