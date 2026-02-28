-- ============================================
-- BRANDOG IP PROTECTION - SUPABASE SCHEMA
-- ============================================
-- Run this SQL in your Supabase SQL Editor to set up the database.
-- Make sure to enable RLS after creating the tables.

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES TABLE (extends auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'brand_owner' CHECK (role IN ('brand_owner', 'admin', 'lawyer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BRANDS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  color TEXT DEFAULT 'green',
  website_url TEXT,
  logo_url TEXT,
  is_trademarked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brands_owner ON public.brands(owner_id);

-- ============================================
-- PROTECTED ASSETS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('image', 'video', 'text')),
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  is_protected BOOLEAN DEFAULT true,
  source_url TEXT,
  content TEXT,
  file_size INTEGER,
  fingerprint TEXT,
  scan_status TEXT NOT NULL DEFAULT 'pending' CHECK (scan_status IN (
    'pending', 'queued', 'scanning', 'success', 'failed', 'skipped'
  )),
  scan_attempts INTEGER NOT NULL DEFAULT 0 CHECK (scan_attempts >= 0),
  last_scanned_at TIMESTAMPTZ,
  next_scan_at TIMESTAMPTZ,
  scan_provider TEXT,
  last_scan_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_brand ON public.assets(brand_id);
CREATE INDEX IF NOT EXISTS idx_assets_type ON public.assets(type);
CREATE INDEX IF NOT EXISTS idx_assets_fingerprint ON public.assets(brand_id, fingerprint);
CREATE INDEX IF NOT EXISTS idx_assets_scan_queue
  ON public.assets(brand_id, next_scan_at)
  WHERE type = 'image' AND scan_status IN ('queued', 'failed');

-- ============================================
-- INFRINGEMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.infringements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  original_asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,

  copycat_image_url TEXT,
  similarity_score INTEGER CHECK (similarity_score >= 0 AND similarity_score <= 100),
  detection_provider TEXT DEFAULT 'google_vision',
  detection_method TEXT DEFAULT 'web_detection',
  source_fingerprint TEXT,
  platform TEXT NOT NULL CHECK (platform IN (
    'Meta Ads', 'Instagram', 'Shopify', 'TikTok Shop',
    'Amazon', 'AliExpress', 'eBay', 'Website'
  )),

  infringing_url TEXT,
  seller_name TEXT,
  country TEXT,
  site_visitors INTEGER DEFAULT 0,
  revenue_lost DECIMAL(10,2) DEFAULT 0,

  whois_registrar TEXT,
  whois_creation_date TEXT,
  whois_registrant_country TEXT,

  hosting_provider TEXT,
  hosting_ip_address TEXT,

  status TEXT NOT NULL DEFAULT 'detected' CHECK (status IN (
    'detected', 'pending_review', 'in_progress', 'resolved', 'rejected'
  )),

  detected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_infringements_brand ON public.infringements(brand_id);
CREATE INDEX IF NOT EXISTS idx_infringements_status ON public.infringements(status);
CREATE INDEX IF NOT EXISTS idx_infringements_platform ON public.infringements(platform);
CREATE INDEX IF NOT EXISTS idx_infringements_detected ON public.infringements(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_infringements_source_fingerprint ON public.infringements(brand_id, source_fingerprint);

-- ============================================
-- SCAN EVENTS TABLE
-- ============================================
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

CREATE INDEX IF NOT EXISTS idx_scan_events_brand_started ON public.scan_events(brand_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_events_asset_started ON public.scan_events(asset_id, started_at DESC);

-- ============================================
-- TAKEDOWN REQUESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.takedown_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  infringement_id UUID NOT NULL REFERENCES public.infringements(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN (
    'detected', 'pending_review', 'in_progress', 'resolved', 'rejected'
  )),
  admin_notes TEXT,

  requested_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_takedowns_infringement ON public.takedown_requests(infringement_id);
CREATE INDEX IF NOT EXISTS idx_takedowns_status ON public.takedown_requests(status);

-- ============================================
-- CASE UPDATES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.case_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  takedown_id UUID NOT NULL REFERENCES public.takedown_requests(id) ON DELETE CASCADE,

  update_type TEXT NOT NULL CHECK (update_type IN (
    'takedown_initiated', 'platform_contacted', 'dmca_sent',
    'awaiting_response', 'follow_up_sent', 'escalated',
    'content_removed', 'case_closed', 'custom'
  )),
  message TEXT NOT NULL,
  created_by TEXT NOT NULL CHECK (created_by IN ('lawyer', 'system', 'brand_owner')),
  is_read BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_updates_takedown ON public.case_updates(takedown_id);
CREATE INDEX IF NOT EXISTS idx_case_updates_unread ON public.case_updates(is_read) WHERE is_read = false;

-- ============================================
-- KEYWORDS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.keywords (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,

  text TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  type TEXT NOT NULL CHECK (type IN ('active', 'negative', 'suggested')),
  matches_count INTEGER DEFAULT 0,
  trend TEXT CHECK (trend IN ('up', 'down', 'stable')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(brand_id, text)
);

CREATE INDEX IF NOT EXISTS idx_keywords_brand ON public.keywords(brand_id);
CREATE INDEX IF NOT EXISTS idx_keywords_type ON public.keywords(type);

-- ============================================
-- WHITELIST TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.whitelist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  platform TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(brand_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_whitelist_brand ON public.whitelist(brand_id);

-- ============================================
-- IP DOCUMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.ip_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('Trademark', 'Copyright', 'Patent', 'Other')),
  registration_number TEXT,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Active', 'Pending', 'Expired')),
  expiry_date DATE,
  storage_path TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ip_docs_brand ON public.ip_documents(brand_id);

-- ============================================
-- ACTIVITY LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE,

  action TEXT NOT NULL,
  target TEXT NOT NULL,
  log_type TEXT NOT NULL CHECK (log_type IN ('info', 'warning', 'success', 'danger')),
  icon TEXT,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_user ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_brand ON public.activity_logs(brand_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON public.activity_logs(created_at DESC);

-- ============================================
-- API CONFIGURATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.api_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  vision_api_key_encrypted TEXT,
  is_vision_configured BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- ============================================
-- TRIGGER: Auto-create profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- TRIGGER: Update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_brands_updated_at ON public.brands;
CREATE TRIGGER update_brands_updated_at
  BEFORE UPDATE ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_assets_updated_at ON public.assets;
CREATE TRIGGER update_assets_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_infringements_updated_at ON public.infringements;
CREATE TRIGGER update_infringements_updated_at
  BEFORE UPDATE ON public.infringements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_takedowns_updated_at ON public.takedown_requests;
CREATE TRIGGER update_takedowns_updated_at
  BEFORE UPDATE ON public.takedown_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_keywords_updated_at ON public.keywords;
CREATE TRIGGER update_keywords_updated_at
  BEFORE UPDATE ON public.keywords
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_ip_docs_updated_at ON public.ip_documents;
CREATE TRIGGER update_ip_docs_updated_at
  BEFORE UPDATE ON public.ip_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_api_configs_updated_at ON public.api_configs;
CREATE TRIGGER update_api_configs_updated_at
  BEFORE UPDATE ON public.api_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'lawyer')
    )
  );

-- Brands
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own brands"
  ON public.brands FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can create own brands"
  ON public.brands FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own brands"
  ON public.brands FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own brands"
  ON public.brands FOR DELETE
  USING (owner_id = auth.uid());

CREATE POLICY "Admins can view all brands"
  ON public.brands FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'lawyer')
    )
  );

