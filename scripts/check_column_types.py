import psycopg2
from dotenv import load_dotenv

load_dotenv()

password = "1268Saem'sTunes!"
project_id = "ftswzvqwxdwgkvfbwfpx"

configs = [
    {"host": "aws-0-eu-north-1.pooler.supabase.com", "port": 6543, "user": f"postgres.{project_id}", "dbname": "postgres"}
]

for config in configs:
    try:
        conn = psycopg2.connect(
            host=config['host'],
            port=config['port'],
            user=config['user'],
            password=password,
            dbname=config['dbname'],
            sslmode='require'
        )
        cur = conn.cursor()
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'iebc_offices' 
            AND column_name IN ('latitude', 'longitude', 'distance_from_landmark', 'elevation_meters');
        """)
        cols = cur.fetchall()
        for c in cols:
            print(f"Column: {c[0]}, Type: {c[1]}")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")
