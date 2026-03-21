-- fix_narok_south_coordinates.sql
-- Correcting Narok South (Ololulunga) location which was erroneously set in Tanzania
-- Correct Coordinates: -1.003036, 35.6640447

UPDATE public.iebc_offices
SET 
    latitude = -1.003036,
    longitude = 35.6640447,
    notes = 'Relocated from Tanzania to correct Kenyan position in Ololulunga Town (Verification Mar 2026)'
WHERE constituency = 'NAROK SOUTH' AND county = 'NAROK';

-- Verify the update
SELECT id, county, constituency, office_location, latitude, longitude
FROM public.iebc_offices
WHERE constituency = 'NAROK SOUTH' AND county = 'NAROK';
