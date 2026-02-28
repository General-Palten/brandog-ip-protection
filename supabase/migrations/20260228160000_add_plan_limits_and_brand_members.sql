-- Add plan-level limit columns to scan_settings and create brand_members table.

-- ============================================
-- Plan limit columns on scan_settings
-- ============================================
ALTER TABLE public.scan_settings
  ADD COLUMN IF NOT EXISTS max_scans_per_month INTEGER NOT NULL DEFAULT 1000 CHECK (max_scans_per_month > 0),
  ADD COLUMN IF NOT EXISTS max_assets INTEGER NOT NULL DEFAULT 100 CHECK (max_assets > 0),
  ADD COLUMN IF NOT EXISTS max_keywords INTEGER NOT NULL DEFAULT 50 CHECK (max_keywords > 0),
  ADD COLUMN IF NOT EXISTS max_team_seats INTEGER NOT NULL DEFAULT 10 CHECK (max_team_seats > 0),
  ADD COLUMN IF NOT EXISTS max_api_calls_per_month INTEGER NOT NULL DEFAULT 5000 CHECK (max_api_calls_per_month > 0),
  ADD COLUMN IF NOT EXISTS max_storage_bytes BIGINT NOT NULL DEFAULT 10737418240 CHECK (max_storage_bytes > 0);

-- ============================================
-- Brand members table
-- ============================================
CREATE TABLE IF NOT EXISTS public.brand_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (brand_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_brand_members_brand ON public.brand_members(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_members_user ON public.brand_members(user_id);

ALTER TABLE public.brand_members ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'brand_members'
      AND policyname = 'Brand members can view own membership'
  ) THEN
    CREATE POLICY "Brand members can view own membership"
      ON public.brand_members FOR SELECT
      USING (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.brands
          WHERE brands.id = brand_members.brand_id
            AND brands.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'brand_members'
      AND policyname = 'Brand owners can manage members'
  ) THEN
    CREATE POLICY "Brand owners can manage members"
      ON public.brand_members FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.brands
          WHERE brands.id = brand_members.brand_id
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
      AND tablename = 'brand_members'
      AND policyname = 'Admins can manage all brand members'
  ) THEN
    CREATE POLICY "Admins can manage all brand members"
      ON public.brand_members FOR ALL
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
    WHERE tgname = 'update_brand_members_updated_at'
      AND tgrelid = 'public.brand_members'::regclass
  ) THEN
    CREATE TRIGGER update_brand_members_updated_at
      BEFORE UPDATE ON public.brand_members
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Auto-insert brand owner as member on brand creation
CREATE OR REPLACE FUNCTION public.ensure_brand_owner_member()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.brand_members (brand_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (brand_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS create_brand_owner_member ON public.brands;
CREATE TRIGGER create_brand_owner_member
  AFTER INSERT ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.ensure_brand_owner_member();

-- Backfill existing brand owners as members
INSERT INTO public.brand_members (brand_id, user_id, role)
SELECT id, owner_id, 'owner'
FROM public.brands
ON CONFLICT (brand_id, user_id) DO NOTHING;
