import { calculateRequestWeight, TIER_LIMITS } from './api-auth';

async function testPricingEngine() {
    console.log("--- Testing GOHAM Pricing Engine ---");

    const mockReq = (url: string) => ({ url, headers: new Map() } as unknown as Request);

    // Test 1: Standard Office Request (Jamii)
    const weight1 = calculateRequestWeight(mockReq('http://localhost/api/v1/offices'), 'jamii');
    console.log(`Standard Office (Jamii): ${weight1} (Expected base weight * jamii multiplier)`);

    // Test 2: Boundary Request (National)
    const weight2 = calculateRequestWeight(mockReq('http://localhost/api/v1/boundary'), 'taifa');
    console.log(`Boundary (Taifa): ${weight2} (Expected 10.0 * 1.0)`);

    // Test 3: CSV Export (Mwananchi)
    const weight3 = calculateRequestWeight(mockReq('http://localhost/api/v1/offices?format=csv'), 'mwananchi');
    console.log(`CSV Export (Mwananchi): ${weight3} (Expected 5.0 * 1.2)`);

    // Test 4: Peak Hour Surge
    // Note: This matches the current system time in the environment
    const weight4 = calculateRequestWeight(mockReq('http://localhost/api/v1/offices'), 'public');
    console.log(`Public Request (Now): ${weight4} (Includes 5.0 base + possible surge)`);

    console.log("\n--- Tier Metadata Verification ---");
    console.log("Public Allowed Filters:", TIER_LIMITS.public.allowed_filters);
    console.log("Jamii Allowed Filters:", TIER_LIMITS.jamii.allowed_filters);
    console.log("Taifa Allowed Filters:", TIER_LIMITS.taifa.allowed_filters);
}

testPricingEngine().catch(console.error);
