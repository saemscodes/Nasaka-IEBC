import json

with open('data/moe_schools.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
    if isinstance(data, list) and len(data) > 0:
        print(f"Data type: list of {len(data)} items")
        print(f"First item keys: {list(data[0].keys())}")
        print(f"First item: {data[0]}")
    elif isinstance(data, dict):
        print(f"Data type: dict with keys: {list(data.keys())}")
    else:
        print("Data is empty or not a list/dict")
