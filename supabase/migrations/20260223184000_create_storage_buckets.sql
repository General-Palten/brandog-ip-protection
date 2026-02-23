-- Create required storage buckets for Brandog.
-- Safe to run multiple times.
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('assets', 'assets', false),
  ('ip-documents', 'ip-documents', false),
  ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = EXCLUDED.public;
