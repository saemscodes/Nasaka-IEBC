import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
conn = psycopg2.connect(os.environ['SUPABASE_DB_POOLED_URL'])
cur = conn.cursor()
cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'wards';")
for row in cur.fetchall():
    print(row)
