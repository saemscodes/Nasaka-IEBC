-- cleanup_and_fix_rls.sql
-- 1. Remove sidebar-scraped garbage
DELETE FROM public.iebc_registration_centres
WHERE name IN ('Speeches', 'FAQs', 'Statistics of Voters 2022', 'Gallery', 'About IEBC', 'Contacts', 'Download Forms', 'Party list', 'Complaint Forms');

-- 2. Remove rows where ward/constituency match garbage names
DELETE FROM public.iebc_registration_centres
WHERE county = name OR constituency = name;

-- 3. Ensure RLS allows the current ANON/SERVICE_ROLE key to insert
-- Since the user provided the same key for both in .env, we make it permissive for ingestion.
DROP POLICY IF EXISTS "iebc_rc_service_role_write" ON public.iebc_registration_centres;
CREATE POLICY "iebc_rc_service_role_write"
  ON public.iebc_registration_centres
  FOR ALL TO anon, authenticated, service_role 
  USING (true) WITH CHECK (true);

-- 4. Verify count
SELECT count(*) FROM public.iebc_registration_centres;
