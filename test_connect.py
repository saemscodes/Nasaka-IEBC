import os, sys
import psycopg2

# Choose one of the URLs below. Replace YOUR-PASSWORD with the real password.
# Direct (persistent, IPv6 OK)
# DATABASE_URL = "postgresql://postgres:YOUR-PASSWORD@db.ftswzvqwxdwgkvfbwfpx.supabase.co:5432/postgres?sslmode=require"

# Transaction pooler (IPv4-friendly, port may be 6543)
# DATABASE_URL = "postgresql://postgres:YOUR-PASSWORD@aws-0-eu-north-1.pooler.supabase.com:6543/postgres?sslmode=require"

# Session pooler (IPv4, shared pool)
# DATABASE_URL = "postgresql://postgres:YOUR-PASSWORD@aws-0-eu-north-1.pooler.supabase.com:5432/postgres?sslmode=require"

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("Set DATABASE_URL env var and re-run.")
    sys.exit(2)

try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute("SELECT now(), current_database(), current_user;")
    print("CONNECTED ✓ ->", cur.fetchone())
    cur.close()
    conn.close()
except Exception as e:
    print("CONNECT ERROR →", str(e))
    raise
