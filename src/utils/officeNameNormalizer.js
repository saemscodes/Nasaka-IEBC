// src/utils/officeNameNormalizer.js
// ============================================================================
// SMART OFFICE NAME NORMALIZER
// ============================================================================
// Cleans up raw IEBC office location names from PDF data into
// human-friendly, aesthetically pleasing display names.
//
// Handles: abbreviations, ALL-CAPS, title-casing, redundant text removal,
// and smart display name composition from office_location + landmark data.
// ============================================================================

// ─── Abbreviation Expansion Map ──────────────────────────────────────────────
const ABBREVIATION_MAP = {
    // Buildings & structures
    'bldg': 'Building', 'bldg.': 'Building', 'bldgs': 'Buildings',
    'cpd': 'Compound', 'cpd.': 'Compound',
    'hqs': 'Headquarters', 'hqs.': 'Headquarters', 'h/q': 'Headquarters',
    'hq': 'Headquarters', 'hq.': 'Headquarters',
    'sec.': 'Secondary', 'sec': 'Secondary',
    'sch': 'School', 'sch.': 'School',
    'flr': 'Floor', 'flr.': 'Floor',
    'rm': 'Room', 'rm.': 'Room',

    // Government
    "dc's": "DC's", "dcs": "DC's", "dcc's": "DCC's", "dccs": "DCC's",
    "dcc": "DCC", "dc": "DC",
    "do's": "DO's", "dos": "DO's", "do": "DO",
    "acc's": "ACC's", "accs": "ACC's", "acc": "ACC",
    "ddo's": "DDO's", "ddos": "DDO's", "ddo": "DDO",
    'govt': 'Government', 'govt.': 'Government',
    'admin': 'Administration', 'admin.': 'Administration',
    'offce': 'Office', 'offces': 'Offices',
    'ofiice': 'Office',

    // Locations & organizations
    'mkt': 'Market', 'mkt.': 'Market', 'mrkt': 'Market',
    'nxt': 'Next to', 'adj': 'Adjacent to',
    'opp': 'Opposite', 'opp.': 'Opposite',
    'btn': 'Between', 'btw': 'Between',
    'approx': 'Approximately', 'approx.': 'Approximately',
    'cnter': 'Centre', 'cntr': 'Centre',
    'comm': "Commissioner's", 'commisioner': 'Commissioner',
    'commisioner\'s': "Commissioner's", 'commissoner': 'Commissioner',
    'commisioners': 'Commissioners',
    'rd': 'Road', 'rd.': 'Road',
    'st': 'Street', 'st.': 'Street',

    // Kenyan organizations
    'kcb': 'KCB', 'kplc': 'KPLC', 'kfa': 'KFA',
    'ncpb': 'NCPB', 'cdf': 'CDF', 'ngcdf': 'NGCDF',
    'ack': 'ACK', 'pag': 'PAG', 'aic': 'AIC',
    'kvda': 'KVDA', 'nhif': 'NHIF', 'iebc': 'IEBC',
    'dcc': 'DCC', 'un': 'UN', 'kra': 'KRA',
    'sacco': 'Sacco', 'saccos': 'Saccos',
    'nbi': 'Nairobi', 'msa': 'Mombasa',
    'kie': 'KIE', 'easa': 'EASA',

    // Directions & prepositions
    'nr': 'Near', 'nr.': 'Near',
    'btwn': 'Between',
    'apprx': 'Approximately',

    // Common misspellings from PDF
    'copound': 'Compound', 'compoud': 'Compound',
    'offeces': 'Offices', 'officec': 'Office',
    'ploice': 'Police', 'headquaters': 'Headquarters',
    'headquartes': 'Headquarters', 'adminitration': 'Administration',
    'commisioners': "Commissioner's", 'bulding': 'Building',
    'appartments': 'Apartments', 'adjuscent': 'Adjacent',
    'adjudcent': 'Adjacent', 'adjascent': 'Adjacent',
    'statdium': 'Stadium', 'industral': 'Industrial',
    'dispensa': 'Dispensary',
};

// Words to ALWAYS uppercase (after title-casing)
const ALWAYS_UPPERCASE = new Set([
    'IEBC', 'KCB', 'KPLC', 'KFA', 'NCPB', 'CDF', 'NGCDF', 'ACK', 'PAG',
    'AIC', 'KVDA', 'NHIF', 'KRA', 'KIE', 'EASA', 'DCC', 'DC', 'DO', 'DDO',
    'ACC', 'UN', 'CBD', 'ATM', 'AP', 'GK', 'NCCK', 'RCEA', 'II', 'III', 'IV',
    'HQ', 'PO', 'MCA', 'CIT', 'CIPU', 'KEMRI', 'KERRA',
]);

// Words to keep lowercase (prepositions/articles in title case)
const LOWERCASE_WORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to',
    'for', 'of', 'from', 'by', 'with', 'near', 'off', 'next', 'along',
    'behind', 'opposite', 'within', 'between', 'above', 'below',
]);

// Redundant prefixes/suffixes to strip from display names
const REDUNDANT_PATTERNS = [
    /^iebc\s+(office|offices|building|block)\s*/i,
    /\s*p\.?o\.?\s*box\s*\d+.*$/i,
    /\s*-?\s*\d{5,}$/,
    /\s+constituency\s+office$/i,
    /\s+constituency$/i,
];

