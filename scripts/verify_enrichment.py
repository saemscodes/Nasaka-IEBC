import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

def verify_enrichment():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    ids = [202852, 202861, 202858, 202860, 202867]
    cur.execute("SELECT id, office_location, landmark FROM public.iebc_offices WHERE id IN (%s, %s, %s, %s, %s)", tuple(ids))
    rows = cur.fetchall()
    print("VERIFICATION OF ORPHAN ENRICHMENT:")
    for row in rows:
        print(f"ID: {row[0]} | Loc: {row[1]} | Mark: {row[2]}")
    conn.close()

if __name__ == "__main__":
    verify_enrichment()
