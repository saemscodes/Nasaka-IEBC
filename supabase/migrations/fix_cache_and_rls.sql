-- IEBC Registration Centres: FINAL SYNC & SECURITY
-- Run this in Supabase SQL Editor to force cache reload and secure access.

-- 1. Ensure columns exist and cache is forced to update
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='iebc_registration_centres' AND column_name='returning_officer_name') THEN
    ALTER TABLE public.iebc_registration_centres ADD COLUMN returning_officer_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='iebc_registration_centres' AND column_name='returning_officer_email') THEN
    ALTER TABLE public.iebc_registration_centres ADD COLUMN returning_officer_email TEXT;
  END IF;
END $$;

-- 2. Force Security Policy Reset (Guaranteeing service_role access)
ALTER TABLE public.iebc_registration_centres ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "iebc_rc_public_read" ON public.iebc_registration_centres;
CREATE POLICY "iebc_rc_public_read"
  ON public.iebc_registration_centres
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "iebc_rc_service_role_write" ON public.iebc_registration_centres;
CREATE POLICY "iebc_rc_service_role_write"
  ON public.iebc_registration_centres
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Notify PostgREST of the change (Schema Cache Reload)
-- This happens automatically on DDL, but sometimes needs a nudge.
NOTIFY pgrst, 'reload schema';
