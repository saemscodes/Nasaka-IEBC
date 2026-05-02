import psycopg2

def identify_missing():
    PASSWORD = "1268Saem'sTunes!"
    PROJECT_ID = "ftswzvqwxdwgkvfbwfpx"
    BACKUP_TABLE = "public.iebc_offices_backup_20260425"
    TARGET_TABLE = "public.iebc_offices"

    try:
        conn = psycopg2.connect(
            host="aws-0-eu-north-1.pooler.supabase.com",
            port=6543,
            user=f"postgres.{PROJECT_ID}",
            password=PASSWORD,
            dbname="postgres",
            sslmode='require'
        )
        cur = conn.cursor()
        
        # 1. Get all constituencies from backup
        cur.execute(f"SELECT DISTINCT UPPER(county), UPPER(constituency_name) FROM {BACKUP_TABLE}")
        backup_consts = set(cur.fetchall())
        print(f"Total constituencies in backup: {len(backup_consts)}")
        
        # 2. Get currently ingested constituencies
        cur.execute(f"SELECT DISTINCT UPPER(county), UPPER(constituency_name) FROM {TARGET_TABLE}")
        current_consts = set(cur.fetchall())
        print(f"Total constituencies currently in target: {len(current_consts)}")
        
        # 3. Identify missing
        missing = backup_consts - current_consts
        print(f"\nMissing constituencies ({len(missing)}):")
        for county, const in sorted(list(missing)):
            print(f"- {county}: {const}")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    identify_missing()
