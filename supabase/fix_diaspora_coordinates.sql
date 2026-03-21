-- ============================================================================
-- NASAKA IEBC: Diaspora Coordinate Fix
-- 20260322 — UPDATE existing UUID rows with lat/lng from GeoJSON
-- NO SCHEMA CHANGES — works with existing UUID id column
-- ============================================================================

-- STEP 1: UPDATE all existing rows with coordinates (matching by LOWER(city) + country_code)
-- Africa
UPDATE diaspora_registration_centres SET latitude = 0.3136,  longitude = 32.5811 WHERE LOWER(city) = 'kampala'          AND country_code = 'UG';
UPDATE diaspora_registration_centres SET latitude = -6.7924, longitude = 39.2083 WHERE LOWER(city) = 'dar es salaam'    AND country_code = 'TZ';
UPDATE diaspora_registration_centres SET latitude = -3.3731, longitude = 36.6941 WHERE LOWER(city) = 'arusha'           AND country_code = 'TZ';
UPDATE diaspora_registration_centres SET latitude = -1.9441, longitude = 30.0619 WHERE LOWER(city) = 'kigali'           AND country_code = 'RW';
UPDATE diaspora_registration_centres SET latitude = -3.3614, longitude = 29.3599 WHERE LOWER(city) = 'bujumbura'        AND country_code = 'BI';
UPDATE diaspora_registration_centres SET latitude = -25.746, longitude = 28.2293 WHERE LOWER(city) = 'pretoria'         AND country_code = 'ZA';
UPDATE diaspora_registration_centres SET latitude = 4.8594,  longitude = 31.5713 WHERE LOWER(city) = 'juba'             AND country_code = 'SS';
UPDATE diaspora_registration_centres SET latitude = 9.0109,  longitude = 38.7613 WHERE LOWER(city) = 'addis ababa'      AND country_code = 'ET';
UPDATE diaspora_registration_centres SET latitude = 9.0579,  longitude = 7.4951  WHERE LOWER(city) = 'abuja'            AND country_code = 'NG';
UPDATE diaspora_registration_centres SET latitude = 30.0626, longitude = 31.2497 WHERE LOWER(city) = 'cairo'            AND country_code = 'EG';
UPDATE diaspora_registration_centres SET latitude = -17.8277, longitude = 31.0534 WHERE LOWER(city) = 'harare'           AND country_code = 'ZW';
UPDATE diaspora_registration_centres SET latitude = -15.4166, longitude = 28.2833 WHERE LOWER(city) = 'lusaka'           AND country_code = 'ZM';
UPDATE diaspora_registration_centres SET latitude = 15.5007, longitude = 32.5599 WHERE LOWER(city) = 'khartoum'         AND country_code = 'SD';
UPDATE diaspora_registration_centres SET latitude = -13.9626, longitude = 33.7741 WHERE LOWER(city) = 'lilongwe'         AND country_code = 'MW';
UPDATE diaspora_registration_centres SET latitude = 2.0469,  longitude = 45.3182 WHERE LOWER(city) = 'mogadishu'        AND country_code = 'SO';
UPDATE diaspora_registration_centres SET latitude = 5.6037,  longitude = -0.187  WHERE LOWER(city) = 'accra'            AND country_code = 'GH';
UPDATE diaspora_registration_centres SET latitude = -4.3217, longitude = 15.3222 WHERE LOWER(city) = 'kinshasa'         AND country_code = 'CD';

-- Americas
UPDATE diaspora_registration_centres SET latitude = 38.92,   longitude = -77.0516 WHERE LOWER(city) = 'washington dc'   AND country_code = 'US';
UPDATE diaspora_registration_centres SET latitude = 40.758,  longitude = -73.9855 WHERE LOWER(city) = 'new york'        AND country_code = 'US';
UPDATE diaspora_registration_centres SET latitude = 34.0522, longitude = -118.2437 WHERE LOWER(city) = 'los angeles'     AND country_code = 'US';
UPDATE diaspora_registration_centres SET latitude = 45.4215, longitude = -75.6972 WHERE LOWER(city) = 'ottawa'          AND country_code = 'CA';
UPDATE diaspora_registration_centres SET latitude = 43.6532, longitude = -79.3832 WHERE LOWER(city) = 'toronto'         AND country_code = 'CA';
UPDATE diaspora_registration_centres SET latitude = 49.2827, longitude = -123.1207 WHERE LOWER(city) = 'vancouver'       AND country_code = 'CA';
UPDATE diaspora_registration_centres SET latitude = -15.7939, longitude = -47.8828 WHERE LOWER(city) = 'brasilia'        AND country_code = 'BR';

