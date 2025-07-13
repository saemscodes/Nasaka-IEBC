
-- First, let's properly structure the counties and constituencies tables
-- Update counties table structure
ALTER TABLE public.counties 
ADD COLUMN IF NOT EXISTS lat DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS lng DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS total_voters INTEGER DEFAULT 0;

-- Update constituencies table structure  
ALTER TABLE public.constituencies
ADD COLUMN IF NOT EXISTS lat DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS lng DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS total_voters INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS county TEXT,
ADD COLUMN IF NOT EXISTS wards TEXT[];

-- Create comprehensive constituencies data
INSERT INTO public.constituencies (name, county, lat, lng, total_voters, wards) VALUES
('Changamwe', 'MOMBASA', -4.0435, 39.6682, 93561, ARRAY['port reitz', 'kipevu', 'airport', 'changamwe', 'chaani']),
('Jomvu', 'MOMBASA', -4.0435, 39.6682, 75085, ARRAY['jomvu kuu', 'miritini', 'mikindani']),
('Kisauni', 'MOMBASA', -4.0435, 39.6682, 135276, ARRAY['mjambere', 'junda', 'bamburi', 'mwakirunge', 'mtopanga', 'magogoni', 'shanzu']),
('Nyali', 'MOMBASA', -4.0435, 39.6682, 124253, ARRAY['frere town', 'ziwa la ng''ombe', 'mkomani', 'kongowea', 'kadzandani']),
('Likoni', 'MOMBASA', -4.0435, 39.6682, 94764, ARRAY['mtongwe', 'shika adabu', 'bofu', 'likoni', 'timbwani']),
('Mvita', 'MOMBASA', -4.0435, 39.6682, 118974, ARRAY['mji wa kale/makadara', 'tudor', 'tononoka', 'shimanzi/ganjoni', 'majengo']),
('Msambweni', 'KWALE', -4.1816, 39.4606, 82261, ARRAY['gombatobongwe', 'ukunda', 'kinondo', 'ramisi']),
('Lunga Lunga', 'KWALE', -4.1816, 39.4606, 64854, ARRAY['pongwekikoneni', 'dzombo', 'mwereni', 'vanga']),
('Matuga', 'KWALE', -4.1816, 39.4606, 83015, ARRAY['tsimba golini', 'waa', 'tiwi', 'kubo south', 'mkongani']),
('Kinango', 'KWALE', -4.1816, 39.4606, 98123, ARRAY['nadavaya', 'puma', 'kinango', 'mackinnon-road', 'chengoni/samburu', 'mwavumbo', 'kasemeni']),
('Kilifi North', 'KILIFI', -3.5107, 39.9093, 116742, ARRAY['tezo', 'sokoni', 'kibarani', 'dabaso', 'matsangoni', 'watamu', 'mnarani']),
('Kilifi South', 'KILIFI', -3.5107, 39.9093, 97696, ARRAY['junju', 'mwarakaya', 'shimo la tewa', 'chasimba', 'mtepeni']),
('Kaloleni', 'KILIFI', -3.5107, 39.9093, 73009, ARRAY['mariakani', 'kayafungo', 'kaloleni', 'mwanamwinga']),
('Rabai', 'KILIFI', -3.5107, 39.9093, 59165, ARRAY['mwawesa', 'ruruma', 'kambe/ribe', 'rabai/kisurutini']),
('Ganze', 'KILIFI', -3.5107, 39.9093, 67257, ARRAY['ganze', 'bamba', 'jaribuni', 'sokoke']),
('Malindi', 'KILIFI', -3.5107, 39.9093, 94605, ARRAY['jilore', 'kakuyuni', 'ganda', 'malindi town', 'shella']),
('Magarini', 'KILIFI', -3.5107, 39.9093, 80128, ARRAY['marafa', 'magarini', 'gongoni', 'adu', 'garashi', 'sabaki'])
ON CONFLICT (name) DO UPDATE SET
county = EXCLUDED.county,
lat = EXCLUDED.lat,
lng = EXCLUDED.lng,
total_voters = EXCLUDED.total_voters,
wards = EXCLUDED.wards;

