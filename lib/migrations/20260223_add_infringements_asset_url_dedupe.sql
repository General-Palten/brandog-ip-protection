-- Enforce one infringement record per (brand, original asset, infringing URL).
-- This keeps matching inserts idempotent for manual and automatic scans.

WITH ranked_duplicates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY brand_id, original_asset_id, infringing_url
      ORDER BY created_at ASC
    ) AS row_num
  FROM public.infringements
  WHERE original_asset_id IS NOT NULL
    AND infringing_url IS NOT NULL
)
DELETE FROM public.infringements i
USING ranked_duplicates d
WHERE i.id = d.id
  AND d.row_num > 1;

CREATE UNIQUE INDEX IF NOT EXISTS infringements_brand_asset_url_unique_idx
  ON public.infringements (brand_id, original_asset_id, infringing_url)
  WHERE original_asset_id IS NOT NULL
    AND infringing_url IS NOT NULL;