-- Assets
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage assets for own brands"
  ON public.assets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = assets.brand_id
      AND brands.owner_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all assets"
  ON public.assets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'lawyer')
    )
  );

-- Infringements
ALTER TABLE public.infringements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brand owners can view own infringements"
  ON public.infringements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = infringements.brand_id
      AND brands.owner_id = auth.uid()
    )
  );

CREATE POLICY "Brand owners can create infringements"
  ON public.infringements FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = brand_id
      AND brands.owner_id = auth.uid()
    )
  );

CREATE POLICY "Brand owners can update own infringements"
  ON public.infringements FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = infringements.brand_id
      AND brands.owner_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all infringements"
  ON public.infringements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'lawyer')
    )
  );

-- Scan Events
ALTER TABLE public.scan_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brand owners can view own scan events"
  ON public.scan_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = scan_events.brand_id
      AND brands.owner_id = auth.uid()
    )
  );

CREATE POLICY "Brand owners can create own scan events"
  ON public.scan_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = brand_id
      AND brands.owner_id = auth.uid()
    )
  );

CREATE POLICY "Brand owners can update own scan events"
  ON public.scan_events FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = scan_events.brand_id
      AND brands.owner_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all scan events"
  ON public.scan_events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'lawyer')
    )
  );

-- Takedown Requests
ALTER TABLE public.takedown_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brand owners can view own takedowns"
  ON public.takedown_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.infringements
      JOIN public.brands ON brands.id = infringements.brand_id
      WHERE infringements.id = takedown_requests.infringement_id
      AND brands.owner_id = auth.uid()
    )
  );