-- Europe
UPDATE diaspora_registration_centres SET latitude = 51.52,   longitude = -0.1773  WHERE LOWER(city) = 'london'          AND country_code = 'GB';
UPDATE diaspora_registration_centres SET latitude = 52.4961, longitude = 13.3206  WHERE LOWER(city) = 'berlin'          AND country_code = 'DE';
UPDATE diaspora_registration_centres SET latitude = 48.8668, longitude = 2.306    WHERE LOWER(city) = 'paris'           AND country_code = 'FR';
UPDATE diaspora_registration_centres SET latitude = 41.9028, longitude = 12.4964  WHERE LOWER(city) = 'rome'            AND country_code = 'IT';
UPDATE diaspora_registration_centres SET latitude = 50.8503, longitude = 4.3517   WHERE LOWER(city) = 'brussels'        AND country_code = 'BE';
UPDATE diaspora_registration_centres SET latitude = 59.3293, longitude = 18.0686  WHERE LOWER(city) = 'stockholm'       AND country_code = 'SE';
UPDATE diaspora_registration_centres SET latitude = 55.7558, longitude = 37.6173  WHERE LOWER(city) = 'moscow'          AND country_code = 'RU';
UPDATE diaspora_registration_centres SET latitude = 40.4168, longitude = -3.7038  WHERE LOWER(city) = 'madrid'          AND country_code = 'ES';
UPDATE diaspora_registration_centres SET latitude = 48.2082, longitude = 16.3738  WHERE LOWER(city) = 'vienna'          AND country_code = 'AT';
UPDATE diaspora_registration_centres SET latitude = 52.0705, longitude = 4.3007   WHERE LOWER(city) = 'the hague'       AND country_code = 'NL';

-- Middle East
UPDATE diaspora_registration_centres SET latitude = 24.4539, longitude = 54.3773  WHERE LOWER(city) = 'abu dhabi'       AND country_code = 'AE';
UPDATE diaspora_registration_centres SET latitude = 25.2048, longitude = 55.2708  WHERE LOWER(city) = 'dubai'           AND country_code = 'AE';
UPDATE diaspora_registration_centres SET latitude = 25.2854, longitude = 51.531   WHERE LOWER(city) = 'doha'            AND country_code = 'QA';
UPDATE diaspora_registration_centres SET latitude = 24.7136, longitude = 46.6753  WHERE LOWER(city) = 'riyadh'          AND country_code = 'SA';
UPDATE diaspora_registration_centres SET latitude = 39.9334, longitude = 32.8597  WHERE LOWER(city) = 'ankara'          AND country_code = 'TR';

-- Asia
UPDATE diaspora_registration_centres SET latitude = 35.6762, longitude = 139.6503 WHERE LOWER(city) = 'tokyo'           AND country_code = 'JP';
UPDATE diaspora_registration_centres SET latitude = 39.9042, longitude = 116.4074 WHERE LOWER(city) = 'beijing'         AND country_code = 'CN';
UPDATE diaspora_registration_centres SET latitude = 28.5974, longitude = 77.2099  WHERE LOWER(city) = 'new delhi'       AND country_code = 'IN';
UPDATE diaspora_registration_centres SET latitude = 13.7563, longitude = 100.5018 WHERE LOWER(city) = 'bangkok'         AND country_code = 'TH';
UPDATE diaspora_registration_centres SET latitude = 37.5665, longitude = 126.978  WHERE LOWER(city) = 'seoul'           AND country_code = 'KR';

-- Oceania
UPDATE diaspora_registration_centres SET latitude = -35.2809,longitude = 149.13   WHERE LOWER(city) = 'canberra'        AND country_code = 'AU';

-- STEP 2: INSERT missing missions that are not in the current DB
-- (These 26 missions exist in the GeoJSON but not in the current 45 DB rows)

