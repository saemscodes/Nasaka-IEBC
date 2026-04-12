import pandas as pd
import requests
from dotenv import load_dotenv
import os

load_dotenv()

def get_all_wards():
    all_wards = []
    limit = 1000
    offset = 0
    
    while True:
        url = f"{os.getenv('SUPABASE_URL')}/rest/v1/wards?select=ward_name,constituency,latitude,longitude&limit={limit}&offset={offset}"
        headers = {
            'apikey': os.getenv('SUPABASE_ANON_KEY'),
            'Authorization': f"Bearer {os.getenv('SUPABASE_ANON_KEY')}"
        }
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            data = response.json()
            if not data:
                break
            all_wards.extend(data)
            offset += limit
        else:
            print(f"Error: {response.status_code} - {response.text}")
            break
            
    return all_wards

wards = get_all_wards()
df_wards = pd.DataFrame(wards)
df_wards.to_csv('data/processed/ward_centroids_temp.csv', index=False)
print(f"Loaded {len(df_wards)} wards")
