-- IEBC Registration Centres: EMERGENCY RLS DISABLE
-- Use this ONLY to allow the scraper to finish without policy conflicts.

-- 1. Disable RLS temporarily
ALTER TABLE public.iebc_registration_centres DISABLE ROW LEVEL SECURITY;

-- 2. Notify PostgREST
NOTIFY pgrst, 'reload schema';
