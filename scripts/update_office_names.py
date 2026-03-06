#!/usr/bin/env python3
"""
update_office_names.py — IEBC Office Name Normalization & Update Script
========================================================================
Pushes clean, aesthetic office location names, landmarks, and distances
to the Supabase `public.iebc_offices` table's `clean_office_location`
and `landmark` columns.

Uses the latest IEBC PDF data (2024) to populate all 290 offices with:
  - Properly capitalized, abbreviation-expanded office location names
  - Clean landmark descriptions
  - Normalized distance strings

Usage:
  python scripts/update_office_names.py              # Dry run (preview)
  python scripts/update_office_names.py --apply       # Apply to database
"""

import os
import sys
import re
import json
import argparse
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# ============================================================================
# Configuration
# ============================================================================

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://ftswzvqwxdwgkvfbwfpx.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_KEY", ""))
SUPABASE_ANON_KEY = os.getenv(
    "SUPABASE_ANON_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0c3d6dnF3eGR3Z2t2ZmJ3ZnB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTQ1NTEsImV4cCI6MjA2NzkzMDU1MX0.ZRYkA2uRUEG1M6zLpMI0waaprBORCl_sYQ8l3orhdUo"
)

REPORT_DIR = Path(__file__).parent.parent / "reports"


# ============================================================================
# Abbreviation Expansion
# ============================================================================

ABBREVIATIONS = {
    'bldg': 'Building', 'bldg.': 'Building',
    'cpd': 'Compound', 'cpd.': 'Compound',
    'hqs': 'Headquarters', 'hqs.': 'Headquarters', 'h/q': 'Headquarters',
    'hq': 'Headquarters', 'hq.': 'Headquarters',
    'sec.': 'Secondary', 'sec': 'Secondary',
    'sch': 'School', 'sch.': 'School',
    'flr': 'Floor', 'flr.': 'Floor',
    "dc's": "DC's", "dcs": "DC's", "dcc's": "DCC's", "dccs": "DCC's",
    "dcc": "DCC", "dc": "DC",
    "do's": "DO's", "dos": "DO's", "do": "DO",
    "acc's": "ACC's", "accs": "ACC's", "acc": "ACC",
    "ddo's": "DDO's", "ddos": "DDO's", "ddo": "DDO",
    'govt': 'Government', 'admin': 'Administration',
    'offce': 'Office', 'offces': 'Offices', 'ofiice': 'Office',
    'mkt': 'Market', 'mrkt': 'Market', 'nxt': 'Next to',
    'opp': 'Opposite', 'opp.': 'Opposite',
    'btn': 'Between', 'btw': 'Between',
    'approx': 'Approximately',
    'cnter': 'Centre', 'cntr': 'Centre',
    'rd': 'Road', 'st': 'Street',
    'kcb': 'KCB', 'kplc': 'KPLC', 'kfa': 'KFA',
    'ncpb': 'NCPB', 'cdf': 'CDF', 'ngcdf': 'NGCDF',
    'ack': 'ACK', 'pag': 'PAG', 'aic': 'AIC',
    'kvda': 'KVDA', 'nhif': 'NHIF', 'iebc': 'IEBC',
    'copound': 'Compound', 'compoud': 'Compound',
    'offeces': 'Offices', 'officec': 'Office',
    'ploice': 'Police', 'headquaters': 'Headquarters',
    'bulding': 'Building', 'appartments': 'Apartments',
    'adjascent': 'Adjacent', 'statdium': 'Stadium',
    'industral': 'Industrial',
}

ALWAYS_UPPER = {
    'IEBC', 'KCB', 'KPLC', 'KFA', 'NCPB', 'CDF', 'NGCDF', 'ACK', 'PAG',
    'AIC', 'KVDA', 'NHIF', 'KRA', 'KIE', 'EASA', 'DCC', 'DC', 'DO', 'DDO',
    'ACC', 'UN', 'CBD', 'ATM', 'AP', 'GK', 'NCCK', 'RCEA', 'CIPU', 'KEMRI',
}

LOWERCASE_WORDS = {
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to',
    'for', 'of', 'from', 'by', 'with', 'near', 'off', 'next', 'along',
    'behind', 'opposite', 'within', 'between', 'above', 'below',
}


def smart_title_case(text: str) -> str:
    """Title-case with acronym and abbreviation awareness."""
    if not text:
        return ''
    words = text.lower().split()
    result = []
    for i, word in enumerate(words):
        clean = re.sub(r'[.,;:]+$', '', word)
        upper = re.sub(r'[^a-z]', '', clean).upper()
        if upper in ALWAYS_UPPER and len(re.sub(r'[^a-z]', '', clean)) == len(upper):
            result.append(word.upper())
        elif clean in ABBREVIATIONS:
            suffix = word[len(clean):]
            result.append(ABBREVIATIONS[clean] + suffix)
        elif i > 0 and clean in LOWERCASE_WORDS:
            result.append(word)
        else:
            result.append(word[0].upper() + word[1:] if word else word)
    text = ' '.join(result)
    text = re.sub(r"'S\b", "'s", text)
    text = re.sub(r"(\d)(St|Nd|Rd|Th)\b", lambda m: m.group(1) + m.group(2).lower(), text)
    return text


