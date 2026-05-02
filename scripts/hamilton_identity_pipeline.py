import os
import psycopg2
from psycopg2.extras import execute_values
import math
from dotenv import load_dotenv

load_dotenv()

DB_URL = os.getenv("SUPABASE_DB_POOLED_URL")

# USER'S STRICT PREPOSITIONS
def get_preposition(dist_m):
    if dist_m < 5: return "at"
    if dist_m < 50: return "opposite"
    if dist_m < 150: return "next to"
    if dist_m < 400: return "near"
    return "near"

def get_bearing(lat1, lon1, lat2, lon2):
    dLon = math.radians(lon2 - lon1)
    y = math.sin(dLon) * math.cos(math.radians(lat2))
    x = math.cos(math.radians(lat1)) * math.sin(math.radians(lat2)) - \
        math.sin(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.cos(dLon)
    bearing = math.degrees(math.atan2(y, x))
    return (bearing + 360) % 360

def get_cardinal(bearing):
    dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    idx = round(bearing / 45) % 8
    return dirs[idx]

def run_ham_pipeline():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    
    print("--- PHASE 1: PREFIX STRIPPING (CLEAN FOUNDATIONS) ---")
    cur.execute("""
        UPDATE public.iebc_offices
        SET clean_office_location = TRIM(
          REGEXP_REPLACE(
            office_location,
            '^(near|next to|opposite|along|at|behind|above|below|across from|off|past)\\\\s+',
            '',
            'i'
          )
        )
        WHERE (clean_office_location IS NULL OR clean_office_location = '')
          AND office_location IS NOT NULL;
    """)
    print(f"  Stripped prefixes for {cur.rowcount} records.")

    print("\n--- PHASE 2: SPATIAL LANDMARK INFERENCE (STRICT MODE) ---")
    # OVERWRITE ALL: No 'landmark IS NULL' check.
    # We process in batches of 1000
    cur.execute("""
        SELECT id, clean_office_location, latitude, longitude, county, ward, constituency_name
        FROM public.iebc_offices 
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        ORDER BY constituency_name = 'MVITA' DESC, id ASC
        LIMIT 1000
    """)
    offices = cur.fetchall()
    
    if not offices:
        print("  Finished processing all geocoded records.")
        return

    for off_id, facility, lat, lon, county, ward, const in offices:
        # STRICT CATEGORIES only
        # Education, Government, Health, Religious, Market, Transport, Commercial
        cur.execute("""
            SELECT name, 
                   ST_Y(centroid_geom::geometry) as l_lat, 
                   ST_X(centroid_geom::geometry) as l_lon,
                   landmark_type,
                   ST_Distance(ST_SetSRID(ST_Point(%s, %s), 4326)::geography, centroid_geom::geography) as dist
            FROM public.map_landmarks
            WHERE landmark_type IN (
                'school', 'hospital', 'place_of_worship', 'market', 
                'government', 'police', 'bus_station', 'fuel',
                'bank', 'pharmacy', 'post_office'
            )
              AND ST_DWithin(ST_SetSRID(ST_Point(%s, %s), 4326)::geography, centroid_geom::geography, 1500)
            ORDER BY centroid_geom <-> ST_SetSRID(ST_Point(%s, %s), 4326)
            LIMIT 1
        """, (lon, lat, lon, lat, lon, lat))
        
        results = cur.fetchall()
        if results:
            l_name, l_lat, l_lon, l_type, dist = results[0]
            
            prep = get_preposition(dist)
            cardinal = get_cardinal(get_bearing(lat, lon, l_lat, l_lon))
            
            # Format: {facility_name}, {spatial_preposition} {landmark_name}
            if dist > 200:
                new_office_loc = f"{facility}, {int(dist)}m {cardinal} of {l_name}"
            else:
                new_office_loc = f"{facility}, {prep} {l_name}"
            
            cur.execute("""
                UPDATE public.iebc_offices 
                SET office_location = %s,
                    landmark = %s,
                    direction_landmark = %s,
                    direction_type = %s,
                    distance_from_landmark = %s,
                    landmark_source = 'hamilton_v1',
                    landmark_type = %s,
                    verified = true
                WHERE id = %s
            """, (new_office_loc, l_name, l_name, cardinal, dist, l_type, off_id))
            print(f"  ID {off_id}: {new_office_loc}")
        else:
            # Fallback: use WARD/CONSTITUENCY
            l_name = f"{ward} Area" if ward else f"{const} Region"
            new_office_loc = f"{facility}, within {l_name}"
            cur.execute("""
                UPDATE public.iebc_offices 
                SET office_location = %s,
                    landmark = %s,
                    landmark_source = 'hamilton_v1_fallback'
                WHERE id = %s
            """, (new_office_loc, l_name, off_id))
            print(f"  ID {off_id} (FALLBACK): {new_office_loc}")

    conn.commit()
    conn.close()
    print("\n--- HAMILTON PIPELINE TURN COMPLETE ---")

if __name__ == "__main__":
    run_ham_pipeline()
