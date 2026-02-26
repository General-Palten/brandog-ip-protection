-- Ensure scan_settings uses the desired OpenRouter model by default.
-- This migration is safe to run even if previous migrations already set this value.

ALTER TABLE public.scan_settings
  ALTER COLUMN openrouter_model SET DEFAULT 'arcee-ai/trinity-large-preview:free';

UPDATE public.scan_settings
SET openrouter_model = 'arcee-ai/trinity-large-preview:free'
WHERE openrouter_model IS NULL
   OR openrouter_model = ''
   OR openrouter_model = 'openai/gpt-4o-mini';