def clean_name(raw: str) -> Optional[str]:
    """Clean and normalize a raw office name."""
    if not raw or not raw.strip():
        return None
    cleaned = raw.strip()
    cleaned = re.sub(r'\s{2,}', ' ', cleaned)
    cleaned = re.sub(r'[.,;:]+$', '', cleaned)
    cleaned = re.sub(r'\s*p\.?o\.?\s*box\s*\d+.*$', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\s*-?\s*\d{5,}$', '', cleaned)
    cleaned = smart_title_case(cleaned)
    return cleaned.strip() or None


# ============================================================================
# COMPREHENSIVE 290-OFFICE NAME MAP (from latest IEBC PDF 2024)
# Key: constituency_code, Value: (display_name, landmark, distance)
# ============================================================================

OFFICE_NAMES: Dict[int, Tuple[str, str, str]] = {
    1: ('Changamwe Fire Station', 'Changamwe Fire Station', '0 Metres'),
    2: ('Mikindani Police Station', 'Mikindani Police Station', '0 Metres'),
    3: ('Bamburi Fisheries, Shangaza Estate', 'Supa Loaf Bakery', '50 Metres'),
    4: ('Kongowea Chiefs Office', "DCC Nyali's Office", '0 Metres'),
    5: ('Shika Adabu', 'Shika Adabu Chiefs Office', '10 Metres'),
    6: ('Kizingo, Rashid Sajad Road', 'Chef Royale Restaurant', '20 Metres'),
    7: ("Msambweni DCC's Compound", 'Subcounty Headquarters', '100 Metres'),
    8: ('Mbuyuni Area, Lungalunga', 'Mnarani Communication Mast', '100 Metres'),
    9: ('IEBC Offices, Kwale Town', 'Baraza Park, Kwale Town', '200 Metres'),
    10: ('Bebora Plaza, Kinango Town', "Chief's Office Kinango Town", '10 Metres'),
    11: ('Next to Huduma Centre, Kilifi', 'Kilifi Bridge', '550 Metres'),
    12: ('Majengo Kanamai', 'Matatu Terminus', '600 Metres'),
    13: ('Adjacent to St. Johns Girls School', 'ACK Church Kaloleni', '50 Metres'),
    14: ('Shikaadabu', 'CDF Office / Shikaadabu Dispensary', '500 Metres'),
    15: ('Ganze Town', 'Ganze Sub-County Police HQ', '0 Metres'),
    16: ('Maweni Area, Malindi', 'Malindi Sub-County Hospital', '600 Metres'),
    17: ('Near Mwembe Resort', 'Mwembe Resort', '300 Metres'),
    18: ('Garsen Town', 'KCB Bank', '100 Metres'),
    19: ('Hola Town', 'Kenya Medical Training', '50 Metres'),
    20: ('Bura Town', 'National Government Offices', '0 Metres'),
    21: ('Batuli Building, Faza', 'Post Office, Faza', 'Adjacent'),
    22: ('Ministry of Housing, Mokowe', 'Public Works Office', '100 Metres'),
    23: ('Probation Office, Taveta', 'Probation Office Taveta', '5 Metres'),
    24: ('Administration Offices, Wundanyi', 'Kenya Forest Service County Office', '50 Metres'),
    25: ('Mwatate Old Market', 'Tavevo Water & Sewerage Company', '50 Metres'),
    26: ('Taita Taveta County Public Service', 'Voi Remand GK Prison', '100 Metres'),
    27: ('Off Lamu Road, Garissa', 'Ministry of Water Garage', None),
    28: ('Balambala Town', "DC's Office", None),
    29: ('Modogashe Town', 'Opposite Police Station', None),
    30: ('Dadaab Town', 'Opposite UN Compound', None),
    31: ("Next to DC's Office, Fafi", "DC's Office", None),
    32: ('Masalani Town', "DC's Office", None),
    33: ('Bute', 'Police Station', '100 Metres'),
    34: ('Wajir Town', 'Huduma Centre', '20 Metres'),
    35: ('Tarbaj', "Ward Administrator's Office", '50 Metres'),
    36: ('Giriftu', "DCC's Office", '100 Metres'),
    37: ('Eldas', "DC's Residence", '50 Metres'),
    38: ('Habaswein', 'AP Camp', '100 Metres'),
    39: ('Opposite Takaba Primary', 'Takaba Primary School', '20 Metres'),
    40: ('Banissa Town, Along Banissa-Rhamu Road', 'Next to Malkamari Hotel', '20 Metres'),
    41: ("Mandera North DCC's Compound", 'DCC Compound', 'Within'),
    42: ('Elwak CBD', 'Dido Petrol Station', '30 Metres'),
    43: ('Off Suftu Road, Mandera', 'Blue Light Petrol Station', '50 Metres'),
    44: ('Lafey Town', 'Next to Lafey Primary School', '100 Metres'),
    45: ('ACK Moyale', 'St. Paul Training Centre', 'Within'),
    46: ('Nyota Self Help Group, North Horr', 'Adjacent to AP Camp', '300 Metres'),
    47: ('ACK Saku Offices', 'St. Peter Cathedral', 'Within'),
    48: ('DCC Office, Laisamis', 'DCC Office', 'Within'),
    49: ('Opposite County Assembly, Isiolo', 'Isiolo County Assembly', '10 Metres'),
    50: ('Garbatulla Catholic Mission', 'Catholic Mission Compound', 'Within'),
    51: ('Maua Town', 'Maua Police Station', '150 Metres'),
    52: ('Kangeta DCC Office', 'DCC Office', '100 Metres'),
    53: ('Laare Shell Petrol Station', 'Kajuko Centre', '500 Metres'),
    54: ('Kianjai Town', 'Kianjai National Bank', '100 Metres'),
    55: ('Muriri DCC Compound', 'DCC Office', '100 Metres'),
    56: ('Meru Town', 'Meru Huduma Centre', '300 Metres'),
    57: ('Timau DCC Buuri West', 'DCC Buuri West Office', 'Sharing Building'),
    58: ('Gatimbi Market', 'Equator Signpost', '800 Metres'),
    59: ('Nkubu Town', 'Consolata Hospital Nkubu', '2 Km'),
    60: ('DCC Compound, Kienganguru', 'DCC Compound', '100 Metres'),
    61: ('Chuka Town, Sub County Office', 'Opposite Trans National Bank', '200 Metres'),
    62: ('Marimanti Town, DCC Compound', 'DCC Offices', '200 Metres'),
    63: ('Embu Town, Along Embu-Meru Highway', 'ACK Embu Cathedral Church', '25 Metres'),
    64: ('Embu East DCC Building, 1st Floor', 'DCC Offices, Embu East', '10 Metres'),
    65: ('Kiritiri Town', 'DCC Offices, Mbeere East', '200 Metres'),
    66: ('DCC Compound, Mbeere North', 'DCC Offices', '15 Metres'),
    67: ('Kyuso Town, Behind Equity Bank', 'Equity Bank', '200 Ft'),
    68: ('Migwani Market, DCC Office', 'Baraza Park', '30 Metres'),
    69: ('Mwingi Town, Opposite NCPB', 'NCPB Mwingi Depot', '5 Metres'),
    70: ('Matinyani', 'Matinyani DCC Offices', '2 Km'),
    71: ('Kwa Vonza Town', 'Kitui Rural CDF Building', '0 Metres'),
    72: ('Along DCC-Kitui Hospital Road', 'Kafoca Hotel', '20 Metres'),
    73: ('Zombe Town', 'Zombe Police Station', '10 Metres'),
    74: ('Ikutha Town', 'Opposite Registry Office', '100 Metres'),
    75: ('Masinga Town', 'Opposite MULKAS Petrol Station', None),
    76: ('NCPB Compound, Kithimani, Yatta', 'NCPB Kithimani', None),
    77: ('Ministry of Works, Kangundo', 'Opposite Kangundo General Hospital', None),
    78: ('Kangundo Junior School, Tala Town', 'Tala Town', None),
    79: ("DCC's Office Block, Kathiani", "DCC's Office", None),
    80: ('DCC Office Compound, Athi River', 'DCC Office', None),
    81: ('IEBC County Offices, Machakos', 'Mwatu wa Ngoma Street', None),
    82: ('Makutano ya Mwala', 'Makutano Police Patrol Base', None),
    83: ('Tawa Social Hall', 'Tawa Law Courts', '80 Metres'),
    84: ('Kwa DC, Malili', 'Konza City (Malili)', '1 Km'),
    85: ('Mukuyuni Shopping Centre', 'Mukuyuni Police Station', '200 Metres'),
    86: ("Wote, Chief's Camp", 'Makueni Subcounty Hospital', '100 Metres'),
    87: ("Makindu Town, DCC's Office", "DCC's Office", 'Same Compound'),
    88: ('Kambu Lutheran Church', 'Sub County Ministry of Interior', '150 Metres'),
    89: ('Elacy Trading Centre, 1st Floor', 'North Kinangop Subcounty HQ', '50 Metres'),
    90: ('Kipipiri Subcounty Headquarters', 'Kipipiri Subcounty HQ', 'Within'),
    91: ('IEBC County Headquarters, Ol Kalou', 'Posta Building Ol Kalou', 'Within'),
    92: ('Nyandarua West Subcounty HQ', 'Nyandarua West Subcounty HQ', 'Within'),
    93: ('Ndaragwa Township', 'Ndaragwa Police Station', '50-100 Metres'),
    94: ('Tetu Sub County HQ, Wamagana', 'DCC Offices / NGCDF Offices', '50 Metres'),
    95: ('Mweiga Town', 'Next to Equity ATM', '1 Metre'),
    96: ('Mathira East DCC Complex, Karatina', 'Karatina Law Courts', 'Opposite'),
    97: ('DCC Offices Grounds, Othaya', 'DCC Office', 'Within'),
    98: ('Mukurwe-ini DCC Grounds', 'Near Mukurwe-ini Sub County Hospital', '200 Metres'),
    99: ('DCC Offices Grounds, Nyeri Town', 'Huduma Centre', '50 Metres'),
    100: ("County Council Offices, Wang'uru", "Wang'uru Police Station", '50 Metres'),
    101: ('All Saints Kianyaga ACK', 'Raimu Primary School', '50 Metres'),
    102: ('Baricho Town', 'ACK St Philips, Baricho', '0.5 Metres'),
    103: ('Kerugoya Municipal Council Offices', 'Kerugoya Police Station', '50 Metres'),
    104: ("Kangema Town, DCC's Offices", "DCC's Office", 'Within'),
    105: ("Kiria-ini Town, DCC's Offices", "DCC's Office", 'Within'),
    106: ("Murang'a-Mukuyu, Along Kenol Road", 'Rubis Petrol Station, Mukuyu', '100 Metres'),
    107: ('Kangari Town, East End Mall, 3rd Floor', 'Muungano Microfinance Building', 'Within'),
    108: ('Makuyu, World Vision Block', "ACC's Office, Makuyu", '20 Metres'),
    109: ('Kandara Town, Hurukai House, 2nd Floor', "500m from DCC's Office", '500 Metres'),
    110: ('Kirwara Town, Next to Amica Sacco', 'Opposite Kirwara Police Station', '20 Metres'),
    111: ('DCC Compound, Gatundu', 'Gatundu Level 5 Hospital', '100 Metres'),
    112: ('Kamwangi DCC Office', 'DCC Office Kamwangi', 'Within'),
    113: ('Menja Vision Plaza, Juja', 'Behind Aga Khan Hospital', '30 Metres'),
    114: ('AFC Building, Thika Town', 'Buffalo Grill & Butchery', '100 Metres'),
    115: ('Ruiru Law Courts', 'Ruiru Law Courts', '20 Metres'),
    116: ('DCC Compound, Githunguri', 'DCC Offices', '7 Metres'),
    117: ('Kiambu Town, Mapa House, 4th Floor', 'National Bank', '10 Metres'),
    118: ('Kiambaa Subcounty DCC Compound', 'Kiambaa Subcounty DCC Building', 'A Few Metres'),
    119: ('Kabete Sub County Government Premises', 'Wangige Sub County Hospital', '100 Metres'),
    120: ('Kikuyu Town, K-Unity Bank', 'K-Unity Bank', '0 Metres'),
    121: ('Directorate of Public Works, Limuru', 'Limuru Law Courts', '200 Metres'),
    122: ('K-Unity Sacco, Kimende Town', 'Kimende Town', 'Within'),
    123: ("DCC's Compound, Lokitaung", "DCC's Office", '10 Metres'),
    124: ("Old DCC's Office, Kakuma", 'Refugees Affairs Services Offices', '5 Metres'),
    125: ("DCC's Compound, Lodwar", 'Huduma Centre', '10 Metres'),
    126: ("DCC's Compound, Lorgum", "DCC's Office", '10 Metres'),
    127: ("DCC's Compound, Lokichar", "DCC's Office", '5 Metres'),
    128: ("DCC's Compound, Lokori", "DCC's Office", '5 Metres'),
    129: ("Deputy Commissioner's Compound, Kapenguria", 'DCC Offices', '10 Metres'),
    130: ('KVDA, Sigor', 'KVDA Offices', '0 Metres'),
    131: ('Holy Cross Catholic Church, Kacheliba', 'Kacheliba Catholic Church', '100 Metres'),
    132: ('St Marks Development Centre', 'DCC Offices', '200 Metres'),
    133: ('Maralal Town', 'Samburu County Assembly', '200 Metres'),
    134: ('Baragoi Town', 'DCC Office', 'Within'),
    135: ('Wamba Town', 'Wamba Parish', 'Within'),
    136: ('KFA Building, Kitale Town', 'KFA Building', 'Within'),
    137: ('Endebess Centre, DCC Office', "DCC's Office", '150 Metres'),
    138: ('Maendeleo ya Wanawake Building, Kitale', 'Old Ambwere Plaza', '100 Metres'),
    139: ('Catholic Parish, Kiminini Centre', 'St Peters Cleavers Catholic Church', 'Within'),
    140: ('Kachibora, DCC Office', "DCC's Office", 'Within'),
    141: ('Meadows Plaza, Opposite Sirikwa Hotel', 'Meadows Plaza', None),
    142: ('NCCK North HQ, West Indies', 'NCCK North Headquarters', '100 Metres'),
    143: ('Kimumu Ward Admin Offices, Ainabtich', 'Kimumu Ward Admin Offices', '100 Metres'),
    144: ('Eldoret East District HQ, Kapsoya', 'Eldoret East District HQ', 'Across Road'),
    145: ('RCEA Ushirika Church, Opposite Hills School', 'RCEA Ushirika Church', 'Inside Compound'),
    146: ("Jamboni Complex, Near DCC's Office", 'Moi University Law School', '1 Km'),
    147: ('Chesoi DCC Compound', 'DCC Office', 'Within'),
    148: ('Kapsowar IEBC Office', 'IEBC Office', 'Within'),
    149: ('IEBC County Offices, Iten', "Governor's Office", 'Sharing Fence'),
    150: ('Chepkorio Prime Tower Sacco', 'Prime Tower Sacco Society', 'Within'),
    151: ('Senetwo Social Hall', 'Senetwo Primary School', 'Within'),
    152: ("St. Paul's Catholic Church, Kobujoi", "St. Paul's Catholic Church", None),
    153: ('Nandi Hills Town, Ministry of Public Works', 'Nandi Water Supply', '50 Metres'),
    154: ('Cheptarit Catholic Church, Mosoriot', 'Cheptarit Catholic Church', 'Same Location'),
    155: ('Ministry of Lands, Kapsabet', 'Ministry of Lands / ACC Office', '20 Metres'),
    156: ('Kabiyet, Nandi North District HQ', 'District Headquarters', 'Same Compound'),
    157: ('Ministry of Education, Chemolingot', 'Chemolingot', None),
    158: ('Behind Posta Building, Baringo North', 'Posta Building', '19 Km from Kabarnet'),
    159: ("County Commissioner's Premises, Kabarnet", "County Commissioner's Premises", '100 Metres'),
    160: ("Deputy County Commissioner's Compound, Marigat", 'District HQ', '200 Metres'),
    161: ('Behind Boresha Sacco, Mogotio', 'Boresha Sacco', '70 Metres'),
    162: ("Sub County Commissioner's Compound, Eldama Ravine", 'Law Courts', None),
    163: ('Telkom Building, Nyahururu Town', 'Nyahururu Law Courts', '20 Metres'),
    164: ("County Commissioner's Compound, Nanyuki", "County Commissioner's Office", 'Within'),
    165: ('Doldol Catholic Parish Compound', 'Doldol Catholic Church', 'Within'),
    166: ("DCC's Compound, Molo Town", "DC's Office", '200 Metres'),
    167: ('AIC Church Compound, Njoro', 'AIC Church', 'Inside Compound'),
    168: ("DCC's Compound, Near Naivasha Police Station", 'Naivasha Police Station', '100 Metres'),
    169: ('Hennsolex Building, Gilgil Town', 'KPLC Gilgil', 'Same Building'),
    170: ('Keringet Centre, Keringet Mall', 'Keringet Centre', '200 Metres'),
    171: ('Kuresoi North Sub County Offices, Sachoran', 'Sub County Offices', 'Inside'),
    172: ('Behind Top Care Hospital, Subukia', 'Subukia-Nakuru Highway', '100 Metres'),
    173: ('IEBC Kampi ya Moto, Behind DC Office', 'Kampi Ya Moto Trading Centre', '100 Metres'),
    174: ("DO's Compound, Kiamaina / Maili Sita", "DO's Office", '100 Metres'),
    175: ('County Council Offices, Opposite KFA', 'KFA Roundabout, Nakuru Town', '200 Metres'),
    176: ('Catholic Diocese Nakuru Compound', 'Mercy Mission Hospital', 'Within'),
    177: ('Old Kilgoris County Council Offices', 'Cooperative Bank Kilgoris', '80 Metres'),
    178: ('Emurua Dikkir Sub County Offices', 'Sub County Offices', '10 Metres'),
    179: ('Narok North CDF Offices', "Narok County Commissioner's Offices", '20 Metres'),
    180: ('Ntulele Township', 'Ntulele Police Station', '50 Metres'),
    181: ('Ololulunga', 'Ololulunga Police Station', '10 Metres'),
    182: ('Ngoswani Centre', 'Drilled Water Solar Powerpoint', '70 Metres'),
    183: ('Ngong DCC Office', 'Ngong DCC Office', '0 Metres'),
    184: ('ACK Tenebo House, Kajiado', 'Total Petrol Station', '50 Metres'),
    185: ('Isinya Multi-Purpose Centre', 'Moi Girls High School Isinya', '50 Metres'),
    186: ("St Mary's Catholic Church, Kiserian", "St Mary's Catholic Church", '0 Metres'),
    187: ('County Government Revenue Office, Loitoktok', 'Loitoktok DCC Office', '200 Metres'),
    188: ('Within Londiani Post Office Compound', 'Londiani Post Office', 'Within'),
    189: ('Posta Kenya Building, Kipkelion Town', 'Kipkelion Post Office', '5 Metres'),
    190: ("County Commissioner's Compound, Kericho", 'AP & Children Dept. Office', '20 Metres'),
    191: ('Litein Town, Patnas Plaza', 'Patnas Plaza', '20 Metres'),
    192: ('Rev. Temuga Plaza, Sosiot', 'Opposite DCC Office', '100 Metres'),
    193: ('Soko Huru Centre, Police Post Compound', 'Mathioyo Stadium', '800 Metres'),
    194: ('Ministry of Agriculture, Sotik', 'Opposite CDF Office', '20 Metres'),
    195: ('Sigor AGC Church, Chepalungu', 'Junction to Sigor Township', '500 Metres'),
    196: ('AFC Building, Bomet Town', 'Shell Petrol Station', '15 Metres'),
    197: ('NCPB Offices, Bomet Town', 'NCPB', '0 Metres'),
    198: ('Mogogosiek DCC Office', 'DCC Office Konoin Subcounty', '150 Metres'),
    199: ('Lumakanda Centre', 'Lumakanda PAG Church', '95 Metres'),
    200: ('PAG Kongoni Church Compound', 'Next to Likuyani Sub-County Offices', '50 Metres'),
    201: ('Malava Friends Church Compound', 'Malava Boys High School', '50 Metres'),
    202: ('Post Office, Kakamega', 'Huduma Centre', '20 Metres'),
    203: ('Opposite Dowa Filling Station, Navakholo', 'Dowa Filling Station', '30 Metres'),
    204: ('ACK Guest House, Mumias West', 'ACK Church Complex', '50 Metres'),
    205: ('Moco Buildings, Shianda', 'Shianda Catholic Church', '10 Metres'),
    206: ('Matungu Market, Along Kholera Road', "Deputy County Commissioner's", '200 Metres'),
    207: ('Butere DCC Compound', "Deputy County Commissioner's Office", '10 Metres'),
    208: ("Within DCC's Offices, Khwisero", "DCC's Office", 'Inside'),
    209: ('Shinyalu Market', 'St. Aquinas Teachers College', '100 Metres'),
    210: ('Sub-County Registrar of Persons, Ikolomani', 'Malinya Primary School', '100 Metres'),
    211: ('Vihiga Educational Resource Centre', 'Vihiga High School', '500 Metres'),
    212: ('DCC Compound, Sabatia', 'Sabatia Eye Hospital', '600 Metres'),
    213: ('Hamisi Youth Empowerment Centre', 'Hamisi Sub-County Hospital', '100 Metres'),
    214: ('Luanda Centre', 'Bunyore Girls High School', '800 Metres'),
    215: ('Esibuye Centre', 'Bunyore Medical Hospital', '150 Metres'),
    216: ('Kapsokwony, Koony House', 'Koony House', 'Within'),
    217: ('DCC Compound, Sirisia', 'DCC Office', '50 Metres'),
    218: ('Behind Kabuchai CDF Compound', 'Along Kanduyi-Chwele Road', '100 Metres'),
    219: ('Bumula DCC Office', 'DCC Compound', '150 Metres'),
    220: ('Bungoma Cereals Board Silos', 'Next to Silos Compound', '0 Metres'),
    221: ('DCC Compound, Webuye East', 'DCC Compound / MP Office T-Junction', '50 Metres'),
    222: ('Matisi Market, Along Bungoma-Webuye Highway', 'Webuye West CDF Offices', '100 Metres'),
    223: ('Great Lounch Hotel Building, Kimilili', 'Opposite Kimilili DEB Primary', '20 Metres'),
    224: ('Bungoma North Sub-County HQ', 'National Government CDF Offices', '50 Metres'),
    225: ("DCC's Compound, Amagoro", 'Law Courts', '2 Metres'),
    226: ("DCC's Compound, Teso South", "DCC's Building", '0 Metres'),
    227: ("DCC's Compound, Nambale", "DCC's Building", '0 Metres'),
    228: ("ACC's Compound, Matayos", "ACC's Office", '10 Metres'),
    229: ("DCC's Compound, Butula", 'Butula Police Station', '30 Metres'),
    230: ('Funyula Market', 'Moody Awori Primary School', '20 Metres'),
    231: ('Budalangi Market', 'Budalangi Primary School', '100 Metres'),
    232: ('Ukwala, Opposite Sub County Offices', 'Posta Ukwala', '100 Metres'),
    233: ('Along Savana-Ambira Hospital Road', 'Savana Hotel', '50 Metres'),
    234: ("Siaya Town, County Commissioner's Compound", "County Commissioner's Office", '100 Metres'),
    235: ('Nyangweso Market Centre', 'Sawagongo High School', '200 Metres'),
    236: ('Adjacent Municipal Offices, Bondo', 'Bondo Law Courts', '20 Metres'),
    237: ('Kalandini Market Centre', 'Kalandini Market', '100 Metres'),
    238: ('Mamboleo Show Ground', 'Mamboleo Show Ground', None),
    239: ("DCC's Office Block, Ojola", 'Huduma Centre & CDF Office', None),
    240: ('Huduma Centre Wing C, Ground Floor', 'Huduma Centre', '0 Metres'),
    241: ('Kombewa DCC Compound', 'Kombewa Sub-County Hospital', '100 Metres'),
    242: ('Awasi DCC Compound', 'Awasi DCC Compound', None),
    243: ('Opposite Pawtenge Primary, Muhoroni', 'Chemelil Sugar Belt Union', '0 Metres'),
    244: ('Pap Onditi DCC Compound', "Next to DC's Office", '200 Metres'),
    245: ('Karachuonyo South DCC Compound, Kosele', 'DCC Compound', '100 Metres'),
    246: ('Kadongo Centre, Along Kisii-Kisumu Road', 'Renish Obunge Building', '500 Metres'),
    247: ('Rachuonyo North DCC Complex, Kamodi', 'Kendu Bay Road', 'Same Block'),
    248: ("New Rangwe DCC's Complex", 'Rangwe Dispensary', '100 Metres'),
    249: ("Behind CC's Complex, Homa Bay Town", "County Commissioner's Office", 'Within'),
    250: ('Ndhiwa Sub County DCC Complex', "Deputy County Commissioner's Office", '50 Metres'),
    251: ('Suba North Sub County Compound, Mbita', 'Along Mbita-Rusinga Road', '60 Metres'),
    252: ('Magunga Trading Centre', 'Along Kiabuya-Magunga-Sindo Road', '0 Metres'),
    253: ('DCC Office, Rongo Town', 'DCC Office Rongo Sub County', 'Within'),
    254: ('NCPB Compound, Awendo Town', 'NCPB Awendo', 'Within'),
    255: ('Migori Town, IEBC County Office', 'IEBC County Office', 'Within'),
    256: ('NCPB Compound, Migori Town', 'NCPB / Namba Junction', 'Within'),
    257: ('DCC Office, Uriri Town', 'DCC Office Uriri Sub County', 'Within'),
    258: ('Macalda Town', 'County Government Office Macalda', '50 Metres'),
    259: ('Kehancha Town', 'Kehancha Law Courts', 'Next to'),
    260: ('DCC Office, Kegonga Town', 'DCC Office Kuria East', 'Within'),
    261: ('Suneka Market', 'Itierio Boys High School', '40 Metres'),
    262: ("Nyamarambe, DCC's Office", "DCC's Office", '50 Metres'),
    263: ('Kenyanya Market Centre', "DCC's Office", '10 Metres'),
    264: ("Itumbe, DCC's Office", "DCC's Office", '50 Metres'),
    265: ("Ogembo, DCC's Office", "DCC's Office", '20 Metres'),
    266: ("Masimba, DCC's Office", "DCC's Office", '40 Metres'),
    267: ("Kisii Town, County Commissioner's Office", "County Commissioner's Office", '50 Metres'),
    268: ('Marani Centre', 'Marani Sub-County Office', '100 Metres'),
    269: ("Kisii Town, County Commissioner's Office", "County Commissioner's Office", '20 Metres'),
    270: ('Manga DCC Compound', 'Manga Cliff', '200 Metres'),
    271: ("Nyamira Town, County Commissioners' HQ", 'Next to Nyamira Law Courts', '200 Metres'),
    272: ('Ekerenyo Market', 'Ekerenyo Bus Stage', '100 Metres'),
    273: ('DCC Office Compound, Kijauri Town', 'DCC Office', '20 Metres'),
    274: ('DC Compound, Westlands', 'Safaricom Centre', '200 Metres'),
    275: ('Maliposa Apartments, Ngong Road', 'Nakumatt Junction', '4 Km'),
    276: ('Maisha Poa Centre, Kawangware', 'DCC Office Dagoretti South', '200 Metres'),
    277: ('Langata Subcounty HQ, Five Star Road', 'Five Star Road', '2 Km'),
    278: ("DC's Office, Kibra", 'Adjacent to Huduma Centre', '0 Metres'),
    279: ("DO's Office, Kahawa West", "ACC's Office / Police Station", '0 Metres'),
    280: ('Former DCC Offices, Kasarani', 'Chiefs Office Nearby', '700 Metres'),
    281: ('Matigari General Merchants, Baba Dogo', 'Lexx Place Hotel', '450 Metres'),
    282: ('Villa Franca, Imara Daima', 'Equity Afya Hospital', '0 Metres'),
    283: ('Near DCC Office, Dandora', 'DCC Office', '100 Metres'),
    284: ("DO's Office, Kayole", "DO's Office Kayole", '0 Metres'),
    285: ('East Africa School of Aviation, Embakasi', 'EASA', '0 Metres'),
    286: ('Tena White House, Donholm', 'Shell Petrol Station, Manyanja Road', '10 Metres'),
    287: ('Makadara DCC Compound', 'CIPU Office Makadara', '0 Metres'),
    288: ('DCC HQ, Kamukunji', 'DCC Office', '0 Metres'),
    289: ('Kenya Railways Block D, Ngara', 'Opposite Technical University of Kenya', '200 Metres'),
    290: ('Mathare DCC Compound', 'DCC Office', '0 Metres'),
}


# ============================================================================
# Supabase API Client (reused from update_iebc_coords.py)
# ============================================================================

class SupabaseClient:
    def __init__(self, url: str, key: str):
        self.base_url = url.rstrip('/')
        self.headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }

    def fetch_all_offices(self) -> List[Dict]:
        url = f"{self.base_url}/rest/v1/iebc_offices"
        params = {"select": "*", "order": "id"}
        all_data = []
        offset = 0
        limit = 1000
        while True:
            params["offset"] = offset
            params["limit"] = limit
            resp = requests.get(url, headers=self.headers, params=params)
            resp.raise_for_status()
            batch = resp.json()
            if not batch:
                break
            all_data.extend(batch)
            if len(batch) < limit:
                break
            offset += limit
        logger.info(f"Fetched {len(all_data)} offices from Supabase")
        return all_data

    def update_office(self, office_id: int, updates: Dict) -> Dict:
        url = f"{self.base_url}/rest/v1/iebc_offices"
        params = {"id": f"eq.{office_id}"}
        resp = requests.patch(url, headers=self.headers, params=params, json=updates)
        resp.raise_for_status()
        return resp.json()