CREATE POLICY "Brand owners can create takedowns"
  ON public.takedown_requests FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.infringements
      JOIN public.brands ON brands.id = infringements.brand_id
      WHERE infringements.id = infringement_id
      AND brands.owner_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all takedowns"
  ON public.takedown_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'lawyer')
    )
  );

-- Case Updates
ALTER TABLE public.case_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view related case updates"
  ON public.case_updates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.takedown_requests tr
      JOIN public.infringements i ON i.id = tr.infringement_id
      JOIN public.brands b ON b.id = i.brand_id
      WHERE tr.id = case_updates.takedown_id
      AND (b.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'lawyer')
      ))
    )
  );

CREATE POLICY "Users can create case updates"
  ON public.case_updates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.takedown_requests tr
      JOIN public.infringements i ON i.id = tr.infringement_id
      JOIN public.brands b ON b.id = i.brand_id
      WHERE tr.id = takedown_id
      AND (b.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'lawyer')
      ))
    )
  );

CREATE POLICY "Users can update own case updates"
  ON public.case_updates FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.takedown_requests tr
      JOIN public.infringements i ON i.id = tr.infringement_id
      JOIN public.brands b ON b.id = i.brand_id
      WHERE tr.id = case_updates.takedown_id
      AND (b.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'lawyer')
      ))
    )
  );

-- Keywords
ALTER TABLE public.keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage keywords for own brands"
  ON public.keywords FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = keywords.brand_id
      AND brands.owner_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all keywords"
  ON public.keywords FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'lawyer')
    )
  );

-- Whitelist
ALTER TABLE public.whitelist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage whitelist for own brands"
  ON public.whitelist FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = whitelist.brand_id
      AND brands.owner_id = auth.uid()
    )
  );

-- IP Documents
ALTER TABLE public.ip_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage IP docs for own brands"
  ON public.ip_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = ip_documents.brand_id
      AND brands.owner_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all IP docs"
  ON public.ip_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'lawyer')
    )
  );

-- Activity Logs
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activity"
  ON public.activity_logs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create activity logs"
  ON public.activity_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all activity"
  ON public.activity_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'lawyer')
    )
  );

-- API Configs
ALTER TABLE public.api_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own API config"
  ON public.api_configs FOR ALL
  USING (user_id = auth.uid());

-- ============================================
-- STORAGE BUCKETS
-- ============================================
-- Run these in the Supabase Dashboard or via SQL:

-- INSERT INTO storage.buckets (id, name, public)
-- VALUES
--   ('assets', 'assets', false),
--   ('ip-documents', 'ip-documents', false),
--   ('avatars', 'avatars', true);

-- Storage policies (run after creating buckets):
--
-- CREATE POLICY "Users can upload assets"
--   ON storage.objects FOR INSERT
--   WITH CHECK (
--     bucket_id = 'assets' AND
--     auth.uid()::text = (storage.foldername(name))[1]
--   );
--
-- CREATE POLICY "Users can view own assets"
--   ON storage.objects FOR SELECT
--   USING (
--     bucket_id = 'assets' AND
--     auth.uid()::text = (storage.foldername(name))[1]
--   );
--
-- CREATE POLICY "Users can delete own assets"
--   ON storage.objects FOR DELETE
--   USING (
--     bucket_id = 'assets' AND
--     auth.uid()::text = (storage.foldername(name))[1]
--   );
--
-- CREATE POLICY "Anyone can view avatars"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'avatars');
--
-- CREATE POLICY "Users can upload own avatar"
--   ON storage.objects FOR INSERT
--   WITH CHECK (
--     bucket_id = 'avatars' AND
--     auth.uid()::text = (storage.foldername(name))[1]
--   );