-- Update counties with comprehensive data
INSERT INTO public.counties (name, lat, lng, total_voters) VALUES
('MOMBASA', -4.0435, 39.6682, 641613),
('KWALE', -4.1816, 39.4606, 328253),
('KILIFI', -3.5107, 39.9093, 588602),
('TANA RIVER', -1.6519, 39.6516, 141096),
('LAMU', -2.2696, 40.9006, 81453),
('TAITA TAVETA', -3.3163, 38.4842, 181827),
('GARISSA', -0.4532, 39.6461, 171473),
('WAJIR', 1.7488, 40.0586, 207758),
('MANDERA', 3.5738, 40.9587, 217030),
('MARSABIT', 2.3346, 37.9902, 166912),
('ISIOLO', 0.3557, 37.5833, 89504),
('MERU', 0.0515, 37.6459, 702513),
('THARAKA-NITHI', -0.2965, 37.8688, 231932),
('EMBU', -0.5397, 37.4574, 335302),
('KITUI', -1.3969, 38.0109, 494758),
('MACHAKOS', -1.5177, 37.2634, 667565),
('MAKUENI', -2.2558, 37.8931, 520221),
('NYANDARUA', -0.5326, 36.5716, 361165),
('NYERI', -0.4201, 36.9476, 481554),
('KIRINYAGA', -0.6590, 37.3827, 376001),
('MURANG''A', -0.7833, 37.0333, 620920),
('KIAMBU', -1.0314, 36.8685, 1242201),
('TURKANA', 3.3122, 35.5658, 237528),
('WEST POKOT', 1.6219, 35.3905, 270026),
('SAMBURU', 1.2157, 36.9541, 100014),
('TRANS NZOIA', 1.0566, 34.9594, 398981),
('UASIN GISHU', 0.5204, 35.2699, 506136),
('ELGEYO/MARAKWET', 0.8246, 35.4786, 213884),
('NANDI', 0.1833, 35.1333, 406288),
('BARINGO', 0.6986, 35.8603, 281053),
('LAIKIPIA', 0.2046, 36.7819, 263012),
('NAKURU', -0.3031, 36.0800, 951965),
('NAROK', -1.0806, 35.8711, 428584),
('KAJIADO', -2.0981, 36.7819, 659273),
('KERICHO', -0.3667, 35.2833, 427447),
('BOMET', -0.8016, 35.3350, 376985),
('KAKAMEGA', 0.2833, 34.7500, 1041232),
('VIHIGA', 0.0833, 34.7167, 309853),
('BUNGOMA', 0.5667, 34.5500, 667558),
('BUSIA', 0.4608, 34.1115, 416756),
('SIAYA', 0.0627, 34.2877, 533395),
('KISUMU', -0.1022, 34.7617, 615774),
('HOMA BAY', -0.5300, 34.4500, 556031),
('MIGORI', -1.0634, 34.4731, 428089),
('KISII', -0.6773, 34.7796, 600177),
('NYAMIRA', -0.5667, 34.9333, 323281),
('NAIROBI', -1.2864, 36.8172, 2257849)
ON CONFLICT (name) DO UPDATE SET
lat = EXCLUDED.lat,
lng = EXCLUDED.lng,
total_voters = EXCLUDED.total_voters;

-- Update wards table to include county and constituency references
ALTER TABLE public.wards 
ADD COLUMN IF NOT EXISTS lat DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS lng DECIMAL(11, 8);

-- Create a function to get county statistics
CREATE OR REPLACE FUNCTION get_county_statistics()
RETURNS TABLE (
  county_name TEXT,
  constituencies_count BIGINT,
  total_voters BIGINT,
  wards_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.name as county_name,
    COUNT(DISTINCT const.id) as constituencies_count,
    COALESCE(SUM(const.total_voters), 0) as total_voters,
    COUNT(DISTINCT w.id) as wards_count
  FROM counties c
  LEFT JOIN constituencies const ON const.county = c.name
  LEFT JOIN wards w ON w.county = c.name
  GROUP BY c.name, c.total_voters
  ORDER BY total_voters DESC;
END;
$$ LANGUAGE plpgsql;