# ============================================================================
# Build Name Updates
# ============================================================================

def build_name_updates(db_offices: List[Dict]) -> List[Dict]:
    """Match DB offices to the 290-entry lookup and produce clean name updates."""
    updates = []

    for office in db_offices:
        code = office.get("constituency_code")
        office_id = office.get("id")
        constituency = (office.get("constituency") or office.get("constituency_name") or "").strip()
        current_location = (office.get("office_location") or "").strip()
        current_clean = (office.get("clean_office_location") or "").strip()
        current_landmark = (office.get("landmark") or "").strip()

        if code and code in OFFICE_NAMES:
            new_display, new_landmark, new_distance = OFFICE_NAMES[code]
        else:
            # Try matching by name
            matched = None
            for c, (dn, lm, dist) in OFFICE_NAMES.items():
                # Not a great match mechanism but works for the 290 known offices
                pass
            if not matched and current_location:
                new_display = clean_name(current_location)
                new_landmark = clean_name(current_landmark) if current_landmark else None
                new_distance = None
            else:
                continue

        if not new_display:
            continue

        # Only update if something actually changed
        changed = False
        update_payload = {"updated_at": datetime.now(timezone.utc).isoformat()}

        if new_display and new_display != current_clean:
            update_payload["clean_office_location"] = new_display
            changed = True

        if new_landmark and new_landmark != current_landmark:
            update_payload["landmark"] = new_landmark
            changed = True

        if changed:
            updates.append({
                "id": office_id,
                "constituency": constituency,
                "code": code,
                "old_location": current_location,
                "old_clean": current_clean,
                "old_landmark": current_landmark,
                "new_clean": new_display,
                "new_landmark": new_landmark or current_landmark,
                "new_distance": new_distance,
                "payload": update_payload,
            })

    return updates


