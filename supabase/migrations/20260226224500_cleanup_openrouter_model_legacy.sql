-- Cleanup migration for legacy OpenRouter model values in scan_settings.
-- Safe to run multiple times.

ALTER TABLE public.scan_settings
  ALTER COLUMN openrouter_model SET DEFAULT 'arcee-ai/trinity-large-preview:free';

UPDATE public.scan_settings
SET openrouter_model = 'arcee-ai/trinity-large-preview:free'
WHERE openrouter_model IS NULL
   OR btrim(openrouter_model) = ''
   OR lower(btrim(openrouter_model)) IN (
     'openai/gpt-4o-mini',
     'openai/gpt-4o-mini:free'
   );
