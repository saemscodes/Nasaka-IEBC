-- ============================================================================
-- NASAKA IEBC: MIGRATION VERIFICATION SCRIPT
-- Run this in Supabase SQL Editor to confirm all 16 migrations applied.
-- Each check returns a row. All should show ✅. Any ❌ = migration failed.
-- ============================================================================

SELECT '1. Admin HITL Tables' AS migration,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_tasks')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_task_logs')
  THEN '✅ APPLIED' ELSE '❌ MISSING' END AS status

UNION ALL

SELECT '2. API Integration Columns',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'iebc_offices' AND column_name = 'elevation_meters')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'iebc_offices' AND column_name = 'walking_effort')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'geocoding_service_log')
  THEN '✅ APPLIED' ELSE '❌ MISSING' END

UNION ALL

SELECT '3. Geocode Consensus',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'geocode_audit')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'geocode_hitl_queue')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'iebc_offices' AND column_name = 'geocode_verified')
  THEN '✅ APPLIED' ELSE '❌ MISSING' END

UNION ALL

SELECT '4. Public API Keys',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_keys')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_usage_log')
  THEN '✅ APPLIED' ELSE '❌ MISSING' END

UNION ALL

SELECT '5. Billing Infrastructure',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_keys' AND column_name = 'paystack_customer_code')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_keys' AND column_name = 'credits_balance')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'nasaka_usage_log')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'nasaka_paystack_events')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'nasaka_payment_history')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'nasaka_enterprise_leads')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'nasaka_license_applications')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'nasaka_discount_applications')
  THEN '✅ APPLIED' ELSE '❌ MISSING' END

UNION ALL

SELECT '6. County Normalization',
  CASE WHEN (SELECT COUNT(DISTINCT county) FROM iebc_offices) <= 47
  THEN '✅ APPLIED (≤47 counties)' ELSE '⚠️ CHECK (' || (SELECT COUNT(DISTINCT county) FROM iebc_offices)::TEXT || ' counties)' END

UNION ALL

SELECT '7. Auth Support',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'nasaka_profiles')
  THEN '✅ APPLIED' ELSE '❌ MISSING' END

UNION ALL

SELECT '8. Schema Patch',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_keys' AND column_name = 'user_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_keys' AND column_name = 'key_prefix')
  THEN '✅ APPLIED' ELSE '❌ MISSING' END

UNION ALL

SELECT '9. CEKA Auth Integration',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_keys' AND column_name = 'ceka_user_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'nasaka_profiles' AND column_name = 'ceka_id')
  THEN '✅ APPLIED' ELSE '❌ MISSING' END

UNION ALL

SELECT '10. Credit Deduction RPC',
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'deduct_credits' AND pronamespace = 'public'::regnamespace)
  THEN '✅ APPLIED' ELSE '❌ MISSING' END

UNION ALL

SELECT '11. Geolocation RPCs',
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'find_offices_near_place' AND pronamespace = 'public'::regnamespace)
       AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'search_offices_by_text_and_location' AND pronamespace = 'public'::regnamespace)
  THEN '✅ APPLIED' ELSE '❌ MISSING' END

UNION ALL

SELECT '12. Harmonize RPCs',
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'nearby_offices' AND pronamespace = 'public'::regnamespace)
       AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'charge_usage' AND pronamespace = 'public'::regnamespace)
  THEN '✅ APPLIED' ELSE '❌ MISSING' END

UNION ALL

SELECT '13. Final Harmonization',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'iebc_offices' AND column_name = 'ward')
       AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'search_offices_by_text_and_location_v2' AND pronamespace = 'public'::regnamespace)
  THEN '✅ APPLIED' ELSE '❌ MISSING' END

UNION ALL

SELECT '14. Spatial Routing RPC',
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_nearest_ward' AND pronamespace = 'public'::regnamespace)
  THEN '✅ APPLIED' ELSE '❌ MISSING' END

UNION ALL

SELECT '15. Ward Schema Enhancement',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wards' AND column_name = 'latitude')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wards' AND column_name = 'geocode_verified')
  THEN '✅ APPLIED' ELSE '❌ MISSING' END

UNION ALL

SELECT '16. Confirmations Enhancement',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'confirmations' AND column_name = 'office_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'confirmations' AND column_name = 'is_accurate')
  THEN '✅ APPLIED' ELSE '❌ MISSING' END

ORDER BY migration;
