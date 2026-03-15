export const config = { runtime: 'edge' };

// Nasaka IEBC — Public Pricing Endpoint
// Returns all tiers, prices, features, and Paystack plan codes dynamically.
// No auth required. Frontend fetches this to render PricingPage — no hardcoded prices.

export default async function handler(req: Request): Promise<Response> {
    const headers: Record<string, string> = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'X-API-Key, Content-Type',
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { headers });
    }

    if (req.method !== 'GET') {
        return Response.json({ error: 'Method not allowed' }, { status: 405, headers });
    }

    const pricing = {
        tiers: [
            {
                id: 'jamii',
                name: 'Jamii',
                subtitle: 'Community',
                price_kes: 0,
                price_usd: 0,
                billing: 'free',
                monthly_limit: 5000,
                burst_rate: '2 req/s',
                features: [
                    'System stats (GET /stats)',
                    'Office registry (GET /offices)',
                    'Polling station locator (GET /locate)',
                    'County directory (GET /counties)',
                    'Health check (GET /health)',
                    'JSON format only'
                ],
                blocked: [
                    'Boundary lookup (/boundary)',
                    'GeoJSON export',
                    'CSV export',
                    'Coordinate dataset (/coordinates)'
                ],
                cta: 'Get Free API Key',
                highlighted: false
            },
            {
                id: 'mwananchi',
                name: 'Mwananchi',
                subtitle: 'Civic Developer',
                price_kes_monthly: 2500,
                price_kes_annual: 25000,
                price_usd_monthly: 19,
                price_usd_annual: 190,
                annual_savings_kes: 5000,
                billing_options: ['monthly', 'annual'],
                monthly_limit: 100000,
                burst_rate: '10 req/s',
                overage_kes_per_10k: 150,
                features: [
                    'Everything in Jamii',
                    'GeoJSON export',
                    'CSV export',
                    'Boundary lookup (/boundary)',
                    'Full coordinate dataset (/coordinates)',
                    '100,000 requests/month'
                ],
                paystack_plan_codes: {
                    monthly: process.env.PAYSTACK_MWANANCHI_PLAN_CODE_MONTHLY || null,
                    annual: process.env.PAYSTACK_MWANANCHI_PLAN_CODE_ANNUAL || null
                },
                cta: 'Start Mwananchi',
                highlighted: true
            },
            {
                id: 'taifa',
                name: 'Taifa',
                subtitle: 'Institutional',
                price_kes_monthly: 8000,
                price_kes_annual: 80000,
                price_usd_monthly: 62,
                price_usd_annual: 620,
                annual_savings_kes: 16000,
                billing_options: ['monthly', 'annual'],
                monthly_limit: 500000,
                burst_rate: '30 req/s',
                overage_kes_per_10k: 100,
                features: [
                    'Everything in Mwananchi',
                    'Versioned quarterly snapshots',
                    'Priority email support (72h SLA)',
                    'Usage dashboard',
                    '500,000 requests/month',
                    'Weighted endpoint credits'
                ],
                paystack_plan_codes: {
                    monthly: process.env.PAYSTACK_TAIFA_PLAN_CODE_MONTHLY || null,
                    annual: process.env.PAYSTACK_TAIFA_PLAN_CODE_ANNUAL || null
                },
                cta: 'Start Taifa',
                highlighted: false
            },
            {
                id: 'serikali',
                name: 'Serikali',
                subtitle: 'Enterprise / Government',
                price_kes_monthly: 25000,
                billing: 'custom',
                monthly_limit: null,
                burst_rate: '100+ req/s',
                features: [
                    'Everything in Taifa',
                    'SFTP/secure data dump',
                    'Uptime SLA contract',
                    'Legal data license',
                    'Onboarding call',
                    'Named account contact',
                    'Custom boundary layers',
                    'Full audit log exports'
                ],
                cta: 'Contact Us',
                highlighted: false,
                contact_only: true
            }
        ],
        credit_packs: [
            { id: 'credit_50k', credits: 50000, price_kes: 3500, product_key: 'credit_50k' },
            { id: 'credit_200k', credits: 200000, price_kes: 10000, product_key: 'credit_200k' },
            { id: 'credit_500k', credits: 500000, price_kes: 20000, product_key: 'credit_500k' }
        ],
        credit_weights: {
            standard_lookup: 1,
            boundary_lookup: 5,
            csv_export_per_1k_rows: 3
        },
        data_licenses: [
            { id: 'license_academic', name: 'Academic/Research', price_kes: 15000, period: 'year', product_key: 'license_academic' },
            { id: 'license_commercial', name: 'Commercial', price_kes: 40000, period: 'year', product_key: 'license_commercial' }
        ],
        discounts: {
            nonprofit_academic: '50% off Mwananchi and Taifa tiers',
            requirement: 'Registration certificate or institutional email required',
            apply_url: 'https://nasakaiebc.civiceducationkenya.com/dashboard/discount-apply'
        },
        paystack_public_key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || process.env.PAYSTACK_PUBLIC_KEY || null,
        currency: 'KES',
        note: 'Credit packs never expire. All prices in Kenya Shillings (KES).'
    };

    return Response.json({ data: pricing }, { status: 200, headers });
}
