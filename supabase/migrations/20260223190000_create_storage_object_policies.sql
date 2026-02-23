-- Create Storage object policies for Brandog buckets.
-- Uses guards for idempotency.

DO $$
BEGIN
  -- assets
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'assets_insert_own'
  ) THEN
    CREATE POLICY assets_insert_own
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'assets'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'assets_select_own'
  ) THEN
    CREATE POLICY assets_select_own
      ON storage.objects FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'assets'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'assets_delete_own'
  ) THEN
    CREATE POLICY assets_delete_own
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'assets'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;

  -- ip-documents
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'ip_documents_insert_own'
  ) THEN
    CREATE POLICY ip_documents_insert_own
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'ip-documents'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'ip_documents_select_own'
  ) THEN
    CREATE POLICY ip_documents_select_own
      ON storage.objects FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'ip-documents'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'ip_documents_delete_own'
  ) THEN
    CREATE POLICY ip_documents_delete_own
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'ip-documents'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;

  -- avatars
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'avatars_select_public'
  ) THEN
    CREATE POLICY avatars_select_public
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'avatars');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'avatars_insert_own'
  ) THEN
    CREATE POLICY avatars_insert_own
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'avatars'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'avatars_update_own'
  ) THEN
    CREATE POLICY avatars_update_own
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'avatars'
        AND auth.uid()::text = (storage.foldername(name))[1]
      )
      WITH CHECK (
        bucket_id = 'avatars'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'avatars_delete_own'
  ) THEN
    CREATE POLICY avatars_delete_own
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'avatars'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;