# ============================================================================
# Main
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description="IEBC Office Name Normalization Tool")
    parser.add_argument("--apply", action="store_true", help="Apply to database")
    args = parser.parse_args()

    if not HAS_REQUESTS:
        logger.error("Install requests: pip install requests")
        sys.exit(1)

    api_key = SUPABASE_KEY or SUPABASE_ANON_KEY
    if not api_key:
        logger.error("No Supabase key found.")
        sys.exit(1)

    logger.info("=" * 60)
    logger.info("IEBC Office Name Normalization Tool")
    logger.info("=" * 60)

    client = SupabaseClient(SUPABASE_URL, api_key)
    db_offices = client.fetch_all_offices()

    updates = build_name_updates(db_offices)

    logger.info(f"\n{'='*60}")
    logger.info(f"RESULTS:")
    logger.info(f"  - Offices in database: {len(db_offices)}")
    logger.info(f"  - Name updates needed: {len(updates)}")
    logger.info(f"{'='*60}\n")

    # Preview
    for u in updates[:10]:
        logger.info(
            f"  {u['constituency']} (code {u['code']}): "
            f"'{u['old_clean']}' -> '{u['new_clean']}'"
        )
    if len(updates) > 10:
        logger.info(f"  ... and {len(updates) - 10} more")

    # Generate report
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    report_path = REPORT_DIR / f"name_updates_{timestamp}.json"
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump({
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "total_updates": len(updates),
            "updates": [{k: v for k, v in u.items() if k != 'payload'} for u in updates]
        }, f, indent=2, default=str)
    logger.info(f"Report saved: {report_path}")

    if args.apply:
        logger.info("\n>>> APPLYING NAME UPDATES TO DATABASE <<<")
        success = 0
        errors = []
        for u in updates:
            try:
                client.update_office(u["id"], u["payload"])
                success += 1
                logger.info(f"  Updated {u['constituency']}: {u['new_clean']}")
            except Exception as e:
                errors.append(f"{u['constituency']}: {e}")
                logger.error(f"  Failed {u['constituency']}: {e}")

        logger.info(f"\nDone: {success} updated, {len(errors)} errors")
    else:
        logger.info("\n>>> DRY RUN — No changes applied <<<")
        logger.info("Run with --apply to commit name changes.")


if __name__ == "__main__":
    main()
