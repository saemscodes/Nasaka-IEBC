import subprocess

def get_large_objects():
    try:
        # Get list of objects in the unpushed range
        cmd = "git rev-list --objects origin/main..main"
        objects = subprocess.check_output(cmd, shell=True).decode().splitlines()
        
        object_data = []
        for obj in objects:
            sha = obj.split()[0]
            name = obj[len(sha):].strip()
            # Get size
            size_raw = subprocess.check_output(f"git cat-file -s {sha}", shell=True).decode().strip()
            size_mb = int(size_raw) / (1024 * 1024)
            object_data.append((size_mb, sha, name))
        
        object_data.sort(key=lambda x: x[0], reverse=True)
        
        print("Top 10 Largest Objects in Push:")
        for size, sha, name in object_data[:10]:
            print(f"{size:7.2f} MB  {sha[:8]}  {name}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    get_large_objects()
