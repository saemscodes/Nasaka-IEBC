import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
conn = psycopg2.connect(os.environ['SUPABASE_DB_POOLED_URL'])
cur = conn.cursor()
cur.execute("SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%ward%';")
tables = cur.fetchall()
print("Tables:", tables)

for (t,) in tables:
    cur.execute(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{t}';")
    print(f"--- {t} columns ---")
    for row in cur.fetchall():
        print(row)
