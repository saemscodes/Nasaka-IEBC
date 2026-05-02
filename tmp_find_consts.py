import psycopg2

def find_constituencies():
    PASSWORD = "1268Saem'sTunes!"
    PROJECT_ID = "ftswzvqwxdwgkvfbwfpx"
    BACKUP_TABLE = "public.iebc_offices_backup_20260425"
    LEGACY_BACKUP = "public.iebc_offices_legacy_backup"

    try:
        conn = psycopg2.connect(
            host="aws-0-eu-north-1.pooler.supabase.com", port=6543, user=f"postgres.{PROJECT_ID}",
            password=PASSWORD, dbname="postgres", sslmode='require'
        )
        cur = conn.cursor()
        
        # Try to find the 290 from the April 25 backup
        print("Analyzing April 25 Backup...")
        cur.execute(f"SELECT county, constituency_name, office_type, category, count(*) FROM {BACKUP_TABLE} GROUP BY 1,2,3,4")
        rows = cur.fetchall()
        print(f"Total row groups in backup: {len(rows)}")
        
        # How many distinct (county, constituency_name) are there?
        cur.execute(f"SELECT count(DISTINCT (county, constituency_name)) FROM {BACKUP_TABLE}")
        count_dist = cur.fetchone()[0]
        print(f"Distinct (County, Constituency) in backup: {count_dist}")
        
        # Sample of those where office_type is not REGISTRATION_CENTRE
        cur.execute(f"SELECT DISTINCT county, constituency_name, office_type FROM {BACKUP_TABLE} WHERE office_type != 'REGISTRATION_CENTRE' OR office_type IS NULL LIMIT 10")
        print("\nNon-RC types or NULL types:")
        for r in cur.fetchall(): print(r)

        # Check Legacy Backup
        print("\nAnalyzing Legacy Backup...")
        cur.execute(f"SELECT count(DISTINCT (county, constituency_name)) FROM {LEGACY_BACKUP}")
        count_legacy = cur.fetchone()[0]
        print(f"Distinct (County, Constituency) in legacy backup: {count_legacy}")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    find_constituencies()
