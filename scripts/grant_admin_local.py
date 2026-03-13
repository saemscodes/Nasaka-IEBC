
import requests
import json
import os

SUPABASE_URL = "https://ftswzvqwxdwgkvfbwfpx.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0c3d6dnF3eGR3Z2t2ZmJ3ZnB4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjM1NDU1MSwiZXhwIjoyMDY3OTMwNTUxfQ.939Uqckn6DsQ7J3-Ts9WiqOXFfiGF9uqmJT7kpgNbvE"

emails_to_invite = [
    "saemscodes@gmail.com",
    "admin@civiceducationkenya.com"
]

email_to_elevate = "civiceducationkenya@gmail.com"

headers = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json"
}

def get_user_id(email):
    url = f"{SUPABASE_URL}/auth/v1/admin/users"
    res = requests.get(url, headers=headers)
    if res.status_code == 200:
        for u in res.json().get('users', []):
            if u.get('email') == email:
                return u.get('id')
    return None

def invite_user(email):
    url = f"{SUPABASE_URL}/auth/v1/invite"
    data = {"email": email}
    res = requests.post(url, headers=headers, json=data)
    if res.status_code in [200, 201]:
        uid = res.json().get('id')
        print(f"Successfully invited {email} (UID: {uid})")
        return uid
    else:
        print(f"Failed to invite {email}: {res.status_code} - {res.text}")
        return None

def grant_admin(user_id, email, role="admin"):
    url = f"{SUPABASE_URL}/rest/v1/core_team"
    data = {
        "user_id": user_id,
        "is_admin": True,
        "is_active": True,
        "role": role,
        "added_at": "now()"
    }
    upsert_headers = {**headers, "Prefer": "resolution=merge-duplicates"}
    res = requests.post(url, headers=upsert_headers, json=data)
    if res.status_code in [200, 201, 204]:
        print(f"Successfully provisioned core_team for {email}")
    else:
        print(f"Failed to provision core_team for {email}: {res.status_code} - {res.text}")

print("--- Admin Access Overdrive ---")

# 1. Elevate existing user
print(f"Checking {email_to_elevate} for elevation...")
uid = get_user_id(email_to_elevate)
if uid:
    grant_admin(uid, email_to_elevate, role="superadmin")
else:
    print(f"User {email_to_elevate} not found. Inviting instead...")
    uid = invite_user(email_to_elevate)
    if uid: grant_admin(uid, email_to_elevate, role="superadmin")

# 2. Invite others
for email in emails_to_invite:
    print(f"Processing {email}...")
    uid = get_user_id(email)
    if not uid:
        uid = invite_user(email)
    
    if uid:
        grant_admin(uid, email)

# 3. List all entries in core_team
print("\n--- Final core_team Table Contents ---")
res = requests.get(f"{SUPABASE_URL}/rest/v1/core_team", headers=headers)
if res.status_code == 200:
    for row in res.json():
        print(f"UID: {row['user_id']} | Admin: {row['is_admin']} | Role: {row['role']}")