// ─── Smart Title Case ────────────────────────────────────────────────────────
function smartTitleCase(str) {
    if (!str) return '';

    // First lowercase everything
    const words = str.toLowerCase().split(/\s+/);

    return words.map((word, idx) => {
        // Check uppercase acronyms
        const upper = word.toUpperCase().replace(/[^A-Z]/g, '');
        if (ALWAYS_UPPERCASE.has(upper) && word.replace(/[^a-z]/g, '').length === upper.length) {
            // Preserve punctuation around the acronym
            return word.replace(/[a-z]+/i, upper);
        }

        // Check abbreviation expansion
        const cleanWord = word.replace(/[.,;:]+$/, '');
        if (ABBREVIATION_MAP[cleanWord]) {
            const suffix = word.slice(cleanWord.length);
            return ABBREVIATION_MAP[cleanWord] + suffix;
        }
        if (ABBREVIATION_MAP[word]) {
            return ABBREVIATION_MAP[word];
        }

        // Lowercase words (not first word)
        if (idx > 0 && LOWERCASE_WORDS.has(cleanWord)) {
            return word;
        }

        // Title case: capitalize first letter
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
}

// ─── Clean Display Name ──────────────────────────────────────────────────────
function cleanDisplayName(raw) {
    if (!raw) return null;

    let cleaned = raw.trim();

    // Normalize multiple spaces
    cleaned = cleaned.replace(/\s{2,}/g, ' ');

    // Remove trailing dots/commas
    cleaned = cleaned.replace(/[.,;:]+$/, '');

    // Apply redundant pattern stripping
    for (const pattern of REDUNDANT_PATTERNS) {
        cleaned = cleaned.replace(pattern, '');
    }

    // Smart title case
    cleaned = smartTitleCase(cleaned);

    // Fix possessives (e.g., "Dc'S" -> "DC's")
    cleaned = cleaned.replace(/'S\b/g, "'s");
    cleaned = cleaned.replace(/'s\b/g, "'s");

    // Fix "1St", "2Nd", "3Rd", "4Th" -> "1st", "2nd", "3rd", "4th"
    cleaned = cleaned.replace(/(\d)(St|Nd|Rd|Th)\b/gi, (_, d, suffix) => d + suffix.toLowerCase());

    // Fix parenthetical formatting
    cleaned = cleaned.replace(/\(\s+/g, '(');
    cleaned = cleaned.replace(/\s+\)/g, ')');

    return cleaned.trim() || null;
}

// ─── Compose Smart Office Display Name ───────────────────────────────────────
// Combines office_location + landmark into a clean, aesthetic display name.
// Priority: clean_office_location > IEBC_OFFICE_NAMES lookup > normalized office_location
export function getOfficeDisplayName(office) {
    if (!office) return 'IEBC Office';

    const constituencyName = (office.constituency_name || office.constituency || '').trim();

    // 1. If clean_office_location exists and is good, use it
    if (office.clean_office_location && office.clean_office_location.trim()) {
        const clean = cleanDisplayName(office.clean_office_location);
        if (clean && clean.toLowerCase() !== constituencyName.toLowerCase()) {
            return clean;
        }
    }

    // 2. Check the static IEBC_OFFICE_NAMES lookup
    const code = office.constituency_code;
    const lookup = code ? IEBC_OFFICE_NAMES[code] : null;
    if (lookup) {
        return lookup.displayName;
    }

    // 3. Normalize the raw office_location
    if (office.office_location && office.office_location.trim()) {
        const cleaned = cleanDisplayName(office.office_location);
        if (cleaned && cleaned.toLowerCase() !== constituencyName.toLowerCase()) {
            return cleaned;
        }
    }

    // 4. Fallback to constituency name
    return constituencyName || 'IEBC Office';
}

// Get a clean landmark description
export function getOfficeLandmark(office) {
    if (!office) return null;

    // Check static lookup first
    const code = office.constituency_code;
    const lookup = code ? IEBC_OFFICE_NAMES[code] : null;
    if (lookup?.landmark) {
        return cleanDisplayName(lookup.landmark);
    }

    if (office.landmark && office.landmark.trim()) {
        return cleanDisplayName(office.landmark);
    }

    return null;
}

// Get a clean distance-from-landmark string
export function getOfficeLandmarkDistance(office) {
    const code = office?.constituency_code;
    const lookup = code ? IEBC_OFFICE_NAMES[code] : null;
    if (lookup?.distance) {
        // Normalize "100metres" -> "100 Metres", "0 Km" -> "On-site"
        let d = lookup.distance.trim();
        if (/^0\s*(m|km|metres?|meters?)$/i.test(d) || d === '0' || d === '-' || /^same/i.test(d) || /^within/i.test(d) || /^inside/i.test(d)) {
            return 'On-site';
        }
        // Add space between number and unit
        d = d.replace(/(\d)(m|km|metre|meter)/gi, '$1 $2');
        return smartTitleCase(d);
    }
    return null;
}

// ─── COMPREHENSIVE IEBC OFFICE NAMES ─────────────────────────────────────────
// From the latest IEBC PDF "Physical Locations of IEBC Constituency Offices"
// Each entry: { displayName, landmark, distance }
const IEBC_OFFICE_NAMES = {
    // ─── MOMBASA ─────────────────────────────────────────────────────────────
    1: { displayName: 'Changamwe Fire Station', landmark: 'Changamwe Fire Station', distance: '0 Metres' },
    2: { displayName: 'Mikindani Police Station', landmark: 'Mikindani Police Station', distance: '0 Metres' },
    3: { displayName: 'Bamburi Fisheries, Shangaza Estate', landmark: 'Supa Loaf Bakery', distance: '50 Metres' },
    4: { displayName: 'Kongowea Chiefs Office', landmark: "DCC Nyali's Office", distance: '0 Metres' },
    5: { displayName: 'Shika Adabu', landmark: 'Shika Adabu Chiefs Office', distance: '10 Metres' },
    6: { displayName: 'Kizingo, Rashid Sajad Road', landmark: 'Chef Royale Restaurant', distance: '20 Metres' },

    // ─── KWALE ───────────────────────────────────────────────────────────────
    7: { displayName: "Msambweni DCC's Compound", landmark: 'Subcounty Headquarters', distance: '100 Metres' },
    8: { displayName: 'Mbuyuni Area, Lungalunga', landmark: 'Mnarani Communication Mast', distance: '100 Metres' },
    9: { displayName: 'IEBC Offices, Kwale Town', landmark: 'Baraza Park, Kwale Town', distance: '200 Metres' },
    10: { displayName: 'Bebora Plaza, Kinango Town', landmark: "Chief's Office Kinango Town", distance: '10 Metres' },

    // ─── KILIFI ──────────────────────────────────────────────────────────────
    11: { displayName: 'Next to Huduma Centre, Kilifi', landmark: 'Kilifi Bridge', distance: '550 Metres' },
    12: { displayName: 'Majengo Kanamai', landmark: 'Matatu Terminus', distance: '600 Metres' },
    13: { displayName: 'Adjacent to St. Johns Girls School', landmark: 'ACK Church Kaloleni', distance: '50 Metres' },
    14: { displayName: 'Shikaadabu', landmark: 'CDF Office / Shikaadabu Dispensary', distance: '500 Metres' },
    15: { displayName: 'Ganze Town', landmark: 'Ganze Sub-County Police HQ', distance: '0 Metres' },
    16: { displayName: 'Maweni Area, Malindi', landmark: 'Malindi Sub-County Hospital', distance: '600 Metres' },
    17: { displayName: 'Near Mwembe Resort', landmark: 'Mwembe Resort', distance: '300 Metres' },

    // ─── TANA RIVER ──────────────────────────────────────────────────────────
    18: { displayName: 'Garsen Town', landmark: 'KCB Bank', distance: '100 Metres' },
    19: { displayName: 'Hola Town', landmark: 'Kenya Medical Training', distance: '50 Metres' },
    20: { displayName: 'Bura Town', landmark: 'National Government Offices', distance: '0 Metres' },

    // ─── LAMU ────────────────────────────────────────────────────────────────
    21: { displayName: 'Batuli Building, Faza', landmark: 'Post Office, Faza', distance: 'Adjacent' },
    22: { displayName: 'Ministry of Housing, Mokowe', landmark: 'Public Works Office', distance: '100 Metres' },

    // ─── TAITA TAVETA ────────────────────────────────────────────────────────
    23: { displayName: 'Probation Office, Taveta', landmark: 'Probation Office Taveta', distance: '5 Metres' },
    24: { displayName: 'Administration Offices, Wundanyi', landmark: 'Kenya Forest Service County Office', distance: '50 Metres' },
    25: { displayName: 'Mwatate Old Market', landmark: 'Tavevo Water & Sewerage Company', distance: '50 Metres' },
    26: { displayName: 'Taita Taveta County Public Service', landmark: 'Voi Remand GK Prison', distance: '100 Metres' },

    // ─── GARISSA ─────────────────────────────────────────────────────────────
    27: { displayName: 'Off Lamu Road, Garissa', landmark: 'Ministry of Water Garage', distance: null },
    28: { displayName: 'Balambala Town', landmark: "DC's Office", distance: null },
    29: { displayName: 'Modogashe Town', landmark: 'Opposite Police Station', distance: null },
    30: { displayName: 'Dadaab Town', landmark: 'Opposite UN Compound', distance: null },
    31: { displayName: "Next to DC's Office, Fafi", landmark: "DC's Office", distance: null },
    32: { displayName: "Masalani Town", landmark: "DC's Office", distance: null },

    // ─── WAJIR ───────────────────────────────────────────────────────────────
    33: { displayName: 'Bute', landmark: 'Police Station', distance: '100 Metres' },
    34: { displayName: 'Wajir Town', landmark: 'Huduma Centre', distance: '20 Metres' },
    35: { displayName: 'Tarbaj', landmark: "Ward Administrator's Office", distance: '50 Metres' },
    36: { displayName: 'Giriftu', landmark: "DCC's Office", distance: '100 Metres' },
    37: { displayName: 'Eldas', landmark: "DC's Residence", distance: '50 Metres' },
    38: { displayName: 'Habaswein', landmark: 'AP Camp', distance: '100 Metres' },

    // ─── MANDERA ─────────────────────────────────────────────────────────────
    39: { displayName: 'Opposite Takaba Primary', landmark: 'Takaba Primary School', distance: '20 Metres' },
    40: { displayName: 'Banissa Town, Along Banissa-Rhamu Road', landmark: 'Next to Malkamari Hotel', distance: '20 Metres' },
    41: { displayName: "Mandera North DCC's Compound", landmark: "DCC Compound", distance: 'Within' },
    42: { displayName: 'Elwak CBD', landmark: 'Dido Petrol Station', distance: '30 Metres' },
    43: { displayName: 'Off Suftu Road, Mandera', landmark: 'Blue Light Petrol Station', distance: '50 Metres' },
    44: { displayName: 'Lafey Town', landmark: 'Next to Lafey Primary School', distance: '100 Metres' },

    // ─── MARSABIT ────────────────────────────────────────────────────────────
    45: { displayName: 'ACK Moyale', landmark: 'St. Paul Training Centre', distance: 'Within' },
    46: { displayName: 'Nyota Self Help Group, North Horr', landmark: 'Adjacent to AP Camp', distance: '300 Metres' },
    47: { displayName: 'ACK Saku Offices', landmark: 'St. Peter Cathedral', distance: 'Within' },
    48: { displayName: 'DCC Office, Laisamis', landmark: 'DCC Office', distance: 'Within' },

    // ─── ISIOLO ──────────────────────────────────────────────────────────────
    49: { displayName: 'Opposite County Assembly, Isiolo', landmark: 'Isiolo County Assembly', distance: '10 Metres' },
    50: { displayName: 'Garbatulla Catholic Mission', landmark: 'Catholic Mission Compound', distance: 'Within' },

    // ─── MERU ────────────────────────────────────────────────────────────────
    51: { displayName: 'Maua Town', landmark: 'Maua Police Station', distance: '150 Metres' },
    52: { displayName: 'Kangeta DCC Office', landmark: 'DCC Office', distance: '100 Metres' },
    53: { displayName: 'Laare Shell Petrol Station', landmark: 'Kajuko Centre', distance: '500 Metres' },
    54: { displayName: 'Kianjai Town', landmark: 'Kianjai National Bank', distance: '100 Metres' },
    55: { displayName: 'Muriri DCC Compound', landmark: 'DCC Office', distance: '100 Metres' },
    56: { displayName: 'Meru Town', landmark: 'Meru Huduma Centre', distance: '300 Metres' },
    57: { displayName: 'Timau DCC Buuri West', landmark: 'DCC Buuri West Office', distance: 'Sharing Building' },
    58: { displayName: 'Gatimbi Market', landmark: 'Equator Signpost', distance: '800 Metres' },
    59: { displayName: 'Nkubu Town', landmark: 'Consolata Hospital Nkubu', distance: '2 Km' },

    // ─── THARAKA-NITHI ───────────────────────────────────────────────────────
    60: { displayName: 'DCC Compound, Kienganguru', landmark: 'DCC Compound', distance: '100 Metres' },
    61: { displayName: 'Chuka Town, Sub County Office', landmark: 'Opposite Trans National Bank', distance: '200 Metres' },
    62: { displayName: 'Marimanti Town, DCC Compound', landmark: 'DCC Offices', distance: '200 Metres' },

    // ─── EMBU ────────────────────────────────────────────────────────────────
    63: { displayName: 'Embu Town, Along Embu-Meru Highway', landmark: 'ACK Embu Cathedral Church', distance: '25 Metres' },
    64: { displayName: 'Embu East DCC Building, 1st Floor', landmark: 'DCC Offices, Embu East', distance: '10 Metres' },
    65: { displayName: 'Kiritiri Town', landmark: 'DCC Offices, Mbeere East', distance: '200 Metres' },
    66: { displayName: 'DCC Compound, Mbeere North', landmark: 'DCC Offices', distance: '15 Metres' },

    // ─── KITUI ───────────────────────────────────────────────────────────────
    67: { displayName: 'Kyuso Town, Behind Equity Bank', landmark: 'Equity Bank', distance: '200 Ft' },
    68: { displayName: 'Migwani Market, DCC Office', landmark: 'Baraza Park', distance: '30 Metres' },
    69: { displayName: 'Mwingi Town, Opposite NCPB', landmark: 'NCPB Mwingi Depot', distance: '5 Metres' },
    70: { displayName: 'Matinyani', landmark: 'Matinyani DCC Offices', distance: '2 Km' },
    71: { displayName: 'Kwa Vonza Town', landmark: 'Kitui Rural CDF Building', distance: '0 Metres' },
    72: { displayName: 'Along DCC-Kitui Hospital Road', landmark: 'Kafoca Hotel', distance: '20 Metres' },
    73: { displayName: 'Zombe Town', landmark: 'Zombe Police Station', distance: '10 Metres' },
    74: { displayName: 'Ikutha Town', landmark: 'Opposite Registry Office', distance: '100 Metres' },

    // ─── MACHAKOS ────────────────────────────────────────────────────────────
    75: { displayName: 'Masinga Town', landmark: 'Opposite MULKAS Petrol Station', distance: null },
    76: { displayName: 'NCPB Compound, Kithimani, Yatta', landmark: 'NCPB Kithimani', distance: null },
    77: { displayName: 'Ministry of Works, Kangundo', landmark: 'Opposite Kangundo General Hospital', distance: null },
    78: { displayName: 'Kangundo Junior School, Tala Town', landmark: 'Tala Town', distance: null },
    79: { displayName: "DCC's Office Block, Kathiani", landmark: "DCC's Office", distance: null },
    80: { displayName: 'DCC Office Compound, Athi River', landmark: 'DCC Office', distance: null },
    81: { displayName: 'IEBC County Offices, Machakos', landmark: 'Mwatu wa Ngoma Street', distance: null },
    82: { displayName: 'Makutano ya Mwala', landmark: 'Makutano Police Patrol Base', distance: null },

    // ─── MAKUENI ─────────────────────────────────────────────────────────────
    83: { displayName: 'Tawa Social Hall', landmark: 'Tawa Law Courts', distance: '80 Metres' },
    84: { displayName: 'Kwa DC, Malili', landmark: 'Konza City (Malili)', distance: '1 Km' },
    85: { displayName: 'Mukuyuni Shopping Centre', landmark: 'Mukuyuni Police Station', distance: '200 Metres' },
    86: { displayName: "Wote, Chief's Camp", landmark: 'Makueni Subcounty Hospital', distance: '100 Metres' },
    87: { displayName: "Makindu Town, DCC's Office", landmark: "DCC's Office", distance: 'Same Compound' },
    88: { displayName: 'Kambu Lutheran Church', landmark: 'Sub County Ministry of Interior Office', distance: '150 Metres' },

    // ─── NYANDARUA ───────────────────────────────────────────────────────────
    89: { displayName: 'Elacy Trading Centre, 1st Floor', landmark: 'North Kinangop Subcounty HQ', distance: '50 Metres' },
    90: { displayName: 'Kipipiri Subcounty Headquarters', landmark: 'Kipipiri Subcounty HQ', distance: 'Within' },
    91: { displayName: 'IEBC County Headquarters, Ol Kalou', landmark: 'Posta Building Ol Kalou', distance: 'Within' },
    92: { displayName: 'Nyandarua West Subcounty HQ', landmark: 'Nyandarua West Subcounty HQ', distance: 'Within' },
    93: { displayName: 'Ndaragwa Township', landmark: 'Ndaragwa Police Station', distance: '50-100 Metres' },

    // ─── NYERI ───────────────────────────────────────────────────────────────
    94: { displayName: 'Tetu Sub County HQ, Wamagana', landmark: 'DCC Offices / NGCDF Offices', distance: '50 Metres' },
    95: { displayName: 'Mweiga Town', landmark: 'Next to Equity ATM', distance: '1 Metre' },
    96: { displayName: 'Mathira East DCC Complex, Karatina', landmark: 'Karatina Law Courts', distance: 'Opposite' },
    97: { displayName: 'DCC Offices Grounds, Othaya', landmark: 'DCC Office', distance: 'Within' },
    98: { displayName: 'Mukurwe-ini DCC Grounds', landmark: 'Near Mukurwe-ini Sub County Hospital', distance: '200 Metres' },
    99: { displayName: 'DCC Offices Grounds, Nyeri Town', landmark: 'Huduma Centre', distance: '50 Metres' },

    // ─── KIRINYAGA ───────────────────────────────────────────────────────────
    100: { displayName: "County Council Offices, Wang'uru", landmark: "Wang'uru Police Station", distance: '50 Metres' },
    101: { displayName: 'All Saints Kianyaga ACK', landmark: 'Raimu Primary School', distance: '50 Metres' },
    102: { displayName: 'Baricho Town', landmark: 'ACK St Philips, Baricho', distance: '0.5 Metres' },
    103: { displayName: 'Kerugoya Municipal Council Offices', landmark: 'Kerugoya Police Station', distance: '50 Metres' },

    // ─── MURANG'A ────────────────────────────────────────────────────────────
    104: { displayName: "Kangema Town, DCC's Offices", landmark: "DCC's Office", distance: 'Within' },
    105: { displayName: "Kiria-ini Town, DCC's Offices", landmark: "DCC's Office", distance: 'Within' },
    106: { displayName: 'Murang\'a-Mukuyu, Along Kenol Road', landmark: 'Rubis Petrol Station, Mukuyu', distance: '100 Metres' },
    107: { displayName: 'Kangari Town, East End Mall, 3rd Floor', landmark: 'Muungano Microfinance Building', distance: 'Within' },
    108: { displayName: "Makuyu, World Vision Block", landmark: "ACC's Office, Makuyu", distance: '20 Metres' },
    109: { displayName: 'Kandara Town, Hurukai House, 2nd Floor', landmark: "Above Amica Sacco, 500m from DCC's Office", distance: '500 Metres' },
    110: { displayName: 'Kirwara Town, Next to Amica Sacco', landmark: 'Opposite Kirwara Police Station', distance: '20 Metres' },

    // ─── KIAMBU ──────────────────────────────────────────────────────────────
    111: { displayName: 'DCC Compound, Gatundu', landmark: 'Gatundu Level 5 Hospital', distance: '100 Metres' },
    112: { displayName: 'Kamwangi DCC Office', landmark: 'DCC Office Kamwangi', distance: 'Within' },
    113: { displayName: 'Menja Vision Plaza, Juja', landmark: 'Behind Aga Khan Hospital', distance: '30 Metres' },
    114: { displayName: 'AFC Building, Thika Town', landmark: 'Buffalo Grill & Butchery', distance: '100 Metres' },
    115: { displayName: 'Ruiru Law Courts', landmark: 'Ruiru Law Courts', distance: '20 Metres' },
    116: { displayName: 'DCC Compound, Githunguri', landmark: 'DCC Offices', distance: '7 Metres' },
    117: { displayName: 'Kiambu Town, Mapa House, 4th Floor', landmark: 'National Bank', distance: '10 Metres' },
    118: { displayName: 'Kiambaa Subcounty DCC Compound', landmark: 'Kiambaa Subcounty DCC Building', distance: 'A Few Metres' },
    119: { displayName: "Kabete Sub County Government Premises", landmark: "Wangige Sub County Hospital", distance: '100 Metres' },
    120: { displayName: 'Kikuyu Town, K-Unity Bank', landmark: 'K-Unity Bank', distance: '0 Metres' },
    121: { displayName: 'Directorate of Public Works, Limuru', landmark: 'Limuru Law Courts', distance: '200 Metres' },
    122: { displayName: 'K-Unity Sacco, Kimende Town', landmark: 'Kimende Town', distance: 'Within' },

    // ─── TURKANA ─────────────────────────────────────────────────────────────
    123: { displayName: "DCC's Compound, Lokitaung", landmark: "DCC's Office", distance: '10 Metres' },
    124: { displayName: "Old DCC's Office, Kakuma", landmark: 'Refugees Affairs Services Offices', distance: '5 Metres' },
    125: { displayName: "DCC's Compound, Lodwar", landmark: 'Huduma Centre', distance: '10 Metres' },
    126: { displayName: "DCC's Compound, Lorgum", landmark: "DCC's Office", distance: '10 Metres' },
    127: { displayName: "DCC's Compound, Lokichar", landmark: "DCC's Office", distance: '5 Metres' },
    128: { displayName: "DCC's Compound, Lokori", landmark: "DCC's Office", distance: '5 Metres' },

    // ─── WEST POKOT ──────────────────────────────────────────────────────────
    129: { displayName: "Deputy Commissioner's Compound, Kapenguria", landmark: 'DCC Offices', distance: '10 Metres' },
    130: { displayName: 'KVDA, Sigor', landmark: 'KVDA Offices', distance: '0 Metres' },
    131: { displayName: 'Holy Cross Catholic Church, Kacheliba', landmark: 'Kacheliba Catholic Church', distance: '100 Metres' },
    132: { displayName: 'St Marks Development Centre', landmark: 'DCC Offices', distance: '200 Metres' },

    // ─── SAMBURU ─────────────────────────────────────────────────────────────
    133: { displayName: 'Maralal Town', landmark: 'Samburu County Assembly', distance: '200 Metres' },
    134: { displayName: 'Baragoi Town', landmark: 'DCC Office', distance: 'Within' },
    135: { displayName: 'Wamba Town', landmark: 'Wamba Parish', distance: 'Within' },

    // ─── TRANS NZOIA ─────────────────────────────────────────────────────────
    136: { displayName: 'KFA Building, Kitale Town', landmark: 'KFA Building', distance: 'Within' },
    137: { displayName: 'Endebess Centre, DCC Office', landmark: "DCC's Office", distance: '150 Metres' },
    138: { displayName: 'Maendeleo ya Wanawake Building, Kitale', landmark: 'Old Ambwere Plaza', distance: '100 Metres' },
    139: { displayName: 'Catholic Parish, Kiminini Centre', landmark: 'St Peters Cleavers Catholic Church', distance: 'Within' },
    140: { displayName: 'Kachibora, DCC Office', landmark: "DCC's Office", distance: 'Within' },

    // ─── UASIN GISHU ────────────────────────────────────────────────────────
    141: { displayName: 'Meadows Plaza, Opposite Sirikwa Hotel', landmark: 'Meadows Plaza', distance: null },
    142: { displayName: 'NCCK North HQ, West Indies', landmark: 'NCCK North Headquarters', distance: '100 Metres' },
    143: { displayName: 'Kimumu Ward Admin Offices, Ainabtich', landmark: 'Kimumu Ward Admin Offices', distance: '100 Metres' },
    144: { displayName: 'Eldoret East District HQ, Kapsoya', landmark: 'Eldoret East District HQ', distance: 'Across Road' },
    145: { displayName: 'RCEA Ushirika Church, Opposite Hills School', landmark: 'RCEA Ushirika Church', distance: 'Inside Compound' },
    146: { displayName: "Jamboni Complex, Near DCC's Office", landmark: 'Moi University Law School', distance: '1 Km' },

    // ─── ELGEYO-MARAKWET ─────────────────────────────────────────────────────
    147: { displayName: 'Chesoi DCC Compound', landmark: 'DCC Office', distance: 'Within' },
    148: { displayName: 'Kapsowar IEBC Office', landmark: 'IEBC Office', distance: 'Within' },
    149: { displayName: 'IEBC County Offices, Iten', landmark: "Governor's Office", distance: 'Sharing Fence' },
    150: { displayName: 'Chepkorio Prime Tower Sacco', landmark: 'Prime Tower Sacco Society', distance: 'Within' },

    // ─── NANDI ───────────────────────────────────────────────────────────────
    151: { displayName: 'Senetwo Social Hall', landmark: 'Senetwo Primary School', distance: 'Within' },
    152: { displayName: "St. Paul's Catholic Church, Kobujoi", landmark: "St. Paul's Catholic Church", distance: null },
    153: { displayName: 'Nandi Hills Town, Ministry of Public Works', landmark: 'Nandi Water Supply', distance: '50 Metres' },
    154: { displayName: 'Cheptarit Catholic Church, Mosoriot', landmark: 'Cheptarit Catholic Church', distance: 'Same Location' },
    155: { displayName: 'Ministry of Lands, Kapsabet', landmark: 'Ministry of Lands / ACC Office', distance: '20 Metres' },
    156: { displayName: 'Kabiyet, Nandi North District HQ', landmark: 'District Headquarters', distance: 'Same Compound' },

    // ─── BARINGO ─────────────────────────────────────────────────────────────
    157: { displayName: 'Ministry of Education, Chemolingot', landmark: 'Chemolingot', distance: null },
    158: { displayName: 'Behind Posta Building, Baringo North', landmark: 'Posta Building', distance: '19 Km from Kabarnet' },
    159: { displayName: "County Commissioner's Premises, Kabarnet", landmark: "County Commissioner's Premises", distance: '100 Metres' },
    160: { displayName: "Deputy County Commissioner's Compound, Marigat", landmark: 'District HQ', distance: '200 Metres' },
    161: { displayName: 'Behind Boresha Sacco, Mogotio', landmark: 'Boresha Sacco', distance: '70 Metres' },
    162: { displayName: "Sub County Commissioner's Compound, Eldama Ravine", landmark: 'Law Courts', distance: null },

    // ─── LAIKIPIA ────────────────────────────────────────────────────────────
    163: { displayName: 'Telkom Building, Nyahururu Town', landmark: 'Nyahururu Law Courts', distance: '20 Metres' },
    164: { displayName: "County Commissioner's Compound, Nanyuki", landmark: "County Commissioner's Office", distance: 'Within' },
    165: { displayName: 'Doldol Catholic Parish Compound', landmark: 'Doldol Catholic Church', distance: 'Within' },

    // ─── NAKURU ──────────────────────────────────────────────────────────────
    166: { displayName: "DCC's Compound, Molo Town", landmark: "DC's Office", distance: '200 Metres' },
    167: { displayName: 'AIC Church Compound, Njoro', landmark: 'AIC Church', distance: 'Inside Compound' },
    168: { displayName: "DCC's Compound, Near Naivasha Police Station", landmark: 'Naivasha Police Station', distance: '100 Metres' },
    169: { displayName: 'Hennsolex Building, Gilgil Town', landmark: 'KPLC Gilgil', distance: 'Same Building' },
    170: { displayName: 'Keringet Centre, Keringet Mall', landmark: 'Keringet Centre', distance: '200 Metres' },
    171: { displayName: 'Kuresoi North Sub County Offices, Sachoran', landmark: 'Sub County Offices', distance: 'Inside' },
    172: { displayName: 'Behind Top Care Hospital, Subukia', landmark: 'Subukia-Nakuru Highway', distance: '100 Metres' },
    173: { displayName: "IEBC Kampi ya Moto, Behind DC Office", landmark: 'Kampi Ya Moto Trading Centre', distance: '100 Metres' },
    174: { displayName: "DO's Compound, Kiamaina / Maili Sita", landmark: "DO's Office", distance: '100 Metres' },
    175: { displayName: 'County Council Offices, Opposite KFA', landmark: 'KFA Roundabout, Nakuru Town', distance: '200 Metres' },
    176: { displayName: 'Catholic Diocese Nakuru Compound', landmark: 'Mercy Mission Hospital / Catholic Bookshop', distance: 'Within' },

    // ─── NAROK ───────────────────────────────────────────────────────────────
    177: { displayName: 'Old Kilgoris County Council Offices', landmark: 'Cooperative Bank Kilgoris', distance: '80 Metres' },
    178: { displayName: 'Emurua Dikkir Sub County Offices', landmark: 'Sub County Offices', distance: '10 Metres' },
    179: { displayName: 'Narok North CDF Offices', landmark: "Narok County Commissioner's Offices", distance: '20 Metres' },
    180: { displayName: 'Ntulele Township', landmark: 'Ntulele Police Station', distance: '50 Metres' },
    181: { displayName: 'Ololulunga', landmark: 'Ololulunga Police Station', distance: '10 Metres' },
    182: { displayName: 'Ngoswani Centre', landmark: 'Drilled Water Solar Powerpoint', distance: '70 Metres' },

    // ─── KAJIADO ─────────────────────────────────────────────────────────────
    183: { displayName: 'Ngong DCC Office', landmark: 'Ngong DCC Office', distance: '0 Metres' },
    184: { displayName: 'ACK Tenebo House, Kajiado', landmark: 'Total Petrol Station', distance: '50 Metres' },
    185: { displayName: 'Isinya Multi-Purpose Centre', landmark: "Moi Girls High School Isinya", distance: '50 Metres' },
    186: { displayName: "St Mary's Catholic Church, Kiserian", landmark: "St Mary's Catholic Church", distance: '0 Metres' },
    187: { displayName: 'County Government Revenue Office, Loitoktok', landmark: 'Loitoktok DCC Office', distance: '200 Metres' },

    // ─── KERICHO ─────────────────────────────────────────────────────────────
    188: { displayName: 'Within Londiani Post Office Compound', landmark: 'Londiani Post Office', distance: 'Within' },
    189: { displayName: 'Posta Kenya Building, Kipkelion Town', landmark: 'Kipkelion Post Office', distance: '5 Metres' },
    190: { displayName: "County Commissioner's Compound, Kericho", landmark: 'AP & Children Dept. Office', distance: '20 Metres' },
    191: { displayName: 'Litein Town, Patnas Plaza', landmark: 'Patnas Plaza', distance: '20 Metres' },
    192: { displayName: 'Rev. Temuga Plaza, Sosiot', landmark: 'Opposite DCC Office', distance: '100 Metres' },
    193: { displayName: 'Soko Huru Centre, Police Post Compound', landmark: 'Mathioyo Stadium', distance: '800 Metres' },

    // ─── BOMET ───────────────────────────────────────────────────────────────
    194: { displayName: 'Ministry of Agriculture, Sotik', landmark: 'Opposite CDF Office', distance: '20 Metres' },
    195: { displayName: 'Sigor AGC Church, Chepalungu', landmark: 'Junction to Sigor Township', distance: '500 Metres' },
    196: { displayName: 'AFC Building, Bomet Town', landmark: 'Shell Petrol Station', distance: '15 Metres' },
    197: { displayName: 'NCPB Offices, Bomet Town', landmark: 'NCPB', distance: '0 Metres' },
    198: { displayName: 'Mogogosiek DCC Office', landmark: 'DCC Office Konoin Subcounty', distance: '150 Metres' },

    // ─── KAKAMEGA ────────────────────────────────────────────────────────────
    199: { displayName: 'Lumakanda Centre', landmark: 'Lumakanda PAG Church', distance: '95 Metres' },
    200: { displayName: 'PAG Kongoni Church Compound', landmark: 'Next to Likuyani Sub-County Offices', distance: '50 Metres' },
    201: { displayName: 'Malava Friends Church Compound', landmark: 'Malava Boys High School', distance: '50 Metres' },
    202: { displayName: 'Post Office, Kakamega', landmark: 'Huduma Centre', distance: '20 Metres' },
    203: { displayName: 'Opposite Dowa Filling Station, Navakholo', landmark: 'Dowa Filling Station', distance: '30 Metres' },
    204: { displayName: 'ACK Guest House, Mumias West', landmark: 'ACK Church Complex', distance: '50 Metres' },
    205: { displayName: 'Moco Buildings, Shianda', landmark: 'Shianda Catholic Church', distance: '10 Metres' },
    206: { displayName: 'Matungu Market, Along Kholera Road', landmark: "Matungu Deputy County Commissioner's", distance: '200 Metres' },
    207: { displayName: 'Butere DCC Compound', landmark: "Deputy County Commissioner's Office", distance: '10 Metres' },
    208: { displayName: "Within DCC's Offices, Khwisero", landmark: "DCC's Office", distance: 'Inside' },
    209: { displayName: 'Shinyalu Market', landmark: "St. Aquinas Teachers College", distance: '100 Metres' },
    210: { displayName: 'Sub-County Registrar of Persons, Ikolomani', landmark: 'Malinya Primary School', distance: '100 Metres' },

    // ─── VIHIGA ──────────────────────────────────────────────────────────────
    211: { displayName: 'Vihiga Educational Resource Centre', landmark: 'Vihiga High School', distance: '500 Metres' },
    212: { displayName: 'DCC Compound, Sabatia', landmark: 'Sabatia Eye Hospital', distance: '600 Metres' },
    213: { displayName: 'Hamisi Youth Empowerment Centre', landmark: 'Hamisi Sub-County Hospital', distance: '100 Metres' },
    214: { displayName: 'Luanda Centre', landmark: 'Bunyore Girls High School', distance: '800 Metres' },
    215: { displayName: 'Esibuye Centre', landmark: 'Bunyore Medical Hospital', distance: '150 Metres' },

    // ─── BUNGOMA ─────────────────────────────────────────────────────────────
    216: { displayName: 'Kapsokwony, Koony House', landmark: 'Koony House', distance: 'Within' },
    217: { displayName: 'DCC Compound, Sirisia', landmark: 'DCC Office', distance: '50 Metres' },
    218: { displayName: 'Behind Kabuchai CDF Compound', landmark: 'Along Kanduyi-Chwele Road', distance: '100 Metres' },
    219: { displayName: 'Bumula DCC Office', landmark: 'DCC Compound', distance: '150 Metres' },
    220: { displayName: 'Bungoma Cereals Board Silos', landmark: 'Next to Silos Compound', distance: '0 Metres' },
    221: { displayName: 'DCC Compound, Webuye East', landmark: 'DCC Compound / MP Office T-Junction', distance: '50 Metres' },
    222: { displayName: 'Matisi Market, Along Bungoma-Webuye Highway', landmark: 'Webuye West CDF Offices', distance: '100 Metres' },
    223: { displayName: 'Great Lounch Hotel Building, Kimilili', landmark: 'Opposite Kimilili DEB Primary', distance: '20 Metres' },
    224: { displayName: 'Bungoma North Sub-County HQ', landmark: 'National Government CDF Offices', distance: '50 Metres' },

    // ─── BUSIA ───────────────────────────────────────────────────────────────
    225: { displayName: "DCC's Compound, Amagoro", landmark: 'Law Courts', distance: '2 Metres' },
    226: { displayName: "DCC's Compound, Teso South", landmark: "DCC's Building", distance: '0 Metres' },
    227: { displayName: "DCC's Compound, Nambale", landmark: "DCC's Building", distance: '0 Metres' },
    228: { displayName: "ACC's Compound, Matayos", landmark: "ACC's Office", distance: '10 Metres' },
    229: { displayName: "DCC's Compound, Butula", landmark: 'Butula Police Station', distance: '30 Metres' },
    230: { displayName: 'Funyula Market', landmark: 'Moody Awori Primary School', distance: '20 Metres' },
    231: { displayName: 'Budalangi Market', landmark: 'Budalangi Primary School', distance: '100 Metres' },

    // ─── SIAYA ───────────────────────────────────────────────────────────────
    232: { displayName: 'Ukwala, Opposite Sub County Offices', landmark: 'Posta Ukwala', distance: '100 Metres' },
    233: { displayName: 'Along Savana-Ambira Hospital Road', landmark: 'Savana Hotel', distance: '50 Metres' },
    234: { displayName: "Siaya Town, County Commissioner's Compound", landmark: "County Commissioner's Office", distance: '100 Metres' },
    235: { displayName: 'Nyangweso Market Centre', landmark: 'Sawagongo High School', distance: '200 Metres' },
    236: { displayName: 'Adjacent Municipal Offices, Bondo', landmark: 'Bondo Law Courts', distance: '20 Metres' },
    237: { displayName: 'Kalandini Market Centre', landmark: 'Kalandini Market', distance: '100 Metres' },

    // ─── KISUMU ──────────────────────────────────────────────────────────────
    238: { displayName: 'Mamboleo Show Ground', landmark: 'Mamboleo Show Ground', distance: null },
    239: { displayName: "DCC's Office Block, Ojola", landmark: 'Huduma Centre & CDF Office', distance: null },
    240: { displayName: 'Huduma Centre Wing C, Ground Floor', landmark: 'Huduma Centre', distance: '0 Metres' },
    241: { displayName: 'Kombewa DCC Compound', landmark: 'Kombewa Sub-County Hospital', distance: '100 Metres' },
    242: { displayName: 'Awasi DCC Compound', landmark: 'Awasi DCC Compound', distance: null },
    243: { displayName: 'Opposite Pawtenge Primary, Muhoroni', landmark: 'Chemelil Sugar Belt Union Offices', distance: '0 Metres' },
    244: { displayName: 'Pap Onditi DCC Compound', landmark: "Next to DC's Office", distance: '200 Metres' },

    // ─── HOMA BAY ────────────────────────────────────────────────────────────
    245: { displayName: 'Karachuonyo South DCC Compound, Kosele', landmark: 'DCC Compound', distance: '100 Metres' },
    246: { displayName: 'Kadongo Centre, Along Kisii-Kisumu Road', landmark: 'Renish Obunge Building', distance: '500 Metres' },
    247: { displayName: 'Rachuonyo North DCC Complex, Kamodi', landmark: 'Kendu Bay Road', distance: 'Same Block' },
    248: { displayName: "New Rangwe DCC's Complex", landmark: 'Rangwe Dispensary', distance: '100 Metres' },
    249: { displayName: "Behind CC's Complex, Homa Bay Town", landmark: "County Commissioner's Office", distance: 'Within' },
    250: { displayName: 'Ndhiwa Sub County DCC Complex', landmark: "Deputy County Commissioner's Office", distance: '50 Metres' },
    251: { displayName: 'Suba North Sub County Compound, Mbita', landmark: 'Along Mbita-Rusinga Road', distance: '60 Metres' },
    252: { displayName: 'Magunga Trading Centre', landmark: 'Along Kiabuya-Magunga-Sindo Road', distance: '0 Metres' },

    // ─── MIGORI ──────────────────────────────────────────────────────────────
    253: { displayName: 'DCC Office, Rongo Town', landmark: 'DCC Office Rongo Sub County', distance: 'Within' },
    254: { displayName: 'NCPB Compound, Awendo Town', landmark: 'NCPB Awendo', distance: 'Within' },
    255: { displayName: 'Migori Town, IEBC County Office', landmark: 'IEBC County Office', distance: 'Within' },
    256: { displayName: 'NCPB Compound, Migori Town', landmark: 'NCPB / Namba Junction', distance: 'Within' },
    257: { displayName: 'DCC Office, Uriri Town', landmark: 'DCC Office Uriri Sub County', distance: 'Within' },
    258: { displayName: 'Macalda Town', landmark: "County Government Office Macalda", distance: '50 Metres' },
    259: { displayName: 'Kehancha Town', landmark: 'Kehancha Law Courts', distance: 'Next to' },
    260: { displayName: 'DCC Office, Kegonga Town', landmark: 'DCC Office Kuria East Sub County', distance: 'Within' },

    // ─── KISII ───────────────────────────────────────────────────────────────
    261: { displayName: 'Suneka Market', landmark: 'Itierio Boys High School', distance: '40 Metres' },
    262: { displayName: "Nyamarambe, DCC's Office", landmark: "DCC's Office", distance: '50 Metres' },
    263: { displayName: 'Kenyanya Market Centre', landmark: "DCC's Office", distance: '10 Metres' },
    264: { displayName: "Itumbe, DCC's Office", landmark: "DCC's Office", distance: '50 Metres' },
    265: { displayName: "Ogembo, DCC's Office", landmark: "DCC's Office", distance: '20 Metres' },
    266: { displayName: "Masimba, DCC's Office", landmark: "DCC's Office", distance: '40 Metres' },
    267: { displayName: "Kisii Town, County Commissioner's Office", landmark: "County Commissioner's Office", distance: '50 Metres' },
    268: { displayName: 'Marani Centre', landmark: 'Marani Sub-County Office', distance: '100 Metres' },
    269: { displayName: "Kisii Town, County Commissioner's Office", landmark: "County Commissioner's Office", distance: '20 Metres' },

    // ─── NYAMIRA ─────────────────────────────────────────────────────────────
    270: { displayName: 'Manga DCC Compound', landmark: 'Manga Cliff', distance: '200 Metres' },
    271: { displayName: "Nyamira Town, County Commissioners' HQ", landmark: 'Next to Nyamira Law Courts', distance: '200 Metres' },
    272: { displayName: 'Ekerenyo Market', landmark: 'Ekerenyo Bus Stage', distance: '100 Metres' },
    273: { displayName: 'DCC Office Compound, Kijauri Town', landmark: 'DCC Office', distance: '20 Metres' },

    // ─── NAIROBI ─────────────────────────────────────────────────────────────
    274: { displayName: 'DC Compound, Westlands', landmark: 'Safaricom Centre', distance: '200 Metres' },
    275: { displayName: 'Maliposa Apartments, Ngong Road', landmark: 'Nakumatt Junction', distance: '4 Km' },
    276: { displayName: 'Maisha Poa Centre, Kawangware', landmark: 'DCC Office Dagoretti South', distance: '200 Metres' },
    277: { displayName: 'Langata Subcounty HQ, Five Star Road', landmark: "Five Star Road / Kwa Chief Wilson", distance: '2 Km' },
    278: { displayName: "DC's Office, Kibra", landmark: 'Adjacent to Huduma Centre', distance: '0 Metres' },
    279: { displayName: "DO's Office, Kahawa West", landmark: "ACC's Office / Police Station", distance: '0 Metres' },
    280: { displayName: 'Former DCC Offices, Kasarani', landmark: 'Chiefs Office Nearby', distance: '700 Metres' },
    281: { displayName: 'Matigari General Merchants, Baba Dogo', landmark: 'Lexx Place Hotel', distance: '450 Metres' },
    282: { displayName: 'Villa Franca, Imara Daima', landmark: 'Equity Afya Hospital', distance: '0 Metres' },
    283: { displayName: "Near DCC Office, Dandora", landmark: 'DCC Office', distance: '100 Metres' },
    284: { displayName: "DO's Office, Kayole", landmark: "DO's Office Kayole", distance: '0 Metres' },
    285: { displayName: 'East Africa School of Aviation, Embakasi', landmark: 'EASA', distance: '0 Metres' },
    286: { displayName: 'Tena White House, Donholm', landmark: 'Shell Petrol Station, Manyanja Road', distance: '10 Metres' },
    287: { displayName: 'Makadara DCC Compound', landmark: 'CIPU Office Makadara', distance: '0 Metres' },
    288: { displayName: 'DCC HQ, Kamukunji', landmark: 'DCC Office', distance: '0 Metres' },
    289: { displayName: 'Kenya Railways Block D, Ngara', landmark: 'Opposite Technical University of Kenya', distance: '200 Metres' },
    290: { displayName: 'Mathare DCC Compound', landmark: 'DCC Office', distance: '0 Metres' },
};

export {
    IEBC_OFFICE_NAMES,
    cleanDisplayName,
    smartTitleCase,
    getOfficeDisplayName,
    getOfficeLandmark,
    getOfficeLandmarkDistance,
};

export default {
    getOfficeDisplayName,
    getOfficeLandmark,
    getOfficeLandmarkDistance,
    cleanDisplayName,
    smartTitleCase,
    IEBC_OFFICE_NAMES,
};
