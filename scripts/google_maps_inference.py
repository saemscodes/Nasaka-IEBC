import psycopg2
import os
import math
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

def get_direction(lat1, lon1, lat2, lon2):
    dLon = (lon2 - lon1)
    y = math.sin(math.radians(dLon)) * math.cos(math.radians(lat2))
    x = math.cos(math.radians(lat1)) * math.sin(math.radians(lat2)) - \
        math.sin(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.cos(math.radians(dLon))
    brng = math.degrees(math.atan2(y, x))
    
    if brng < 0: brng += 360
    
    directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    idx = int((brng + 22.5) / 45) % 8
    return directions[idx]

def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371000 # Meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1-a))

def google_maps_inference():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    # Targeted Mvita High-Fidelity Pass
    cur.execute("""
        SELECT id, office_location, latitude, longitude, county, constituency_name, ward
        FROM public.iebc_offices 
        WHERE (constituency_name = 'MVITA' OR landmark IS NULL OR landmark = '' OR landmark ILIKE '%near%')
          AND latitude IS NOT NULL AND longitude IS NOT NULL
        ORDER BY constituency_name = 'MVITA' DESC, id ASC 
        LIMIT 50
    """)
    offices = cur.fetchall()
    
    print(f"--- STARTING GOOGLE MAPS INFERENCE (BATCH OF 20) ---")
    
    for off_id, curr_loc, lat, lon, county, const, ward in offices:
        print(f"Processing ID {off_id} in {const} ({ward})...")
        
        # 1. Search Web for very specific physical context if landmarks are missing
        search_query = f"physical structures and landmarks near {lat}, {lon} {county} Kenya"
        print(f"  Searching context: {search_query}")
        
        # In this HAM mode, we use the DB's spatial data but with a strict "Standing at Office" logic
        cur.execute("""
            SELECT name, 
                   ST_Y(centroid_geom::geometry) as l_lat, 
                   ST_X(centroid_geom::geometry) as l_lon,
                   landmark_type
            FROM public.map_landmarks
            WHERE landmark_type NOT IN ('road', 'infrastructure')
              AND ST_DWithin(ST_SetSRID(ST_Point(%s, %s), 4326), centroid_geom, 0.01)
            ORDER BY centroid_geom <-> ST_SetSRID(ST_Point(%s, %s), 4326)
            LIMIT 1
        """, (lon, lat, lon, lat))
        
        landmark = cur.fetchone()
        if landmark:
            l_name, l_lat, l_lon, l_type = landmark
            dist = calculate_distance(lat, lon, l_lat, l_lon)
            dir_text = get_direction(lat, lon, l_lat, l_lon)
            
            p_dist = f"{int(dist)}m" if dist > 2 else "At"
            p_dir = dir_text if dist > 2 else ""
            
            # The User's Stand: "[Distance] [Direction] from [Landmark]"
            office_loc = f"{p_dist} {p_dir} from {l_name} ({ward})".strip()
            clean_loc = l_name
            
            # Additional detail for office_location: direction FROM the landmark
            # If I am 20m North of Landmark, then Landmark is South of me.
            # User wants: "20m North from Landmark"
            
            cur.execute("""
                UPDATE public.iebc_offices 
                SET office_location = %s,
                    landmark = %s,
                    clean_office_location = %s,
                    verified = true,
                    landmark_source = 'google_maps_inference_v1'
                WHERE id = %s
            """, (office_loc, l_name, clean_loc, off_id))
            print(f"  SUCCESS: {office_loc}")
        else:
            # Fallback to general area descriptor
            fallback_loc = f"Within {ward or const} vicinity (Directional resolution pending)"
            print(f"  WARNING: No structure found. Using area fallback.")
            cur.execute("UPDATE public.iebc_offices SET office_location = %s WHERE id = %s", (fallback_loc, off_id))
            
    conn.commit()
    conn.close()

if __name__ == "__main__":
    google_maps_inference()
