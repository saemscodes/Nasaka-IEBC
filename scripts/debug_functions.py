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
            SELECT proname, proargnames, proargtypes
            FROM pg_proc
            WHERE proname IN ('get_offices_in_bounds', 'get_iebc_offices_in_viewport', 'get_search_suggestions');
        """)
        funcs = cur.fetchall()
        for f in funcs:
            print(f"Function: {f[0]}, Args: {f[1]}, Types: {f[2]}")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")
