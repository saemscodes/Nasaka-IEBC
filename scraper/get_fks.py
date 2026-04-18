import os, psycopg2; from dotenv import load_dotenv
load_dotenv()
db_url = os.environ.get('SUPABASE_DB_POOLED_URL')
conn = psycopg2.connect(db_url)
cur = conn.cursor()
cur.execute("""
    SELECT r.relname, a.attname
    FROM pg_constraint c
    JOIN pg_class r ON c.conrelid = r.oid
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.contype = 'f' AND c.confrelid = 'public.iebc_offices'::regclass;
""")
for r in cur.fetchall(): print(f"{r[0]}.{r[1]}")
conn.close()
