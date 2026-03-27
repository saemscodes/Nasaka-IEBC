-- ============================================================================
-- NASAKA IEBC: WARD FINAL OVERRIDES (100% Efficiency)
-- Hardcoded updates for the final 21 stragglers with typos/complex names
-- ============================================================================

BEGIN;

-- 1. Homa Bay: North Kabuoch (Typo: Kabouch vs Kabuoch)
UPDATE public.wards SET latitude = -0.714450746, longitude = 34.48154372 WHERE ward_name ILIKE '%Kabuoch%' AND county = 'Homa Bay';

-- 2. Homa Bay: RUMA-KAKSINGRI -> Ruma-kaksingiri East
UPDATE public.wards SET latitude = -0.617621187, longitude = 34.26003568 WHERE ward_name ILIKE '%RUMA-KAKSINGRI%' AND county = 'Homa Bay';

-- 3. Kajiado: Mbirikani/Eselenkei
UPDATE public.wards SET latitude = -2.16240904, longitude = 37.54519782 WHERE ward_name ILIKE '%Mbirikani%' AND county = 'Kajiado';

-- 4. Kakamega: Ingostse-Mathia (Typo: Ingostse vs Ingoste)
UPDATE public.wards SET latitude = 0.357568949, longitude = 34.73176107 WHERE ward_name ILIKE '%Ingostse%' AND county = 'Kakamega';

-- 5. Kakamega: Isongo/Makunga/Malaha
UPDATE public.wards SET latitude = 0.316782509, longitude = 34.60973175 WHERE ward_name ILIKE '%Isongo%' AND county = 'Kakamega';

-- 6. Kakamega: Lubinu/Lusheya
UPDATE public.wards SET latitude = 0.299510318, longitude = 34.53564684 WHERE ward_name ILIKE '%Lubinu%' AND county = 'Kakamega';

-- 7. Kericho: Kapsuser (Matches 'BELGUT' in JSON)
UPDATE public.wards SET latitude = -0.361619284, longitude = 35.22289608 WHERE ward_name = 'Kapsuser' AND county = 'Kericho';

-- 8. Kisii: Bobasi Bogetaorio -> Basi Bogetaorio
UPDATE public.wards SET latitude = -0.923234, longitude = 34.570197 WHERE ward_name ILIKE '%Bobasi Bogetaorio%' AND county = 'Kisii';

-- 9. Kisii: Kitutu Central
UPDATE public.wards SET latitude = -0.664398, longitude = 34.534648 WHERE ward_name ILIKE '%Kitutu%Central%' AND county = 'Kisii';

-- 10. Laikipia: Kinamba -> Githiga
UPDATE public.wards SET latitude = -0.107618, longitude = 36.724652 WHERE ward_name = 'Kinamba' AND county = 'Laikipia';

-- 11. Machakos: Machakos Central -> Township
UPDATE public.wards SET latitude = -1.511380, longitude = 37.279919 WHERE ward_name = 'Machakos Central' AND county = 'Machakos';

-- 12. Machakos: Muthwani
UPDATE public.wards SET latitude = -1.365868, longitude = 37.257492 WHERE ward_name = 'Muthwani' AND county = 'Machakos';

-- 13. Machakos: Ndithini
UPDATE public.wards SET latitude = -0.980245, longitude = 37.636065 WHERE ward_name = 'Ndithini' AND county = 'Machakos';

-- 14. Makueni: Kisau/Kiteta
UPDATE public.wards SET latitude = -1.605197, longitude = 37.523480 WHERE ward_name ILIKE '%Kisau%Kiteta%' AND county = 'Makueni';

-- 15. Meru: Ruiri/Rwarera
UPDATE public.wards SET latitude = 0.207900, longitude = 37.604486 WHERE ward_name ILIKE '%Ruiri%Rwarera%' AND county = 'Meru';

-- 16. Mombasa: Mji Wa Kale/Makadara
UPDATE public.wards SET latitude = -4.030626, longitude = 39.680877 WHERE ward_name ILIKE '%Mji Wa Kale%' AND county = 'Mombasa';

-- 17. Mombasa: Shimanzi/Ganjoni
UPDATE public.wards SET latitude = -4.017140, longitude = 39.623202 WHERE ward_name ILIKE '%Shimanzi%' AND county = 'Mombasa';

-- 18. Nairobi: Landhies -> Landimawe
UPDATE public.wards SET latitude = -1.253256, longitude = 36.870650 WHERE ward_name = 'Landhies' AND county = 'Nairobi';

-- 19. Nairobi: Woodley/Kenya Golf Course
UPDATE public.wards SET latitude = -1.321290, longitude = 36.876834 WHERE ward_name ILIKE '%Woodley%' AND county = 'Nairobi';

-- 20. Tharaka-Nithi: IGAMBANG'OMBE
UPDATE public.wards SET latitude = -0.221959, longitude = 37.759633 WHERE ward_name ILIKE '%IGAMBANG%OMBE%' AND county ILIKE 'Tharaka%';

-- 21. Wajir: Wagalla/Ganyure
UPDATE public.wards SET latitude = 1.612100, longitude = 39.470785 WHERE ward_name ILIKE '%Wagalla%' AND county = 'Wajir';

COMMIT;

-- Final Verification
SELECT 
    COUNT(*) AS total_wards,
    COUNT(latitude) AS with_coordinates,
    COUNT(*) - COUNT(latitude) AS still_missing,
    ROUND(COUNT(latitude)::numeric / COUNT(*)::numeric * 100, 2) AS coverage_pct
FROM public.wards;
