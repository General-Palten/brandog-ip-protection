-- Add OpenWebNinja service toggle columns and cost estimates to scan_settings.
-- Supports per-brand enable/disable of each provider service.

-- Service toggle columns (per brand)
ALTER TABLE public.scan_settings
  ADD COLUMN IF NOT EXISTS enable_reverse_image_search BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS enable_product_search BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS enable_amazon_data BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS enable_website_contacts BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS enable_social_links BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS enable_web_unblocker BOOLEAN NOT NULL DEFAULT FALSE;

-- Per-service cost estimate columns (overrideable per brand)
ALTER TABLE public.scan_settings
  ADD COLUMN IF NOT EXISTS reverse_image_search_cost_usd DECIMAL(10,6) NOT NULL DEFAULT 0.0025,
  ADD COLUMN IF NOT EXISTS product_search_cost_usd DECIMAL(10,6) NOT NULL DEFAULT 0.0025,
  ADD COLUMN IF NOT EXISTS amazon_data_cost_usd DECIMAL(10,6) NOT NULL DEFAULT 0.0025,
  ADD COLUMN IF NOT EXISTS website_contacts_cost_usd DECIMAL(10,6) NOT NULL DEFAULT 0.0025,
  ADD COLUMN IF NOT EXISTS social_links_cost_usd DECIMAL(10,6) NOT NULL DEFAULT 0.0025,
  ADD COLUMN IF NOT EXISTS web_unblocker_cost_usd DECIMAL(10,6) NOT NULL DEFAULT 0.0005;

-- Relax the provider constraint on provider_fetch_tokens to allow openwebninja
-- (The original CHECK only allowed 'serpapi_lens')
DO $$
BEGIN
  -- Drop old constraint if it exists
  ALTER TABLE public.provider_fetch_tokens
    DROP CONSTRAINT IF EXISTS provider_fetch_tokens_provider_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.provider_fetch_tokens
  ADD CONSTRAINT provider_fetch_tokens_provider_check
    CHECK (provider IN ('serpapi_lens', 'openwebninja'));

-- Add provider_type column to track which system a scan uses (serpapi vs openwebninja)
ALTER TABLE public.scan_settings
  ADD COLUMN IF NOT EXISTS active_scan_provider TEXT NOT NULL DEFAULT 'openwebninja'
    CHECK (active_scan_provider IN ('serpapi_lens', 'openwebninja'));

-- Comment on the new columns for documentation
COMMENT ON COLUMN public.scan_settings.enable_reverse_image_search IS 'Toggle: OpenWebNinja Reverse Image Search (core detection)';
COMMENT ON COLUMN public.scan_settings.enable_product_search IS 'Toggle: OpenWebNinja Product Search (commerce enrichment)';
COMMENT ON COLUMN public.scan_settings.enable_amazon_data IS 'Toggle: OpenWebNinja Amazon Data (seller/product enrichment)';
COMMENT ON COLUMN public.scan_settings.enable_website_contacts IS 'Toggle: OpenWebNinja Website Contacts (takedown contact scraping)';
COMMENT ON COLUMN public.scan_settings.enable_social_links IS 'Toggle: OpenWebNinja Social Links (cross-platform seller linking)';
COMMENT ON COLUMN public.scan_settings.enable_web_unblocker IS 'Toggle: OpenWebNinja Web Unblocker (listing re-crawl monitoring)';
COMMENT ON COLUMN public.scan_settings.active_scan_provider IS 'Which provider system to use for scans: serpapi_lens (legacy) or openwebninja';