INSERT INTO diaspora_registration_centres (mission_name, mission_type, city, country, country_code, continent, region, latitude, longitude, address, designation_state, designated_2017, designated_2022, designation_count, is_iebc_confirmed_2027)
SELECT * FROM (VALUES
  ('Kenya High Commission Maseru', 'high_commission', 'Maseru', 'Lesotho', 'LS', 'Africa', 'Southern Africa', -29.3151, 27.4869, 'Maseru, Lesotho', 'embassy_only'::diaspora_centre_state, false, false, 0, false),
  ('Kenya High Commission Maputo', 'high_commission', 'Maputo', 'Mozambique', 'MZ', 'Africa', 'Southern Africa', -25.9692, 32.5732, 'Maputo, Mozambique', 'embassy_only'::diaspora_centre_state, false, false, 0, false),
  ('Kenya High Commission Windhoek', 'high_commission', 'Windhoek', 'Namibia', 'NA', 'Africa', 'Southern Africa', -22.5597, 17.0832, 'Windhoek, Namibia', 'embassy_only'::diaspora_centre_state, false, false, 0, false),
  ('Kenya Embassy Tripoli', 'embassy', 'Tripoli', 'Libya', 'LY', 'Africa', 'North Africa', 32.8872, 13.1913, 'Tripoli, Libya', 'embassy_only'::diaspora_centre_state, false, false, 0, false),
  ('Kenya Embassy Tunis', 'embassy', 'Tunis', 'Tunisia', 'TN', 'Africa', 'North Africa', 36.819, 10.1658, 'Tunis, Tunisia', 'embassy_only'::diaspora_centre_state, false, false, 0, false),
  ('Kenya Embassy Rabat', 'embassy', 'Rabat', 'Morocco', 'MA', 'Africa', 'North Africa', 33.9716, -6.8498, 'Rabat, Morocco', 'embassy_only'::diaspora_centre_state, false, false, 0, false),
  ('Kenya Embassy Algiers', 'embassy', 'Algiers', 'Algeria', 'DZ', 'Africa', 'North Africa', 36.7538, 3.0588, 'Algiers, Algeria', 'embassy_only'::diaspora_centre_state, false, false, 0, false),
  ('Kenya Embassy Antananarivo', 'embassy', 'Antananarivo', 'Madagascar', 'MG', 'Africa', 'East Africa', -18.9137, 47.5361, 'Antananarivo, Madagascar', 'embassy_only'::diaspora_centre_state, false, false, 0, false),
  ('Kenya Embassy Djibouti', 'embassy', 'Djibouti', 'Djibouti', 'DJ', 'Africa', 'East Africa', 11.5892, 43.1456, 'Djibouti City, Djibouti', 'embassy_only'::diaspora_centre_state, false, false, 0, false),
  ('Kenya Embassy Asmara', 'embassy', 'Asmara', 'Eritrea', 'ER', 'Africa', 'East Africa', 15.3229, 38.9251, 'Asmara, Eritrea', 'embassy_only'::diaspora_centre_state, false, false, 0, false),
  ('Kenya High Commission Mbabane', 'high_commission', 'Mbabane', 'Eswatini', 'SZ', 'Africa', 'Southern Africa', -26.3186, 31.141, 'Mbabane, Eswatini', 'embassy_only'::diaspora_centre_state, false, false, 0, false),
  ('Kenya Embassy Mexico City', 'embassy', 'Mexico City', 'Mexico', 'MX', 'Americas', 'North America', 19.4326, -99.1332, 'Mexico City, Mexico', 'embassy_only'::diaspora_centre_state, false, false, 0, false),
  ('Kenya Consulate Geneva', 'consulate', 'Geneva', 'Switzerland', 'CH', 'Europe', 'Western Europe', 46.2044, 6.1432, 'Geneva, Switzerland', 'embassy_only'::diaspora_centre_state, false, false, 0, false),
  ('Kenya Embassy Athens', 'embassy', 'Athens', 'Greece', 'GR', 'Europe', 'Southern Europe', 37.9838, 23.7275, 'Athens, Greece', 'embassy_only'::diaspora_centre_state, false, false, 0, false),
  ('Kenya Embassy Warsaw', 'embassy', 'Warsaw', 'Poland', 'PL', 'Europe', 'Eastern Europe', 52.2297, 21.0122, 'Warsaw, Poland', 'embassy_only'::diaspora_centre_state, false, false, 0, false),
  ('Kenya Embassy Kuwait City', 'embassy', 'Kuwait City', 'Kuwait', 'KW', 'MiddleEast', 'Gulf', 29.3759, 47.9774, 'Kuwait City, Kuwait', 'embassy_only'::diaspora_centre_state, false, false, 0, false),
  ('Kenya Embassy Tehran', 'embassy', 'Tehran', 'Iran', 'IR', 'MiddleEast', 'Levant', 35.6892, 51.389, 'Tehran, Iran', 'embassy_only'::diaspora_centre_state, false, false, 0, false),
  ('Kenya Embassy Tel Aviv', 'embassy', 'Tel Aviv', 'Israel', 'IL', 'MiddleEast', 'Levant', 32.0853, 34.7818, 'Tel Aviv, Israel', 'embassy_only'::diaspora_centre_state, false, false, 0, false),
  ('Kenya High Commission Islamabad', 'high_commission', 'Islamabad', 'Pakistan', 'PK', 'Asia', 'South Asia', 33.7294, 73.0931, 'Islamabad, Pakistan', 'embassy_only'::diaspora_centre_state, false, false, 0, false),
  ('Kenya Embassy Kuala Lumpur', 'embassy', 'Kuala Lumpur', 'Malaysia', 'MY', 'Asia', 'Southeast Asia', 3.139, 101.6869, 'Kuala Lumpur, Malaysia', 'embassy_only'::diaspora_centre_state, false, false, 0, false),
  ('Kenya High Commission Wellington', 'high_commission', 'Wellington', 'New Zealand', 'NZ', 'Oceania', 'Oceania', -41.2865, 174.7762, 'Wellington, New Zealand', 'embassy_only'::diaspora_centre_state, false, false, 0, false)
) AS new_missions(mission_name, mission_type, city, country, country_code, continent, region, latitude, longitude, address, designation_state, designated_2017, designated_2022, designation_count, is_iebc_confirmed_2027)
WHERE NOT EXISTS (
  SELECT 1 FROM diaspora_registration_centres drc
  WHERE LOWER(drc.city) = LOWER(new_missions.city) AND drc.country_code = new_missions.country_code
);

-- STEP 3: Verify results
SELECT id, mission_name, city, country_code, latitude, longitude FROM diaspora_registration_centres ORDER BY continent, country;
