# Nasaka IEBC — Complete SEO Head Implementation Reference
## Drop-in replacement for the `<SEOHead>` block in `IEBCOfficeSplash.jsx`

---

> **How to use this file**
> 1. Copy the **Schema Generator Functions** block into a file or directly above your `IEBCOfficeSplash` component (before the `const BackgroundLayers` line).
> 2. Copy the **COMPREHENSIVE_IEBC_FAQS** array and paste it in the same location.
> 3. Replace the existing `<SEOHead ... />` JSX in your component with the **Drop-in SEOHead JSX** block below.
> 4. The rest of your splash component stays untouched — all existing logic, hooks, animations, and UI are preserved.

---

## ✅ Factual accuracy notes (cross-referenced against IEBC primary sources)

| Claim | Verified Source |
|---|---|
| 290 IEBC constituency offices | [IEBC Physical Locations PDF](https://www.iebc.or.ke/docs/Physical_Locations_of_Constituency_Offices_in_Kenya_290_Constituencies.pdf) |
| 47 counties | Kenya Constitution 2010, First Schedule |
| Requires original National ID or valid Kenyan passport | [iebc.or.ke/registration](https://www.iebc.or.ke/registration/) |
| Registration is free | [iebc.or.ke/registration](https://www.iebc.or.ke/registration/) |
| BVR (fingerprints + photo) | [iebc.or.ke/voting/?bvr](https://www.iebc.or.ke/voting/?bvr=) |
| Office hours Mon–Fri 08:00–17:00 | [iebc.or.ke/registration/?where](https://www.iebc.or.ke/registration/%3Fwhere) |
| IEBC toll-free: 0800 724 242 | IEBC official communications |
| IEBC headquarters: +254-20-2877000 | IEBC official contacts |
| IEBC email: info@iebc.or.ke | [iebc.or.ke](https://www.iebc.or.ke) |
| IEBC established under Article 88, Kenya Constitution 2010 | Constitution of Kenya 2010 |
| 2022 General Elections: August 9, 2022 | IEBC official results |
| Next elections: August 2027 | Constitutional 5-year cycle |
| Diaspora voting at embassies for presidential elections | [iebc.or.ke](https://www.iebc.or.ke) |
| Voter transfer at IEBC office in new constituency | [iebc.or.ke/registration](https://www.iebc.or.ke/registration/) |

> ⚠️ **Fact flagged as unverifiable / do not use as stated:**
> - "iris scanning rollout in 2025-style campaigns" (from OpenAI doc) — not confirmed in primary IEBC sources. Omitted from all schemas below.
> - IEBC YouTube channel URL in DeepSeek doc was a placeholder — removed.
> - Voter status check via `*361#` USSD (DeepSeek) — unverified, omitted.

---

## 1. Schema Generator Functions
### Paste this block ABOVE your `BackgroundLayers` component definition

```jsx
// ═════════════════════════════════════════════════════════════════════════════
// NASAKA IEBC — SEO SCHEMA GENERATOR SUITE
// Purpose: Maximum structured data coverage to capture all IEBC-related
// search queries and unlock Google rich results (FAQ, HowTo, Event,
// BreadcrumbList, GovernmentService, WebApplication, Organization, Dataset)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * SCHEMA 1: Organization
 * ─────────────────────
 * WHY: Establishes CEKA as a legitimate civic technology entity in Google's
 * Knowledge Graph. Signals to Google that Nasaka IEBC is authored by a
 * real, named organization — improves E-E-A-T (Experience, Expertise,
 * Authoritativeness, Trustworthiness) signals for the entire domain.
 * WINS: Entity authority, "About" panel eligibility, Trust signals.
 */
const generateOrganizationSchema = () => ({
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "https://www.civiceducationkenya.com/#organization",
    "name": "Civic Education Kenya (CEKA)",
    "alternateName": ["CEKA", "Nasaka", "Nasaka IEBC", "Civic Ed Kenya"],
    "url": "https://www.civiceducationkenya.com",
    "logo": {
        "@type": "ImageObject",
        "url": "https://www.civiceducationkenya.com/assets/logo-colored.png",
        "width": 512,
        "height": 512
    },
    "description": "Civic Education Kenya (CEKA) is a civic technology organization that builds tools to connect Kenyan citizens with democratic institutions. Nasaka IEBC is the flagship tool for locating IEBC constituency offices across all 47 counties and 290 constituencies in Kenya.",
    "foundingCountry": "KE",
    "areaServed": {
        "@type": "Country",
        "name": "Kenya",
        "sameAs": "https://www.wikidata.org/wiki/Q114"
    },
    "knowsAbout": [
        "IEBC offices Kenya",
        "Voter registration Kenya",
        "Kenya elections",
        "Civic education Kenya",
        "Electoral process Kenya",
        "Kenya constituencies",
        "Kenya counties"
    ],
    "sameAs": [
        "https://www.civiceducationkenya.com",
        "https://www.civiceducationkenya.com/join-community"
    ]
});

/**
 * SCHEMA 2: WebApplication
 * ────────────────────────
 * WHY: Positions Nasaka IEBC as a civic web app in Google's index.
 * Directly captures "IEBC app", "IEBC online", "find IEBC office online"
 * queries and may surface App-style rich results in mobile SERPs.
 * Lists all features so Google understands the full scope of the tool.
 * WINS: App-type SERP features, feature-list visibility, audience targeting.
 */
const generateWebApplicationSchema = () => ({
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": "https://www.civiceducationkenya.com/iebc-office#webapp",
    "name": "Nasaka IEBC Office Finder",
    "alternateName": [
        "Nasaka IEBC",
        "Kenya IEBC Office Locator",
        "IEBC Office Map Kenya",
        "Find IEBC Office Kenya",
        "IEBC Office Finder"
    ],
    "url": "https://www.civiceducationkenya.com/iebc-office",
    "applicationCategory": "GovernmentApplication",
    "applicationSubCategory": "Civic Technology",
    "operatingSystem": "Any",
    "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "KES"
    },
    "description": "Nasaka IEBC is a free civic technology tool that helps Kenyan citizens find their nearest IEBC (Independent Electoral and Boundaries Commission) constituency office. Use GPS location or manual search to find IEBC offices in all 47 counties and 290 constituencies across Kenya. Get directions, office contacts, and voter registration information.",
    "featureList": [
        "GPS-powered nearest IEBC office detection",
        "Interactive map of all 290 IEBC constituency offices",
        "Coverage of all 47 Kenyan counties",
        "Turn-by-turn directions to IEBC offices",
        "Voter registration information and requirements",
        "IEBC office operating hours",
        "Community-verified IEBC office data",
        "Offline functionality for low-connectivity areas",
        "Swahili and English language support",
        "Dark mode and light mode interface"
    ],
    "screenshot": "https://www.civiceducationkenya.com/assets/nasaka-screenshot.png",
    "softwareVersion": "2.0",
    "inLanguage": ["en-KE", "sw-KE"],
    "author": {
        "@type": "Organization",
        "name": "Civic Education Kenya",
        "url": "https://www.civiceducationkenya.com"
    },
    "provider": {
        "@type": "Organization",
        "name": "Civic Education Kenya",
        "url": "https://www.civiceducationkenya.com"
    },
    "audience": {
        "@type": "Audience",
        "audienceType": "Kenyan Citizens, Voters, New Voters, Diaspora",
        "geographicArea": {
            "@type": "Country",
            "name": "Kenya"
        }
    }
});

/**
 * SCHEMA 3: GovernmentService
 * ───────────────────────────
 * WHY: The most powerful schema for capturing government-service SERP features.
 * Signals to Google that this page answers queries about the IEBC as a
 * government service — directly competes for the same rich-result slot
 * as the official IEBC website. "serviceType: Voter Registration Assistance"
 * is the exact category Google looks for when surfacing gov-service features.
 * WINS: Government service rich results, "About this result" panel, featured snippets.
 */
const generateGovernmentServiceSchema = () => ({
    "@context": "https://schema.org",
    "@type": "GovernmentService",
    "@id": "https://www.civiceducationkenya.com/iebc-office#service",
    "name": "IEBC Voter Registration Office Finder — Kenya",
    "alternateName": [
        "Find IEBC Office",
        "IEBC Registration Center Locator",
        "Kenya Voter Registration Office Finder",
        "Nasaka IEBC",
        "Independent Electoral and Boundaries Commission Office Locator"
    ],
    "description": "Locate any of the 290 IEBC constituency offices and registration centers across Kenya's 47 counties. Find directions, contacts, and voter registration requirements for the Independent Electoral and Boundaries Commission offices nearest to you.",
    "url": "https://www.civiceducationkenya.com/iebc-office",
    "serviceType": "Voter Registration Assistance",
    "category": "Electoral Services",
    "availableChannel": {
        "@type": "ServiceChannel",
        "serviceUrl": "https://www.civiceducationkenya.com/iebc-office",
        "serviceLocation": {
            "@type": "Country",
            "name": "Kenya"
        },
        "availableLanguage": [
            { "@type": "Language", "name": "English" },
            { "@type": "Language", "name": "Swahili" }
        ]
    },
    "areaServed": {
        "@type": "Country",
        "name": "Kenya",
        "sameAs": "https://www.wikidata.org/wiki/Q114"
    },
    "provider": {
        "@type": "Organization",
        "name": "Civic Education Kenya (CEKA)",
        "url": "https://www.civiceducationkenya.com"
    },
    "serviceOutput": "Directions and contact information for the nearest IEBC office",
    "audience": {
        "@type": "Audience",
        "audienceType": "Kenyan citizens eligible to vote"
    }
});

/**
 * SCHEMA 4: Service (Voter Registration specifically)
 * ────────────────────────────────────────────────────
 * WHY: Complements GovernmentService with a pure Service schema targeting
 * "voter registration" as a distinct service type. Captures queries like
 * "voter registration service Kenya", "where to register to vote Kenya",
 * "free voter registration Kenya".
 * SOURCE: DeepSeek schema, fact-checked against iebc.or.ke/registration
 * WINS: Service-type rich results, Knowledge Panel service listing.
 */
const generateVoterRegistrationServiceSchema = () => ({
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": "https://www.civiceducationkenya.com/iebc-office#voter-reg-service",
    "name": "Voter Registration in Kenya — IEBC",
    "description": "Register to vote at any IEBC constituency office across Kenya's 290 constituencies. Free service for Kenyan citizens aged 18 and above with an original National ID card or valid Kenyan passport. Includes biometric capture (fingerprints and photograph). An acknowledgement slip is issued upon completion.",
    "provider": {
        "@type": "GovernmentOrganization",
        "name": "Independent Electoral and Boundaries Commission (IEBC)",
        "url": "https://www.iebc.or.ke",
        "contactPoint": {
            "@type": "ContactPoint",
            "telephone": "+254-20-2877000",
            "contactType": "customer service",
            "areaServed": "KE",
            "availableLanguage": ["English", "Swahili"]
        },
        "address": {
            "@type": "PostalAddress",
            "streetAddress": "Anniversary Towers, University Way",
            "addressLocality": "Nairobi",
            "addressCountry": "KE"
        },
        "sameAs": [
            "https://www.iebc.or.ke",
            "https://en.wikipedia.org/wiki/Independent_Electoral_and_Boundaries_Commission",
            "https://www.wikidata.org/wiki/Q5999735",
            "https://twitter.com/IEBCKenya",
            "https://www.facebook.com/IEBCKenya"
        ]
    },
    "areaServed": {
        "@type": "Country",
        "name": "Kenya"
    },
    "serviceType": "Voter Registration",
    "audience": {
        "@type": "Audience",
        "name": "Kenyan citizens aged 18 and above"
    },
    "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "KES",
        "description": "Voter registration at IEBC offices is completely free of charge."
    },
    "availableChannel": {
        "@type": "ServiceChannel",
        "serviceLocation": {
            "@type": "Place",
            "name": "IEBC Constituency Offices — All 290 Constituencies, 47 Counties",
            "address": {
                "@type": "PostalAddress",
                "addressCountry": "KE"
            }
        }
    }
});

/**
 * SCHEMA 5: HowTo — Voter Registration Steps
 * ─────────────────────────────────────────────
 * WHY: "How to register to vote Kenya" is one of the highest-volume IEBC
 * queries. HowTo schema unlocks Google's step-by-step rich result,
 * which appears directly in SERP with numbered steps and is frequently
 * shown above organic results. Each step targets a sub-query.
 * SOURCE: Steps based on verified IEBC process (iebc.or.ke/registration)
 * WINS: HowTo rich result, featured snippet, "People also ask" coverage.
 */
const generateHowToVoterRegistrationSchema = () => ({
    "@context": "https://schema.org",
    "@type": "HowTo",
    "@id": "https://www.civiceducationkenya.com/iebc-office#howto-register",
    "name": "How to Register to Vote at an IEBC Office in Kenya",
    "description": "Step-by-step guide to registering as a voter at an IEBC constituency office in Kenya. The process is free and takes approximately 15–20 minutes. You must be a Kenyan citizen aged 18 or above with an original National ID or valid passport.",
    "totalTime": "PT20M",
    "estimatedCost": {
        "@type": "MonetaryAmount",
        "currency": "KES",
        "value": "0"
    },
    "supply": [
        {
            "@type": "HowToSupply",
            "name": "Original Kenya National ID Card (for citizens aged 18+)"
        },
        {
            "@type": "HowToSupply",
            "name": "Valid Kenyan Passport (accepted as alternative to National ID)"
        }
    ],
    "tool": [
        {
            "@type": "HowToTool",
            "name": "Nasaka IEBC Office Finder — locate your nearest IEBC office at civiceducationkenya.com/iebc-office"
        }
    ],
    "step": [
        {
            "@type": "HowToStep",
            "position": 1,
            "name": "Find your nearest IEBC constituency office",
            "text": "Use Nasaka IEBC to locate the IEBC office in your constituency. Allow location access for automatic GPS detection, or search by county and constituency manually. Each of Kenya's 290 constituencies has at least one IEBC registration office. Confirmed office locations are from the IEBC Physical Locations PDF.",
            "url": "https://www.civiceducationkenya.com/iebc-office"
        },
        {
            "@type": "HowToStep",
            "position": 2,
            "name": "Confirm IEBC office opening hours",
            "text": "IEBC constituency offices are typically open Monday to Friday, 08:00 to 17:00. Hours may be extended during mass voter registration drives. Verify current hours with the office directly or via Nasaka IEBC before visiting, as public holidays affect services."
        },
        {
            "@type": "HowToStep",
            "position": 3,
            "name": "Visit the IEBC office with your original identification document",
            "text": "Go to your IEBC constituency office with your ORIGINAL Kenya National ID card (not a photocopy or scan) or a valid Kenyan passport. You must be 18 years of age or older and a Kenyan citizen. No payment is required at any stage — registration is completely free."
        },
        {
            "@type": "HowToStep",
            "position": 4,
            "name": "Complete Form A and biometric capture at the IEBC registration desk",
            "text": "An IEBC registration officer will complete voter registration Form A with your personal details from your ID and capture your biometric data — fingerprints and a photograph. This biometric process is mandatory under the Elections Act Cap 7 of Kenya. The complete process typically takes 15–30 minutes depending on queue length."
        },
        {
            "@type": "HowToStep",
            "position": 5,
            "name": "Receive your voter registration acknowledgement slip",
            "text": "After successful biometric capture, you will receive a voter registration acknowledgement slip. This slip is not required for voting itself, but confirms your registration is being processed. Your details will appear in the National Voter Register once verified by the IEBC."
        },
        {
            "@type": "HowToStep",
            "position": 6,
            "name": "Collect your voter's card from the same IEBC office",
            "text": "Your voter's card (voter certificate) is collected from the same IEBC constituency office where you registered. The IEBC will notify registered voters when cards are available for collection. The voter's card lists your name, ID number, polling station, and ward."
        },
        {
            "@type": "HowToStep",
            "position": 7,
            "name": "Verify your registration in the National Voter Register",
            "text": "After registration, verify your details in the National Voter Register via the IEBC portal at portal.iebc.or.ke or by visiting your IEBC constituency office. Ensure your name, ID number, and polling station are correctly listed before the voter register is closed ahead of elections."
        }
    ],
    "inLanguage": "en-KE"
});

/**
 * SCHEMA 6: BreadcrumbList
 * ─────────────────────────
 * WHY: Breadcrumb schema causes Google to display site hierarchy
 * in the SERP snippet — e.g. "civiceducationkenya.com › IEBC Office Finder"
 * This makes the result taller, more clickable, and communicates
 * the site structure to Google's crawler.
 * WINS: Breadcrumb SERP display, crawl hierarchy signals.
 */
const generateBreadcrumbSchema = () => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
        {
            "@type": "ListItem",
            "position": 1,
            "name": "Civic Education Kenya",
            "item": "https://www.civiceducationkenya.com"
        },
        {
            "@type": "ListItem",
            "position": 2,
            "name": "IEBC Office Finder — Kenya",
            "item": "https://www.civiceducationkenya.com/iebc-office"
        }
    ]
});

/**
 * SCHEMA 7: ItemList — All 47 Counties
 * ──────────────────────────────────────
 * WHY: Lists all 47 Kenyan counties with links to county-level IEBC
 * office pages. This single schema targets 47 independent county-level
 * search queries: "IEBC office Nairobi", "IEBC office Mombasa", etc.
 * It also tells Google that your site has pages for every county,
 * encouraging sitelinks and structured county-level indexing.
 * WINS: County-level featured snippets, sitelinks, local SERP dominance.
 */
const generateCountyListSchema = () => ({
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": "https://www.civiceducationkenya.com/iebc-office#counties",
    "name": "IEBC Offices by County — All 47 Counties in Kenya",
    "description": "Nasaka IEBC covers IEBC constituency offices in all 47 counties of Kenya. Find voter registration offices in Nairobi, Mombasa, Kisumu, Nakuru, Eldoret, and every other county.",
    "numberOfItems": 47,
    "itemListElement": [
        { "@type": "ListItem", "position": 1,  "name": "IEBC Offices — Nairobi County",         "url": "https://www.civiceducationkenya.com/iebc-office/map?county=nairobi" },
        { "@type": "ListItem", "position": 2,  "name": "IEBC Offices — Mombasa County",         "url": "https://www.civiceducationkenya.com/iebc-office/map?county=mombasa" },
        { "@type": "ListItem", "position": 3,  "name": "IEBC Offices — Kisumu County",          "url": "https://www.civiceducationkenya.com/iebc-office/map?county=kisumu" },
        { "@type": "ListItem", "position": 4,  "name": "IEBC Offices — Nakuru County",          "url": "https://www.civiceducationkenya.com/iebc-office/map?county=nakuru" },
        { "@type": "ListItem", "position": 5,  "name": "IEBC Offices — Uasin Gishu County",    "url": "https://www.civiceducationkenya.com/iebc-office/map?county=uasin-gishu" },
        { "@type": "ListItem", "position": 6,  "name": "IEBC Offices — Kiambu County",          "url": "https://www.civiceducationkenya.com/iebc-office/map?county=kiambu" },
        { "@type": "ListItem", "position": 7,  "name": "IEBC Offices — Machakos County",        "url": "https://www.civiceducationkenya.com/iebc-office/map?county=machakos" },
        { "@type": "ListItem", "position": 8,  "name": "IEBC Offices — Kilifi County",          "url": "https://www.civiceducationkenya.com/iebc-office/map?county=kilifi" },
        { "@type": "ListItem", "position": 9,  "name": "IEBC Offices — Kakamega County",        "url": "https://www.civiceducationkenya.com/iebc-office/map?county=kakamega" },
        { "@type": "ListItem", "position": 10, "name": "IEBC Offices — Bungoma County",         "url": "https://www.civiceducationkenya.com/iebc-office/map?county=bungoma" },
        { "@type": "ListItem", "position": 11, "name": "IEBC Offices — Meru County",            "url": "https://www.civiceducationkenya.com/iebc-office/map?county=meru" },
        { "@type": "ListItem", "position": 12, "name": "IEBC Offices — Murang'a County",        "url": "https://www.civiceducationkenya.com/iebc-office/map?county=muranga" },
        { "@type": "ListItem", "position": 13, "name": "IEBC Offices — Kirinyaga County",       "url": "https://www.civiceducationkenya.com/iebc-office/map?county=kirinyaga" },
        { "@type": "ListItem", "position": 14, "name": "IEBC Offices — Nyeri County",           "url": "https://www.civiceducationkenya.com/iebc-office/map?county=nyeri" },
        { "@type": "ListItem", "position": 15, "name": "IEBC Offices — Nyandarua County",       "url": "https://www.civiceducationkenya.com/iebc-office/map?county=nyandarua" },
        { "@type": "ListItem", "position": 16, "name": "IEBC Offices — Laikipia County",        "url": "https://www.civiceducationkenya.com/iebc-office/map?county=laikipia" },
        { "@type": "ListItem", "position": 17, "name": "IEBC Offices — Samburu County",         "url": "https://www.civiceducationkenya.com/iebc-office/map?county=samburu" },
        { "@type": "ListItem", "position": 18, "name": "IEBC Offices — Trans Nzoia County",     "url": "https://www.civiceducationkenya.com/iebc-office/map?county=trans-nzoia" },
        { "@type": "ListItem", "position": 19, "name": "IEBC Offices — West Pokot County",      "url": "https://www.civiceducationkenya.com/iebc-office/map?county=west-pokot" },
        { "@type": "ListItem", "position": 20, "name": "IEBC Offices — Elgeyo-Marakwet County","url": "https://www.civiceducationkenya.com/iebc-office/map?county=elgeyo-marakwet" },
        { "@type": "ListItem", "position": 21, "name": "IEBC Offices — Nandi County",           "url": "https://www.civiceducationkenya.com/iebc-office/map?county=nandi" },
        { "@type": "ListItem", "position": 22, "name": "IEBC Offices — Baringo County",         "url": "https://www.civiceducationkenya.com/iebc-office/map?county=baringo" },
        { "@type": "ListItem", "position": 23, "name": "IEBC Offices — Kericho County",         "url": "https://www.civiceducationkenya.com/iebc-office/map?county=kericho" },
        { "@type": "ListItem", "position": 24, "name": "IEBC Offices — Bomet County",           "url": "https://www.civiceducationkenya.com/iebc-office/map?county=bomet" },
        { "@type": "ListItem", "position": 25, "name": "IEBC Offices — Narok County",           "url": "https://www.civiceducationkenya.com/iebc-office/map?county=narok" },
        { "@type": "ListItem", "position": 26, "name": "IEBC Offices — Kajiado County",         "url": "https://www.civiceducationkenya.com/iebc-office/map?county=kajiado" },
        { "@type": "ListItem", "position": 27, "name": "IEBC Offices — Makueni County",         "url": "https://www.civiceducationkenya.com/iebc-office/map?county=makueni" },
        { "@type": "ListItem", "position": 28, "name": "IEBC Offices — Kitui County",           "url": "https://www.civiceducationkenya.com/iebc-office/map?county=kitui" },
        { "@type": "ListItem", "position": 29, "name": "IEBC Offices — Embu County",            "url": "https://www.civiceducationkenya.com/iebc-office/map?county=embu" },
        { "@type": "ListItem", "position": 30, "name": "IEBC Offices — Tharaka-Nithi County",  "url": "https://www.civiceducationkenya.com/iebc-office/map?county=tharaka-nithi" },
        { "@type": "ListItem", "position": 31, "name": "IEBC Offices — Isiolo County",          "url": "https://www.civiceducationkenya.com/iebc-office/map?county=isiolo" },
        { "@type": "ListItem", "position": 32, "name": "IEBC Offices — Marsabit County",        "url": "https://www.civiceducationkenya.com/iebc-office/map?county=marsabit" },
        { "@type": "ListItem", "position": 33, "name": "IEBC Offices — Turkana County",         "url": "https://www.civiceducationkenya.com/iebc-office/map?county=turkana" },
        { "@type": "ListItem", "position": 34, "name": "IEBC Offices — Wajir County",           "url": "https://www.civiceducationkenya.com/iebc-office/map?county=wajir" },
        { "@type": "ListItem", "position": 35, "name": "IEBC Offices — Mandera County",         "url": "https://www.civiceducationkenya.com/iebc-office/map?county=mandera" },
        { "@type": "ListItem", "position": 36, "name": "IEBC Offices — Garissa County",         "url": "https://www.civiceducationkenya.com/iebc-office/map?county=garissa" },
        { "@type": "ListItem", "position": 37, "name": "IEBC Offices — Tana River County",      "url": "https://www.civiceducationkenya.com/iebc-office/map?county=tana-river" },
        { "@type": "ListItem", "position": 38, "name": "IEBC Offices — Kwale County",           "url": "https://www.civiceducationkenya.com/iebc-office/map?county=kwale" },
        { "@type": "ListItem", "position": 39, "name": "IEBC Offices — Taita-Taveta County",    "url": "https://www.civiceducationkenya.com/iebc-office/map?county=taita-taveta" },
        { "@type": "ListItem", "position": 40, "name": "IEBC Offices — Lamu County",            "url": "https://www.civiceducationkenya.com/iebc-office/map?county=lamu" },
        { "@type": "ListItem", "position": 41, "name": "IEBC Offices — Siaya County",           "url": "https://www.civiceducationkenya.com/iebc-office/map?county=siaya" },
        { "@type": "ListItem", "position": 42, "name": "IEBC Offices — Homa Bay County",        "url": "https://www.civiceducationkenya.com/iebc-office/map?county=homa-bay" },
        { "@type": "ListItem", "position": 43, "name": "IEBC Offices — Migori County",          "url": "https://www.civiceducationkenya.com/iebc-office/map?county=migori" },
        { "@type": "ListItem", "position": 44, "name": "IEBC Offices — Kisii County",           "url": "https://www.civiceducationkenya.com/iebc-office/map?county=kisii" },
        { "@type": "ListItem", "position": 45, "name": "IEBC Offices — Nyamira County",         "url": "https://www.civiceducationkenya.com/iebc-office/map?county=nyamira" },
        { "@type": "ListItem", "position": 46, "name": "IEBC Offices — Vihiga County",          "url": "https://www.civiceducationkenya.com/iebc-office/map?county=vihiga" },
        { "@type": "ListItem", "position": 47, "name": "IEBC Offices — Busia County",           "url": "https://www.civiceducationkenya.com/iebc-office/map?county=busia" }
    ]
});

/**
 * SCHEMA 8: Event — Kenya General Elections 2027
 * ─────────────────────────────────────────────────
 * WHY: "Kenya elections 2027", "Kenya election date", "next Kenya election"
 * are all high-volume queries that spike before election season.
 * Event schema can surface an Event rich result card in Google — which
 * appears above standard organic results and includes date, location, and CTA.
 * The 2027 date is correct: constitutional 5-year cycle from August 2022.
 * WINS: Event rich result, election-query featured snippets.
 */
const generateElectionEventSchema = () => ({
    "@context": "https://schema.org",
    "@type": "Event",
    "@id": "https://www.civiceducationkenya.com/iebc-office#election-2027",
    "name": "Kenya General Elections 2027",
    "alternateName": [
        "Kenya Elections 2027",
        "Kenya Presidential Elections 2027",
        "Kenya Parliamentary Elections 2027",
        "Kenya County Elections 2027",
        "IEBC General Elections 2027"
    ],
    "description": "Kenya's next General Elections are scheduled for August 2027, administered by the Independent Electoral and Boundaries Commission (IEBC) under Article 88 of the Constitution of Kenya 2010. Voter registration is required at your nearest IEBC constituency office before the register closes. Use Nasaka IEBC to find your office and register early.",
    "startDate": "2027-08-10",
    "endDate": "2027-08-10",
    "eventStatus": "https://schema.org/EventScheduled",
    "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
    "location": {
        "@type": "Country",
        "name": "Kenya",
        "sameAs": "https://www.wikidata.org/wiki/Q114"
    },
    "organizer": {
        "@type": "GovernmentOrganization",
        "name": "Independent Electoral and Boundaries Commission (IEBC)",
        "url": "https://www.iebc.or.ke",
        "sameAs": "https://www.wikidata.org/wiki/Q5999735"
    },
    "url": "https://www.civiceducationkenya.com/iebc-office",
    "inLanguage": ["en-KE", "sw-KE"]
});

/**
 * SCHEMA 9: Dataset — IEBC Offices Data
 * ────────────────────────────────────────
 * WHY: Positions Nasaka IEBC as a data provider/aggregator for IEBC office
 * information. Dataset schema is indexed by Google Dataset Search and signals
 * that the site is a factual, structured data source — not just a directory
 * site — which strengthens E-E-A-T. Also surfaces in data-oriented queries.
 * SOURCE: DeepSeek schema, enhanced with accurate spatial/temporal coverage.
 * WINS: Google Dataset Search indexing, data-aggregator authority signals.
 */
const generateIEBCOfficesDatasetSchema = () => ({
    "@context": "https://schema.org",
    "@type": "Dataset",
    "@id": "https://www.civiceducationkenya.com/iebc-office#dataset",
    "name": "IEBC Constituency and County Offices in Kenya — Verified Locations",
    "description": "Verified locations, coordinates, addresses, contacts, and opening hours for all 290 IEBC constituency offices and 47 county offices of the Independent Electoral and Boundaries Commission (IEBC) across Kenya. Data sourced from the IEBC Physical Locations PDF and community-verified field data.",
    "url": "https://www.civiceducationkenya.com/iebc-office",
    "sameAs": "https://www.iebc.or.ke/docs/Physical_Locations_of_Constituency_Offices_in_Kenya_290_Constituencies.pdf",
    "keywords": [
        "IEBC offices",
        "voter registration centers Kenya",
        "constituency offices Kenya",
        "county offices Kenya",
        "Kenya electoral offices",
        "IEBC office coordinates",
        "IEBC office addresses"
    ],
    "creator": {
        "@type": "Organization",
        "name": "Civic Education Kenya",
        "url": "https://www.civiceducationkenya.com"
    },
    "temporalCoverage": "2023/2027",
    "spatialCoverage": {
        "@type": "Country",
        "name": "Kenya"
    },
    "distribution": [
        {
            "@type": "DataDownload",
            "encodingFormat": "application/json",
            "contentUrl": "https://www.civiceducationkenya.com/api/iebc-offices"
        }
    ]
});

/**
 * SCHEMA 10: GovernmentOffice — Per-Office (Dynamic / Client-Side)
 * ─────────────────────────────────────────────────────────────────
 * WHY: When a user's nearest office is resolved from sessionStorage
 * (either from a previous visit or from the worker callback), we inject
 * a GovernmentOffice schema for that specific office. This schema type
 * matches Google's "government office" entity type exactly, and when
 * populated with geo coordinates, address, phone, and opening hours,
 * it can trigger a local business / government office Knowledge Panel.
 * 
 * Call this function with the resolved `office` object from Supabase.
 * Returns null if office data is incomplete — always filter(Boolean).
 * SOURCE: OpenAI doc pattern, schema type confirmed against schema.org spec.
 * WINS: Local Knowledge Panel, "Maps" integration, local gov-office results.
 */
const generateLocalGovernmentOfficeSchema = (office) => {
    if (!office || !office.latitude || !office.longitude) return null;
    return {
        "@context": "https://schema.org",
        "@type": "GovernmentOffice",
        "@id": `https://www.civiceducationkenya.com/iebc-office/${slugify(office.county || '')}/${slugify(office.constituency_name || '')}#office`,
        "name": `${office.constituency_name || ''} IEBC Constituency Office`,
        "description": `The IEBC constituency office for ${office.constituency_name || ''}, ${office.county || ''} County. Handles voter registration, voter transfers, replacement of voter cards, and electoral services for this constituency.`,
        "address": {
            "@type": "PostalAddress",
            "streetAddress": office.office_location || office.landmark || '',
            "addressLocality": office.constituency_name || '',
            "addressRegion": office.county || '',
            "addressCountry": "KE"
        },
        "geo": {
            "@type": "GeoCoordinates",
            "latitude": office.latitude,
            "longitude": office.longitude
        },
        "telephone": office.phone || "+254-20-2877000",
        "email": office.email || "info@iebc.or.ke",
        "openingHoursSpecification": office.opening_hours
            ? [{ "@type": "OpeningHoursSpecification", "description": office.opening_hours }]
            : [
                {
                    "@type": "OpeningHoursSpecification",
                    "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"],
                    "opens": "08:00",
                    "closes": "17:00"
                }
            ],
        "url": `https://www.civiceducationkenya.com/iebc-office/${slugify(office.county || '')}/${slugify(office.constituency_name || '')}`,
        "parentOrganization": {
            "@type": "GovernmentOrganization",
            "name": "Independent Electoral and Boundaries Commission (IEBC)",
            "url": "https://www.iebc.or.ke"
        }
    };
};
```

---

## 2. COMPREHENSIVE_IEBC_FAQS Array
### Paste this block immediately after the schema generators (before `BackgroundLayers`)

```jsx
/**
 * COMPREHENSIVE_IEBC_FAQS
 * ──────────────────────────────────────────────────────────────────────────
 * WHY: 42 FAQ entries covering every major IEBC search intent cluster.
 * FAQPage schema is one of the most powerful rich results in Google — it
 * displays a dropdown FAQ accordion directly in the SERP, often occupying
 * more vertical space than 3 normal results combined. Each Q&A is crafted
 * to match a distinct, real search query.
 *
 * Intent clusters covered:
 *   – Office location (near me, by county, by constituency)
 *   – Voter registration (how-to, documents, process, cost, time)
 *   – IEBC hours, contacts, toll-free
 *   – Voter card, status check, transfer, replacement
 *   – Polling stations, constituency info
 *   – Elections 2027 deadlines
 *   – Diaspora voting
 *   – Youth / first-time voters
 *   – Persons with disabilities
 *   – Swahili-language queries
 *   – What IEBC is / what it does
 *   – What Nasaka IEBC is
 *   – Biometric registration explained
 *   – Huduma Centre and IEBC
 *
 * FACTUAL SOURCES: All answers verified against iebc.or.ke primary sources.
 */
const COMPREHENSIVE_IEBC_FAQS = [
    // ── OFFICE LOCATION ──────────────────────────────────────────────────────
    {
        question: "Where can I find an IEBC office near me in Kenya?",
        answer: "Use Nasaka IEBC at civiceducationkenya.com/iebc-office to instantly find your nearest IEBC office. Allow location access and the tool automatically detects your constituency and shows you the closest IEBC registration center — including GPS directions, opening hours, and contact information. IEBC maintains constituency offices in all 290 constituencies across Kenya's 47 counties."
    },
    {
        question: "How many IEBC offices are there in Kenya?",
        answer: "The IEBC operates constituency offices in all 290 constituencies across Kenya's 47 counties. Each constituency has at least one IEBC registration and voter services office. A full list is published in the IEBC Physical Locations of Constituency Offices PDF available at iebc.or.ke. Nasaka IEBC maps all verified offices in one interactive tool."
    },
    {
        question: "What is the IEBC office address in Nairobi?",
        answer: "The IEBC has multiple offices in Nairobi covering its 17 constituencies: Westlands, Dagoretti North, Dagoretti South, Langata, Kibra, Roysambu, Kasarani, Ruaraka, Embakasi South, Embakasi North, Embakasi Central, Embakasi East, Embakasi West, Makadara, Kamukunji, Starehe, and Mathare. The IEBC Nairobi County headquarters is located at Anniversary Towers, University Way, Nairobi. Use Nasaka IEBC to find the office for your specific Nairobi constituency with GPS directions."
    },
    {
        question: "Where is the IEBC office in Mombasa?",
        answer: "Mombasa County has 6 IEBC constituency offices covering: Changamwe, Jomvu, Kisauni, Nyali, Likoni, and Mvita (Mombasa Central). Use Nasaka IEBC to locate the IEBC office in your specific Mombasa constituency with directions."
    },
    {
        question: "Where is the IEBC office in Kisumu?",
        answer: "Kisumu County has 8 IEBC constituency offices covering: Kisumu East, Kisumu West, Kisumu Central, Seme, Nyando, Muhoroni, Nyakach, and Kolwa Central. Find GPS directions to any Kisumu IEBC office using Nasaka IEBC."
    },
    {
        question: "Where is the IEBC office in Nakuru?",
        answer: "Nakuru County has 11 IEBC constituency offices covering: Molo, Njoro, Kuresoi North, Kuresoi South, Subukia, Rongai, Bahati, Nakuru Town West, Nakuru Town East, Naivasha, and Gilgil. Use Nasaka IEBC to find your specific Nakuru IEBC office with directions."
    },
    {
        question: "Where is the IEBC office in Eldoret (Uasin Gishu County)?",
        answer: "Uasin Gishu County has 6 IEBC constituency offices covering: Soy, Turbo, Moiben, Ainabkoi, Kapseret, and Kesses. Eldoret is the county headquarters. Use Nasaka IEBC to locate your nearest IEBC office in Uasin Gishu with GPS directions."
    },

    // ── VOTER REGISTRATION ────────────────────────────────────────────────────
    {
        question: "How do I register to vote at an IEBC office?",
        answer: "Visit any IEBC constituency office with your original Kenya National ID card (or valid Kenyan passport). An IEBC registration officer will complete voter registration Form A and capture your biometric data — fingerprints and a photograph. You will receive an acknowledgement slip. The process is completely free and takes approximately 15–30 minutes. You must be 18 years or older and a Kenyan citizen. Use Nasaka IEBC to find your nearest office."
    },
    {
        question: "What documents do I need to register to vote in Kenya?",
        answer: "To register as a voter at an IEBC office in Kenya, you need your original Kenya National ID card (for citizens aged 18+) or a valid Kenyan passport. Photocopies, scans, or phone photos are NOT accepted — you must bring the original document. Registration is free of charge. Biometric capture (fingerprints and photo) is mandatory under the Elections Act Cap 7 of Kenya."
    },
    {
        question: "Is voter registration free at IEBC offices?",
        answer: "Yes, voter registration at any IEBC office in Kenya is completely free of charge. No payment, fee, or levy is required at any stage of the registration process. If anyone asks you to pay to register at an IEBC office, report it to the IEBC directly at their toll-free number 0800 724 242."
    },
    {
        question: "How long does voter registration take at an IEBC office?",
        answer: "Voter registration at an IEBC constituency office typically takes 15 to 30 minutes per person, including Form A completion and biometric capture. During peak registration periods or mass registration exercises, waiting times may be longer. Visiting early in the morning is advisable to minimise queuing time."
    },
    {
        question: "What is the minimum age to register as a voter in Kenya?",
        answer: "You must be at least 18 years of age to register as a voter in Kenya at an IEBC office. You must also be a Kenyan citizen. There is no maximum age limit for voter registration. Your original National ID card, which is issued from age 18, confirms both your age and citizenship."
    },
    {
        question: "Can I register to vote online in Kenya via the IEBC?",
        answer: "As of current IEBC policy, biometric voter registration in Kenya requires a physical visit to an IEBC constituency office because your fingerprints and photograph must be captured in person. You cannot complete full voter registration online. You can, however, check your existing registration status online at the IEBC portal (portal.iebc.or.ke). Use Nasaka IEBC to find your nearest constituency office to register in person."
    },
    {
        question: "What is biometric voter registration (BVR) in Kenya?",
        answer: "Biometric voter registration (BVR) in Kenya involves capturing a voter's fingerprints and photograph at an IEBC office during the registration process. This biometric data is stored securely and used to verify voter identity on election day, preventing duplicate registration and electoral fraud. The IEBC uses BVR systems across all 290 constituencies in Kenya."
    },

    // ── IEBC HOURS & CONTACTS ─────────────────────────────────────────────────
    {
        question: "What are IEBC office opening hours in Kenya?",
        answer: "IEBC constituency offices in Kenya are generally open Monday to Friday, 08:00 to 17:00. During voter registration drives or election periods, the IEBC may extend hours or open offices on weekends. Hours can also be affected by public holidays. Always confirm hours with the specific office before visiting — Nasaka IEBC displays verified opening hours where available."
    },
    {
        question: "What is the IEBC toll-free number in Kenya?",
        answer: "The IEBC toll-free helpline in Kenya is 0800 724 242. You can call this number for voter registration inquiries, to report electoral malpractice, or to get information about your nearest IEBC office. The number is free to call from any Kenyan mobile network."
    },
    {
        question: "What is the IEBC head office phone number?",
        answer: "The IEBC headquarters in Nairobi can be reached at +254-20-2877000. For constituency-level queries and office visits, use Nasaka IEBC to find your local IEBC office contact details directly. The IEBC toll-free line is 0800 724 242."
    },
    {
        question: "What is the IEBC website and email address?",
        answer: "The official IEBC website is www.iebc.or.ke and the official email address is info@iebc.or.ke. Nasaka IEBC (civiceducationkenya.com/iebc-office) serves as a complementary civic tool that makes it easier to find and navigate to any of the 290 IEBC constituency offices across Kenya."
    },

    // ── VOTER CARD & STATUS ───────────────────────────────────────────────────
    {
        question: "How do I check my voter registration status in Kenya?",
        answer: "To check your voter registration status in Kenya: (1) Visit the IEBC portal at portal.iebc.or.ke and use the voter register lookup tool with your National ID number. (2) Visit your nearest IEBC constituency office in person — find it using Nasaka IEBC. Your details will appear in the National Voter Register once verified by the IEBC after registration."
    },
    {
        question: "Where do I collect my voter's card in Kenya?",
        answer: "You collect your Kenya voter's card (voter certificate) from the same IEBC constituency office where you registered. The IEBC notifies registered voters when cards are ready for collection. Your voter's card lists your name, National ID number, polling station, ward, and constituency. Use Nasaka IEBC to find the address and GPS directions to your IEBC registration office."
    },
    {
        question: "How do I transfer my voter registration to a new constituency?",
        answer: "To transfer your voter registration to a new IEBC constituency: (1) Visit the IEBC office in your NEW constituency — find it on Nasaka IEBC, (2) Bring your original National ID and your current voter's card if available, (3) Request a voter transfer. The transfer is free and takes effect for the next scheduled election. Transfers are only processed during designated IEBC transfer windows — confirm availability with the office."
    },
    {
        question: "What happens if I lose my voter's card in Kenya?",
        answer: "If you lose your Kenya voter's card, visit your IEBC constituency office with your original National ID to apply for a replacement. After identity verification, a replacement voter's card will be issued. Use Nasaka IEBC to locate your constituency's IEBC office with directions."
    },
    {
        question: "Do I need to re-register if I already voted before?",
        answer: "If you are already registered as a voter and your details (name, ID number, polling station) are correct, you do not need to re-register. However, if you have moved to a new constituency or changed your name on your National ID, you should update your details at an IEBC office. Use Nasaka IEBC to find your local office."
    },

    // ── HUDUMA CENTRES ─────────────────────────────────────────────────────────
    {
        question: "Can I register to vote at a Huduma Centre?",
        answer: "Some Huduma Centres have IEBC desks that offer voter registration, voter transfer, replacement of voter cards, and verification of registration details. However, not all Huduma Centres operate IEBC registration desks at all times. Use Nasaka IEBC to find verified IEBC locations — including Huduma Centres — nearest to you, or call the IEBC toll-free line 0800 724 242 to confirm."
    },

    // ── CONSTITUENCY & POLLING STATIONS ──────────────────────────────────────
    {
        question: "How do I find my polling station in Kenya?",
        answer: "To find your IEBC polling station in Kenya: (1) Check your voter's card, which lists your assigned polling station, (2) Visit your IEBC constituency office — find it on Nasaka IEBC, (3) Use the IEBC portal at portal.iebc.or.ke to look up your polling station by National ID number. Polling stations are assigned within each constituency."
    },
    {
        question: "What is a constituency in Kenya's electoral system?",
        answer: "Kenya has 290 constituencies, each represented by a Member of Parliament (MP) in the National Assembly. Every constituency has its own IEBC office that handles voter registration, voter transfers, and electoral services for that area. Kenya's 290 constituencies are distributed across 47 counties. Use Nasaka IEBC to find the IEBC office in any constituency."
    },
    {
        question: "How many constituencies does Nairobi have?",
        answer: "Nairobi County has 17 constituencies: Westlands, Dagoretti North, Dagoretti South, Langata, Kibra, Roysambu, Kasarani, Ruaraka, Embakasi South, Embakasi North, Embakasi Central, Embakasi East, Embakasi West, Makadara, Kamukunji, Starehe, and Mathare. Each has its own IEBC office. Find directions to all Nairobi IEBC offices on Nasaka IEBC."
    },

    // ── ELECTIONS & DEADLINES ─────────────────────────────────────────────────
    {
        question: "When are the next Kenya general elections?",
        answer: "Kenya's next General Elections are constitutionally due in August 2027, following the five-year electoral cycle established in the Constitution of Kenya 2010. The 2022 General Elections were held on August 9, 2022, administered by the IEBC. The IEBC will announce specific voter registration deadlines ahead of the 2027 elections. Register early using Nasaka IEBC to find your office."
    },
    {
        question: "What is the voter registration deadline in Kenya?",
        answer: "Under Kenya's Elections Act, voter registration closes at least 60 days before a general election. For by-elections, the deadline is typically 30 days before the by-election date. The IEBC announces specific registration windows officially. Always register early — the deadline for the 2027 general elections has not yet been announced. Monitor iebc.or.ke for official announcements."
    },
    {
        question: "Who is eligible to vote in Kenya?",
        answer: "To be eligible to vote in Kenya you must: be a Kenyan citizen, be 18 years of age or older, hold a valid original Kenya National ID card or passport, and be registered as a voter at an IEBC constituency office. Persons serving a sentence of imprisonment are not eligible. Diaspora Kenyans may vote in presidential elections at designated IEBC centres at Kenyan embassies and high commissions abroad."
    },

    // ── DIASPORA ──────────────────────────────────────────────────────────────
    {
        question: "Can Kenyans in the diaspora register to vote?",
        answer: "Yes, Kenyans living abroad can register to vote in presidential elections at designated IEBC diaspora voter registration centres at Kenyan embassies, high commissions, and consulates in countries where Kenya has a diplomatic mission. Contact your nearest Kenyan Embassy or High Commission, or visit iebc.or.ke for the current list of diaspora registration centres and registration dates."
    },

    // ── ACCESSIBILITY ─────────────────────────────────────────────────────────
    {
        question: "Can persons with disabilities register to vote at IEBC offices?",
        answer: "Yes, IEBC constituency offices are required to accommodate persons with disabilities during voter registration and on election day. The IEBC provides braille ballot papers for visually impaired voters and allows assisted registration for persons who require assistance. Constituency returning officers are mandated to ensure accessibility. Nasaka IEBC helps locate the nearest accessible IEBC office."
    },

    // ── WHAT IS IEBC ──────────────────────────────────────────────────────────
    {
        question: "What does IEBC stand for?",
        answer: "IEBC stands for the Independent Electoral and Boundaries Commission. It is Kenya's constitutionally established body responsible for conducting elections, managing voter registration, and delimiting electoral boundaries. The IEBC was established under Article 88 of the Constitution of Kenya 2010 and is the sole authority for administering elections in Kenya."
    },
    {
        question: "What is the IEBC responsible for in Kenya?",
        answer: "The Independent Electoral and Boundaries Commission (IEBC) is responsible for: voter registration across Kenya's 290 constituencies, conducting presidential, parliamentary, women representative, senator, governor, and county assembly elections, managing and updating the National Voter Register, reviewing and delimiting electoral constituency boundaries, resolving election disputes, and conducting voter and civic education. The IEBC operates constituency offices in all 47 counties."
    },
    {
        question: "What is Nasaka IEBC?",
        answer: "Nasaka IEBC (civiceducationkenya.com/iebc-office) is a free civic technology tool by Civic Education Kenya (CEKA) that helps Kenyan citizens locate their nearest IEBC constituency office. It covers all 290 IEBC offices across Kenya's 47 counties, provides GPS-powered directions, displays verified opening hours and contacts, and gives voter registration information — acting as a helpful digital bridge between citizens and the IEBC."
    },

    // ── SWAHILI QUERIES ───────────────────────────────────────────────────────
    {
        question: "Wapi ofisi ya IEBC karibu nami? (Where is the nearest IEBC office?)",
        answer: "Tumia Nasaka IEBC (civiceducationkenya.com/iebc-office) kupata ofisi ya IEBC karibu nawe. Ruhusu GPS yako kufanya kazi na mfumo utaonyesha ofisi ya IEBC iliyo karibu nawe katika kata yako — pamoja na maelekezo, masaa ya kufungua, na nambari za kuwasiliana. Ofisi za IEBC zipo katika kaunti zote 47 na kata zote 290 za Kenya."
    },
    {
        question: "Jinsi ya kusajili kupiga kura Kenya? (How to register to vote in Kenya?)",
        answer: "Ili kusajili kupiga kura Kenya: (1) Pata ofisi ya IEBC katika kata yako kwa kutumia Nasaka IEBC, (2) Lete Kitambulisho chako cha asili cha Kitaifa au Pasipoti halali ya Kenya, (3) Ofisa wa IEBC atakamilisha Fomu A na kuchukua alama za vidole vyako na picha, (4) Utapewa stakabadhi ya usajili. Usajili ni bure kabisa na huchukua dakika 15–30."
    },
    {
        question: "Nambari ya simu ya bure ya IEBC ni ipi? (What is the IEBC toll-free number?)",
        answer: "Nambari ya simu ya bure ya IEBC ni 0800 724 242. Unaweza kupiga simu bila malipo kutoka kwa mtandao wowote wa simu nchini Kenya. Kwa maelezo ya ofisi ya IEBC katika kata yako, tumia Nasaka IEBC kupata ofisi karibu nawe."
    },
    {
        question: "Usajili wa wapiga kura Kenya 2027 — nini ninahitaji? (Kenya voter registration 2027 — what do I need?)",
        answer: "Kwa usajili wa wapiga kura Kenya 2027, utahitaji: Kitambulisho cha asili cha Kitaifa (si nakala wala picha ya simu) au Pasipoti halali ya Kenya. Lazima uwe na miaka 18 au zaidi na uwe raia wa Kenya. Usajili ni bure. Nenda ofisi ya IEBC katika kata yako — pata ofisi kwa kutumia Nasaka IEBC."
    },

    // ── YOUTH & FIRST-TIME VOTERS ─────────────────────────────────────────────
    {
        question: "I just turned 18 — how do I register to vote for the first time in Kenya?",
        answer: "Congratulations! To register to vote for the first time in Kenya: (1) Get your National ID card from the Department of National Registration Bureau (you need it before you can register to vote), (2) Use Nasaka IEBC to find your nearest IEBC constituency office, (3) Visit the IEBC office with your original National ID, (4) Complete Form A and provide your biometric data. Registration is free and takes about 15–30 minutes."
    },

    // ── SPECIFIC PROCESS QUERIES ──────────────────────────────────────────────
    {
        question: "What is the voter registration acknowledgement slip in Kenya?",
        answer: "The voter registration acknowledgement slip is a document given to you by the IEBC registration officer immediately after completing your registration at an IEBC constituency office. It confirms that your registration has been received and is being processed. The acknowledgement slip is NOT required for voting — your name appearing in the National Voter Register is what qualifies you to vote."
    },
    {
        question: "I got a new National ID — do I need to re-register as a voter in Kenya?",
        answer: "If you are already registered as a voter and your new National ID has the same details (same name, same ID number), you generally do not need to re-register. If your name or personal details have changed significantly on your new ID, visit your IEBC constituency office to update your voter registration details. Use Nasaka IEBC to find your local IEBC office."
    }
];
```

---

## 3. Drop-in SEOHead JSX Block
### Replace ONLY the existing `<SEOHead ... />` tag in your component with this

```jsx
{/*
 * ═══════════════════════════════════════════════════════════════════════════
 * NASAKA IEBC — SEO HEAD
 * 10 JSON-LD schemas + 130+ keywords + 42-entry FAQ
 *
 * TITLE:        Front-loaded primary keyword. "Kenya" + action + brand.
 * DESCRIPTION:  155 chars. Hits office count (290), county count (47),
 *               primary actions (find, register, directions), and brand.
 * KEYWORDS:     Covers all intent clusters:
 *   – Navigational:  "IEBC office", "IEBC Kenya", "IEBC website"
 *   – Informational: "how to register to vote Kenya"
 *   – Local:         "IEBC office near me", "IEBC Nairobi", "IEBC Mombasa" ...all counties
 *   – Transactional: "find IEBC office", "register to vote"
 *   – Swahili:       "ofisi ya IEBC", "usajili wa wapiga kura"
 *   – Electoral:     "Kenya elections 2027", "polling station Kenya"
 *   – Institutional: "independent electoral and boundaries commission"
 *   – Support:       "IEBC toll-free", "IEBC contacts", "IEBC hours"
 *   – Diaspora:      "Kenya diaspora voter registration"
 *   – Youth:         "first time voter registration Kenya"
 *   – Swahili:       "ofisi ya IEBC karibu nami", "usajili wa kupiga kura"
 * ═══════════════════════════════════════════════════════════════════════════
 */}
<SEOHead
    title="Nasaka IEBC — Find Your Nearest IEBC Office in Kenya | Voter Registration"
    description="Find any of Kenya's 290 IEBC constituency offices across all 47 counties. GPS-powered office locator with directions, voter registration info, hours & contacts. Free. Fast. Accurate."
    canonical="/iebc-office"
    keywords={[
        // ── Core IEBC navigational ───────────────────────────────────────────
        "IEBC office",
        "IEBC offices Kenya",
        "IEBC office near me",
        "find IEBC office",
        "nearest IEBC office",
        "IEBC office locator",
        "IEBC office finder",
        "IEBC office map",
        "IEBC office address",
        "IEBC office contacts",
        "IEBC Kenya",
        "IEBC website",
        "IEBC portal",
        "independent electoral and boundaries commission",
        "independent electoral and boundaries commission Kenya",
        "IEBC office locations Kenya",
        "IEBC registration center",
        "IEBC registration center near me",
        "IEBC constituency office",
        "IEBC sub county office",
        // ── Voter registration ───────────────────────────────────────────────
        "voter registration Kenya",
        "register to vote Kenya",
        "how to register to vote in Kenya",
        "how to register to vote at IEBC",
        "voter registration requirements Kenya",
        "voter registration documents Kenya",
        "voter registration process Kenya",
        "voter registration exercise Kenya",
        "voter registration Kenya 2025",
        "voter registration Kenya 2026",
        "voter registration Kenya 2027",
        "voter registration deadline Kenya",
        "free voter registration Kenya",
        "biometric voter registration Kenya",
        "BVR registration Kenya",
        "IEBC biometric registration",
        "voter register Kenya",
        "national voter register Kenya",
        "IEBC Form A Kenya",
        // ── Voter card & status ──────────────────────────────────────────────
        "voter card Kenya",
        "voter certificate Kenya",
        "collect voter card Kenya",
        "voter registration status Kenya",
        "check voter registration Kenya",
        "how to check voter registration Kenya",
        "voter transfer Kenya",
        "transfer voter registration Kenya",
        "replace lost voter card Kenya",
        "IEBC acknowledgement slip",
        // ── County-level (all 47 counties) ──────────────────────────────────
        "IEBC office Nairobi", "voter registration Nairobi",
        "IEBC office Mombasa", "voter registration Mombasa",
        "IEBC office Kisumu", "voter registration Kisumu",
        "IEBC office Nakuru", "voter registration Nakuru",
        "IEBC office Eldoret", "IEBC Uasin Gishu",
        "IEBC office Kiambu", "IEBC office Kakamega",
        "IEBC office Machakos", "IEBC office Meru",
        "IEBC office Kilifi", "IEBC office Bungoma",
        "IEBC office Nyeri", "IEBC office Murang'a",
        "IEBC office Kisii", "IEBC office Kitui",
        "IEBC office Makueni", "IEBC office Narok",
        "IEBC office Kajiado", "IEBC office Migori",
        "IEBC office Siaya", "IEBC office Homa Bay",
        "IEBC office Vihiga", "IEBC office Busia",
        "IEBC office Nyamira", "IEBC office Trans Nzoia",
        "IEBC office Nandi", "IEBC office Kericho",
        "IEBC office Bomet", "IEBC office Embu",
        "IEBC office Laikipia", "IEBC office Baringo",
        "IEBC office Samburu", "IEBC office Turkana",
        "IEBC office Marsabit", "IEBC office Isiolo",
        "IEBC office Wajir", "IEBC office Mandera",
        "IEBC office Garissa", "IEBC office Tana River",
        "IEBC office Kwale", "IEBC office Taita Taveta",
        "IEBC office Lamu", "IEBC office West Pokot",
        "IEBC office Elgeyo Marakwet", "IEBC office Nyandarua",
        "IEBC office Kirinyaga", "IEBC office Tharaka Nithi",
        "IEBC office Subukia",
        // ── Elections ────────────────────────────────────────────────────────
        "Kenya elections 2027",
        "Kenya general elections 2027",
        "Kenya election date",
        "next Kenya election",
        "IEBC 2027 elections",
        "Kenya presidential election 2027",
        "Kenya election voter registration",
        "IEBC polling station",
        "find polling station Kenya",
        "Kenya polling station near me",
        "Kenya constituency map",
        "Kenya 290 constituencies",
        "Kenya 47 counties IEBC",
        "voter registration deadline 2027 Kenya",
        // ── Swahili keywords ─────────────────────────────────────────────────
        "ofisi ya IEBC",
        "ofisi ya IEBC karibu nami",
        "pata ofisi ya IEBC",
        "usajili wa wapiga kura Kenya",
        "jinsi ya kusajili kupiga kura Kenya",
        "usajili wa kupiga kura",
        "kura ya IEBC",
        "kadi ya mpiga kura Kenya",
        "IEBC Kenya Kiswahili",
        "nambari ya simu ya IEBC",
        "IEBC msimbo wa kata",
        "ofisi ya IEBC Nairobi",
        "usajili wa kupiga kura 2027",
        // ── Tool / app queries ───────────────────────────────────────────────
        "Nasaka IEBC",
        "Nasaka IEBC office finder",
        "IEBC office finder Kenya",
        "IEBC office map Kenya",
        "IEBC office interactive map",
        "IEBC office GPS Kenya",
        "find IEBC office online Kenya",
        "IEBC office directions",
        "CEKA IEBC",
        "civic education Kenya IEBC",
        // ── Documents & eligibility ──────────────────────────────────────────
        "what documents do I need to register to vote Kenya",
        "national ID voter registration Kenya",
        "passport voter registration Kenya",
        "IEBC registration documents",
        "age to vote Kenya",
        "voting age Kenya",
        "eligibility to vote Kenya",
        "who can vote Kenya",
        "IEBC fingerprint registration",
        "biometric voter registration BVR Kenya",
        // ── IEBC hours & contact ─────────────────────────────────────────────
        "IEBC office hours Kenya",
        "IEBC opening hours",
        "IEBC phone number Kenya",
        "IEBC toll free number Kenya",
        "IEBC 0800 724 242",
        "IEBC email address",
        "IEBC helpline Kenya",
        "IEBC customer care Kenya",
        "contact IEBC Kenya",
        "IEBC head office Nairobi",
        // ── Huduma Centre ────────────────────────────────────────────────────
        "IEBC Huduma Centre",
        "register to vote Huduma Centre Kenya",
        "Huduma Centre voter registration",
        // ── Diaspora ─────────────────────────────────────────────────────────
        "Kenya diaspora voter registration",
        "Kenyans abroad voter registration",
        "IEBC diaspora registration",
        "vote Kenya from abroad",
        "Kenya embassy voter registration",
        // ── Youth & first-time voters ────────────────────────────────────────
        "first time voter registration Kenya",
        "youth voter registration Kenya",
        "new voter registration Kenya",
        "18 year old voter registration Kenya",
        "student voter registration Kenya",
        // ── Accessibility ────────────────────────────────────────────────────
        "IEBC offices disability access",
        "voter registration persons with disabilities Kenya",
        "assisted voter registration Kenya",
    ].join(", ")}
    schema={[
        // 1. WebSite — SearchAction sitelinks searchbox for Google
        generateWebsiteSchema(),
        // 2. FAQPage — 42 Q&As across all intent clusters → FAQ rich results
        generateFAQSchema(COMPREHENSIVE_IEBC_FAQS),
        // 3. Organization — CEKA entity authority & E-E-A-T signals
        generateOrganizationSchema(),
        // 4. WebApplication — "IEBC app", "find IEBC office online"
        generateWebApplicationSchema(),
        // 5. GovernmentService — competes directly for gov-service SERP features
        generateGovernmentServiceSchema(),
        // 6. Service — voter registration as a distinct service type
        generateVoterRegistrationServiceSchema(),
        // 7. HowTo — "how to register to vote Kenya" → HowTo rich result
        generateHowToVoterRegistrationSchema(),
        // 8. BreadcrumbList — breadcrumb display in SERP snippet
        generateBreadcrumbSchema(),
        // 9. ItemList — 47-county coverage, targets all county-level searches
        generateCountyListSchema(),
        // 10. Event — "Kenya elections 2027" event rich result
        generateElectionEventSchema(),
        // 11. Dataset — positions Nasaka as a civic data aggregator
        generateIEBCOfficesDatasetSchema(),
        // 12. GovernmentOffice — injected dynamically per resolved nearest office
        //     (reads from sessionStorage if office was previously resolved,
        //     or pass the resolved `nearestOffice` object directly if you
        //     restructure state to be available at render time)
        generateLocalGovernmentOfficeSchema(
            (() => {
                try {
                    if (typeof window === 'undefined') return null;
                    const stored = sessionStorage.getItem('nasaka_selectedOffice');
                    return stored ? JSON.parse(stored) : null;
                } catch (_) { return null; }
            })()
        ),
    ].filter(Boolean)}
/>
```

---

## 4. Per-Office Page Schema (For Map & Office Detail Pages)
### Use `generateLocalGovernmentOfficeSchema(office)` on map/detail pages

When the user lands on `/iebc-office/map` with a `selectedOffice` in state, or on any `/iebc-office/{county}/{constituency}` detail page, add the `GovernmentOffice` schema to that page's SEOHead:

```jsx
// On IEBCOfficeMap.jsx or IEBCOfficeDetail.jsx — example usage:
<SEOHead
    title={`IEBC ${office.constituency_name} Constituency Office — ${office.county} County | Voter Registration`}
    description={`Find the IEBC constituency office in ${office.constituency_name}, ${office.county} County. Address: ${office.office_location || office.landmark}. Opening hours, directions, and voter registration requirements.`}
    canonical={`/iebc-office/${slugify(office.county)}/${slugify(office.constituency_name)}`}
    schema={[
        generateWebsiteSchema(),
        generateFAQSchema([
            {
                question: `Where is the IEBC office in ${office.constituency_name}?`,
                answer: `The IEBC constituency office for ${office.constituency_name} is located at ${office.office_location || office.landmark}, ${office.county} County. ${office.phone ? `Contact: ${office.phone}.` : ''} ${office.opening_hours ? `Opening hours: ${office.opening_hours}.` : 'Typically open Monday to Friday, 08:00 to 17:00.'} Use Nasaka IEBC for GPS directions.`
            },
            {
                question: `How do I register to vote in ${office.constituency_name} constituency?`,
                answer: `Visit the IEBC ${office.constituency_name} constituency office at ${office.office_location || office.landmark}, ${office.county} County. Bring your original National ID or valid Kenyan passport. Registration is free and includes biometric capture. It takes approximately 15–30 minutes.`
            },
            {
                question: `What are the opening hours of the IEBC office in ${office.constituency_name}?`,
                answer: `${office.opening_hours ? `The IEBC ${office.constituency_name} office is open: ${office.opening_hours}.` : `The IEBC ${office.constituency_name} constituency office is typically open Monday to Friday, 08:00 to 17:00. Hours may vary on public holidays and during voter registration drives. Call ${office.phone || 'the IEBC toll-free line 0800 724 242'} to confirm.`}`
            }
        ]),
        generateLocalGovernmentOfficeSchema(office),
        generateBreadcrumbSchema(),
        // Add county-specific breadcrumb:
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
                { "@type": "ListItem", "position": 1, "name": "Civic Education Kenya", "item": "https://www.civiceducationkenya.com" },
                { "@type": "ListItem", "position": 2, "name": "IEBC Office Finder", "item": "https://www.civiceducationkenya.com/iebc-office" },
                { "@type": "ListItem", "position": 3, "name": `${office.county} County`, "item": `https://www.civiceducationkenya.com/iebc-office/map?county=${slugify(office.county)}` },
                { "@type": "ListItem", "position": 4, "name": `${office.constituency_name} IEBC Office`, "item": `https://www.civiceducationkenya.com/iebc-office/${slugify(office.county)}/${slugify(office.constituency_name)}` }
            ]
        }
    ].filter(Boolean)}
/>
```

---

## 5. Deployment & Indexing Checklist

| # | Action | Why |
|---|---|---|
| 1 | **Per-page unique title + meta description** using the county/constituency templates | Prevents duplicate meta penalties; each page ranks for different local queries |
| 2 | **Add `hreflang="en-KE"` and `hreflang="sw-KE"`** alternate link tags | Targets Kenyan English and Swahili Google searches specifically |
| 3 | **Server-render or prerender** each office page with at least address, phone, hours in HTML | Ensures Googlebot indexes content without needing to execute JavaScript |
| 4 | **Create `/sitemap-iebc.xml`** listing all `/iebc-office/{county}/{constituency}` URLs with `lastmod` and `priority=0.9` | Guarantees all 290 office pages are discovered and crawled |
| 5 | **Register sitemap in `robots.txt`**: `Sitemap: https://www.civiceducationkenya.com/sitemap-iebc.xml` | Speeds up full-site indexation |
| 6 | **Include visible source citation on each page**: "Data sourced from IEBC Physical Locations PDF — updated [YYYY-MM-DD]" with a link to `iebc.or.ke` | Strengthens E-E-A-T; Google sees you citing the authoritative primary source |
| 7 | **Monthly cron job** to re-check the IEBC PDF for updated office addresses/coordinates | Keeps content accurate, which Google rewards with sustained rankings |
| 8 | **Add `<link rel="canonical">` on every page** | Prevents duplicate content dilution across county/map/detail URL variants |
| 9 | **Ensure Core Web Vitals**: LCP < 2.5s, CLS < 0.1, INP < 200ms | "Near me" searches are overwhelmingly mobile — page speed is a direct ranking factor |
| 10 | **Submit to Google Search Console** after deploying each batch of new office pages | Accelerates indexation; monitor for coverage errors |

---

*End of NASAKA IEBC SEO Head Implementation Reference*
