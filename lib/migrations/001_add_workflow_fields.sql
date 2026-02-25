-- ============================================
-- MIGRATION: Add workflow fields for new infringement flow
-- ============================================
-- Run this migration to add new columns for the redesigned workflow.
-- This is safe to run multiple times (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS patterns).

-- ============================================
-- UPDATE INFRINGEMENTS TABLE
-- ============================================

-- Add new status values
-- First, we need to drop and recreate the constraint to allow new status values
ALTER TABLE public.infringements
  DROP CONSTRAINT IF EXISTS infringements_status_check;

ALTER TABLE public.infringements
  ADD CONSTRAINT infringements_status_check CHECK (status IN (
    'detected',
    'pending_review',
    'needs_member_input',
    'in_progress',
    'resolved_success',
    'resolved_partial',
    'resolved_failed',
    'dismissed_by_member',
    'dismissed_by_admin',
    -- Legacy values for backwards compatibility
    'resolved',
    'rejected'
  ));

-- Add priority column
ALTER TABLE public.infringements
  ADD COLUMN IF NOT EXISTS priority TEXT CHECK (priority IN ('high', 'medium', 'low'));

-- Add priority_set_by column
ALTER TABLE public.infringements
  ADD COLUMN IF NOT EXISTS priority_set_by TEXT CHECK (priority_set_by IN ('member', 'admin', 'auto'));

-- Add dismiss_reason column
ALTER TABLE public.infringements
  ADD COLUMN IF NOT EXISTS dismiss_reason TEXT CHECK (dismiss_reason IN (
    'licensed_authorized',
    'not_our_product',
    'insufficient_evidence',
    'other'
  ));

-- Add dismiss_reason_text column for custom text
ALTER TABLE public.infringements
  ADD COLUMN IF NOT EXISTS dismiss_reason_text TEXT;

-- Add retry_count column
ALTER TABLE public.infringements
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Create index for priority filtering
CREATE INDEX IF NOT EXISTS idx_infringements_priority
  ON public.infringements(priority)
  WHERE priority IS NOT NULL;

-- ============================================
-- UPDATE TAKEDOWN_REQUESTS TABLE
-- ============================================

-- Update status constraint for takedown_requests
ALTER TABLE public.takedown_requests
  DROP CONSTRAINT IF EXISTS takedown_requests_status_check;

ALTER TABLE public.takedown_requests
  ADD CONSTRAINT takedown_requests_status_check CHECK (status IN (
    'detected',
    'pending_review',
    'needs_member_input',
    'in_progress',
    'resolved_success',
    'resolved_partial',
    'resolved_failed',
    'dismissed_by_member',
    'dismissed_by_admin',
    -- Legacy values for backwards compatibility
    'resolved',
    'rejected'
  ));

-- ============================================
-- UPDATE CASE_UPDATES TABLE
-- ============================================

-- Update update_type constraint for case_updates
ALTER TABLE public.case_updates
  DROP CONSTRAINT IF EXISTS case_updates_update_type_check;

ALTER TABLE public.case_updates
  ADD CONSTRAINT case_updates_update_type_check CHECK (update_type IN (
    -- Original types
    'takedown_initiated',
    'platform_contacted',
    'dmca_sent',
    'awaiting_response',
    'follow_up_sent',
    'escalated',
    'content_removed',
    'case_closed',
    'custom',
    -- New workflow types
    'sent_back_to_member',
    'member_responded',
    'member_withdrew',
    'retry_requested',
    'priority_changed',
    'evidence_added',
    'enforcement_requested'
  ));

-- ============================================
-- MIGRATE LEGACY STATUS VALUES (Optional)
-- ============================================
-- Run these to migrate existing data to new statuses.
-- Comment out if you want to keep legacy statuses.

-- UPDATE public.infringements
--   SET status = 'resolved_success'
--   WHERE status = 'resolved';

-- UPDATE public.infringements
--   SET status = 'dismissed_by_member'
--   WHERE status = 'rejected';

-- UPDATE public.takedown_requests
--   SET status = 'resolved_success'
--   WHERE status = 'resolved';

-- UPDATE public.takedown_requests
--   SET status = 'dismissed_by_member'
--   WHERE status = 'rejected';

-- ============================================
-- DONE
-- ============================================
-- After running this migration:
-- 1. New infringements will use the new status values
-- 2. Priority can be set on cases
-- 3. Dismiss reasons are tracked
-- 4. Retry count is tracked for failed cases
