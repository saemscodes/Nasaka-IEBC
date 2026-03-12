/**
 * Multi-Source Consensus Geocoder for Nasaka IEBC
 *
 * Queries Nominatim, Google Maps URL, Geocode.xyz, Geokeo, and Gemini AI
 * simultaneously, then uses weighted-cluster voting to select the most
 * accurate coordinate.  Designed for both browser (admin dashboard) and
 * server-side (Vercel Edge Function) execution.
 *
 * @module lib/geocoder
 */

import { supabase } from "@/integrations/supabase/client";

// ─── Type Definitions ────────────────────────────────────────────────────────

export type GeocoderSource =
    | "nominatim"
    | "google_maps_url"
    | "geocode_xyz"
    | "geokeo"
    | "gemini_ai";

export interface GeocoderResult {
    lat: number;
    lng: number;
    source: GeocoderSource;
    confidence: number;
    displayName?: string;
    rawResponse?: unknown;
}

export interface ConsensusResult {
    lat: number;
    lng: number;
    confidence: number;
    sources: GeocoderResult[];
    agreementCount: number;
    spreadKm: number;
}

export interface IEBCOffice {
    id: number;
    county: string;
    constituency_name: string;
    office_location?: string;
    latitude: number | null;
    longitude: number | null;
}

export interface VerificationIssue {
    type: "DISPLACED" | "NULL_COORDS" | "CLUSTERING";
    office: IEBCOffice;
    displacementKm?: number;
    clusteringOffices?: IEBCOffice[];
}

export interface VerificationResult {
    issue: VerificationIssue;
    consensus: ConsensusResult | null;
    autoApplied: boolean;
    flaggedForHITL: boolean;
    auditId?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DISPLACEMENT_THRESHOLD_KM = 5;
const CLUSTERING_THRESHOLD_KM = 0.2;
const CONFIDENCE_AUTO_APPLY_THRESHOLD = 0.7;
const CONSENSUS_AGREEMENT_RADIUS_KM = 1.0;

const KENYA_BOUNDS = { latMin: -5.0, latMax: 5.0, lngMin: 33.9, lngMax: 42.0 };

// ─── Rate Limiter ────────────────────────────────────────────────────────────

class RateLimiter {
    private queue: Array<() => void> = [];
    private lastCallTime = 0;
    private intervalMs: number;
    private dailyLimit: number | null;
    private dailyCount = 0;
    private dailyResetTime = Date.now() + 86400000;

    constructor(requestsPerSecond: number, dailyLimit: number | null = null) {
        this.intervalMs = 1000 / requestsPerSecond;
        this.dailyLimit = dailyLimit;
    }

    async throttle(): Promise<void> {
        if (this.dailyLimit !== null) {
            if (Date.now() > this.dailyResetTime) {
                this.dailyCount = 0;
                this.dailyResetTime = Date.now() + 86400000;
            }
            if (this.dailyCount >= this.dailyLimit) {
                throw new Error("Daily rate limit reached for this geocoding source.");
            }
        }

        return new Promise((resolve) => {
            const now = Date.now();
            const timeSinceLast = now - this.lastCallTime;
            const delay = Math.max(0, this.intervalMs - timeSinceLast);

            this.queue.push(() => {
                this.lastCallTime = Date.now();
                if (this.dailyLimit !== null) this.dailyCount++;
                resolve();
            });

            setTimeout(() => {
                const next = this.queue.shift();
                if (next) next();
            }, delay);
        });
    }
}

const nominatimLimiter = new RateLimiter(1);
const geocodeXyzLimiter = new RateLimiter(1);
const geokeoLimiter = new RateLimiter(10, 2500);
const geminiLimiter = new RateLimiter(1);

// ─── Utilities ───────────────────────────────────────────────────────────────

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function isInKenya(lat: number, lng: number): boolean {
    return (
        lat >= KENYA_BOUNDS.latMin &&
        lat <= KENYA_BOUNDS.latMax &&
        lng >= KENYA_BOUNDS.lngMin &&
        lng <= KENYA_BOUNDS.lngMax
    );
}

function buildSearchQuery(office: IEBCOffice): string {
    return `${office.constituency_name} IEBC office ${office.county} county Kenya`;
}

// ─── Individual Geocoders ────────────────────────────────────────────────────

export async function geocodeNominatim(office: IEBCOffice): Promise<GeocoderResult | null> {
    await nominatimLimiter.throttle();
    const query = buildSearchQuery(office);

    try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=ke&format=json&limit=1&addressdetails=1`;
        const response = await fetch(url, {
            headers: {
                "User-Agent": "NasakaIEBC/1.0 (civiceducationkenya.com)",
                "Accept-Language": "en",
            },
        });
        if (!response.ok) return null;
        const data = await response.json();
        if (!data || data.length === 0) return null;

        const result = data[0];
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        if (isNaN(lat) || isNaN(lng) || !isInKenya(lat, lng)) return null;

        return {
            lat,
            lng,
            source: "nominatim",
            confidence: result.importance ? Math.min(result.importance * 1.5, 1.0) : 0.5,
            displayName: result.display_name,
            rawResponse: result,
        };
    } catch {
        return null;
    }
}

export async function geocodeGoogleMapsURL(office: IEBCOffice): Promise<GeocoderResult | null> {
    const query = buildSearchQuery(office);
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;

    try {
        const response = await fetch(searchUrl, { method: "GET", redirect: "follow" });
        const finalUrl = response.url;

        const coordsRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
        let match = finalUrl.match(coordsRegex);

        if (!match) {
            const bodyText = await response.text();
            const bodyMatch = bodyText.match(/\/@(-?\d+\.\d+),(-?\d+\.\d+)/);
            if (!bodyMatch) return null;
            match = bodyMatch;
        }

        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        if (isNaN(lat) || isNaN(lng) || !isInKenya(lat, lng)) return null;

        return {
            lat,
            lng,
            source: "google_maps_url",
            confidence: 0.65,
            displayName: query,
            rawResponse: { url: finalUrl },
        };
    } catch {
        return null;
    }
}

export async function geocodeGeocodeXyz(office: IEBCOffice): Promise<GeocoderResult | null> {
    await geocodeXyzLimiter.throttle();
    const query = buildSearchQuery(office);

    try {
        const url = `https://geocode.xyz/${encodeURIComponent(query)}?json=1&region=KE`;
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        if (!data || data.error || !data.latt || !data.longt) return null;

        const lat = parseFloat(data.latt);
        const lng = parseFloat(data.longt);
        if (isNaN(lat) || isNaN(lng) || !isInKenya(lat, lng)) return null;

        const confidence = data.confidence
            ? Math.min(parseFloat(data.confidence) / 100, 1.0)
            : 0.45;

        return {
            lat,
            lng,
            source: "geocode_xyz",
            confidence,
            displayName: data.standard?.addresst ?? query,
            rawResponse: data,
        };
    } catch {
        return null;
    }
}

export async function geocodeGeokeo(office: IEBCOffice): Promise<GeocoderResult | null> {
    await geokeoLimiter.throttle();

    const apiKey = (typeof import.meta !== "undefined" && import.meta.env?.VITE_GEOKEO_API_KEY) ||
        (typeof process !== "undefined" && process.env?.VITE_GEOKEO_API_KEY);
    if (!apiKey) return null;

    const query = buildSearchQuery(office);

    try {
        const url = `https://geokeo.com/geocode/v1/search.php?q=${encodeURIComponent(query)}&api=${apiKey}`;
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        if (!data || data.status !== "200" || !data.results || data.results.length === 0) return null;

        const result = data.results[0];
        const lat = parseFloat(result.geometry.location.lat);
        const lng = parseFloat(result.geometry.location.lng);
        if (isNaN(lat) || isNaN(lng) || !isInKenya(lat, lng)) return null;

        return {
            lat,
            lng,
            source: "geokeo",
            confidence: 0.6,
            displayName: result.formatted_address,
            rawResponse: result,
        };
    } catch {
        return null;
    }
}

export async function geocodeGemini(office: IEBCOffice): Promise<GeocoderResult | null> {
    await geminiLimiter.throttle();

    const apiKey = (typeof import.meta !== "undefined" && import.meta.env?.VITE_GEMINI_API_KEY) ||
        (typeof process !== "undefined" && process.env?.VITE_GEMINI_API_KEY);
    if (!apiKey) return null;

    const prompt = `What are the GPS coordinates of the ${office.constituency_name} IEBC office in ${office.county} County, Kenya?

Return ONLY a valid JSON object in this exact format with no other text:
{"lat": <latitude as number>, "lng": <longitude as number>}

If you are not certain, return: {"lat": null, "lng": null}`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.0, maxOutputTokens: 100 },
                }),
            }
        );
        if (!response.ok) return null;
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return null;

        const jsonMatch = text.match(/\{[^}]+\}/);
        if (!jsonMatch) return null;

        let parsed: { lat: number | null; lng: number | null };
        try {
            parsed = JSON.parse(jsonMatch[0]);
        } catch {
            return null;
        }
        if (parsed.lat === null || parsed.lng === null) return null;

        const lat = Number(parsed.lat);
        const lng = Number(parsed.lng);
        if (isNaN(lat) || isNaN(lng) || !isInKenya(lat, lng)) return null;

        // Gemini gets lowest confidence (0.4) to mitigate hallucination risk
        return {
            lat,
            lng,
            source: "gemini_ai",
            confidence: 0.4,
            displayName: `${office.constituency_name} (Gemini AI)`,
            rawResponse: parsed,
        };
    } catch {
        return null;
    }
}

// ─── Multi-Source Resolver ───────────────────────────────────────────────────

export async function runMultiSourceResolver(office: IEBCOffice): Promise<GeocoderResult[]> {
    const results = await Promise.allSettled([
        geocodeNominatim(office),
        geocodeGoogleMapsURL(office),
        geocodeGeocodeXyz(office),
        geocodeGeokeo(office),
        geocodeGemini(office),
    ]);

    return results
        .filter(
            (r): r is PromiseFulfilledResult<GeocoderResult | null> =>
                r.status === "fulfilled"
        )
        .map((r) => r.value)
        .filter((v): v is GeocoderResult => v !== null);
}

// ─── Consensus Engine ────────────────────────────────────────────────────────
//
// Concrete confidence formula:
//   compositeConfidence = (agreementRatio × 0.6) + (avgSourceConfidence × 0.4)
//
//   agreementRatio = sourcesInWinningCluster / totalSourcesReturned
//   avgSourceConfidence = mean of individual source confidence scores in cluster
//
// Sources are grouped into clusters: any two results within
// CONSENSUS_AGREEMENT_RADIUS_KM (1 km) of each other belong to the same
// cluster.  The cluster with the highest cumulative confidence-weighted score
// wins.  Outliers (sources not in the winning cluster) are discarded.

export function computeConsensus(results: GeocoderResult[]): ConsensusResult | null {
    if (results.length === 0) return null;

    // Group into proximity clusters
    const groups: GeocoderResult[][] = [];
    for (const result of results) {
        let addedToGroup = false;
        for (const group of groups) {
            const groupCenter = group[0];
            const distKm = haversineKm(result.lat, result.lng, groupCenter.lat, groupCenter.lng);
            if (distKm <= CONSENSUS_AGREEMENT_RADIUS_KM) {
                group.push(result);
                addedToGroup = true;
                break;
            }
        }
        if (!addedToGroup) {
            groups.push([result]);
        }
    }

    // Pick cluster with highest cumulative confidence score
    groups.sort((a, b) => {
        const scoreA = a.reduce((sum, r) => sum + r.confidence, 0);
        const scoreB = b.reduce((sum, r) => sum + r.confidence, 0);
        return scoreB - scoreA;
    });

    const winningGroup = groups[0];

    // Weighted centroid of winning cluster
    const avgLat = winningGroup.reduce((s, r) => s + r.lat, 0) / winningGroup.length;
    const avgLng = winningGroup.reduce((s, r) => s + r.lng, 0) / winningGroup.length;

    // Confidence = 60% agreement ratio + 40% avg source confidence
    const agreementScore = winningGroup.length / results.length;
    const avgSourceConfidence =
        winningGroup.reduce((s, r) => s + r.confidence, 0) / winningGroup.length;
    const compositeConfidence = agreementScore * 0.6 + avgSourceConfidence * 0.4;

    // Spread = max distance of any member from cluster centroid
    const spreads = winningGroup.map((r) => haversineKm(r.lat, r.lng, avgLat, avgLng));
    const spreadKm = Math.max(...spreads);

    return {
        lat: avgLat,
        lng: avgLng,
        confidence: Math.min(compositeConfidence, 1.0),
        sources: winningGroup,
        agreementCount: winningGroup.length,
        spreadKm,
    };
}

// ─── Issue Detection ─────────────────────────────────────────────────────────

export function detectIssueType(
    office: IEBCOffice,
    allOffices: IEBCOffice[],
    resolvedLat?: number,
    resolvedLng?: number
): VerificationIssue | null {
    // Null coordinates → name-based lookup path
    if (office.latitude === null || office.longitude === null) {
        return { type: "NULL_COORDS", office };
    }

    // Displacement: compare stored coords against resolved coords
    if (resolvedLat !== undefined && resolvedLng !== undefined) {
        const displacementKm = haversineKm(office.latitude, office.longitude, resolvedLat, resolvedLng);
        if (displacementKm > DISPLACEMENT_THRESHOLD_KM) {
            return { type: "DISPLACED", office, displacementKm };
        }
    }

    // Clustering: separate detection path (not sent to same resolver as displacement)
    const nearby = allOffices.filter((other) => {
        if (other.id === office.id || other.latitude === null || other.longitude === null) return false;
        return haversineKm(office.latitude!, office.longitude!, other.latitude, other.longitude) < CLUSTERING_THRESHOLD_KM;
    });

    if (nearby.length > 0) {
        return { type: "CLUSTERING", office, clusteringOffices: nearby };
    }

    return null;
}

// ─── Supabase Persistence ────────────────────────────────────────────────────

async function logAudit(
    office: IEBCOffice,
    issueType: string,
    newLat: number | null,
    newLng: number | null,
    consensus: ConsensusResult | null,
    autoApplied: boolean,
    resolutionMethod: string
): Promise<string | undefined> {
    const { data, error } = await supabase
        .from("geocode_audit")
        .insert({
            office_id: office.id,
            constituency: office.constituency_name,
            county: office.county,
            issue_type: issueType,
            old_latitude: office.latitude,
            old_longitude: office.longitude,
            new_latitude: newLat,
            new_longitude: newLng,
            consensus_confidence: consensus?.confidence ?? null,
            agreement_count: consensus?.agreementCount ?? null,
            spread_km: consensus?.spreadKm ?? null,
            sources_used: consensus?.sources.map((s) => s.source) ?? [],
            source_results: consensus?.sources.map((s) => ({
                source: s.source,
                lat: s.lat,
                lng: s.lng,
                confidence: s.confidence,
                displayName: s.displayName,
            })) ?? [],
            resolution_method: resolutionMethod,
            applied: autoApplied,
        })
        .select("id")
        .single();

    if (error) {
        console.error("[Geocoder] Audit log insert failed:", error.message);
        return undefined;
    }
    return data?.id;
}

async function applyToSupabase(officeId: number, lat: number, lng: number, confidence: number): Promise<boolean> {
    const { error } = await supabase
        .from("iebc_offices")
        .update({
            latitude: lat,
            longitude: lng,
            geocode_verified: true,
            geocode_verified_at: new Date().toISOString(),
            multi_source_confidence: confidence,
            geocode_method: "multi_source_consensus",
        })
        .eq("id", officeId);

    if (error) {
        console.error("[Geocoder] Supabase update failed:", error.message);
        return false;
    }
    return true;
}

async function enqueueHITL(
    office: IEBCOffice,
    consensus: ConsensusResult | null,
    issueType: string,
    auditId?: string
): Promise<void> {
    const { error } = await supabase.from("geocode_hitl_queue").insert({
        office_id: office.id,
        audit_id: auditId ?? null,
        issue_type: issueType,
        proposed_latitude: consensus?.lat ?? null,
        proposed_longitude: consensus?.lng ?? null,
        confidence: consensus?.confidence ?? null,
        agreement_count: consensus?.agreementCount ?? null,
        spread_km: consensus?.spreadKm ?? null,
        source_details: consensus?.sources.map((s) => ({
            source: s.source,
            lat: s.lat,
            lng: s.lng,
            confidence: s.confidence,
        })) ?? [],
        status: "pending",
    });

    if (error) {
        console.error("[Geocoder] HITL queue insert failed:", error.message);
    }
}

// ─── Main Verification Pipeline ──────────────────────────────────────────────

export async function verifyOffice(
    office: IEBCOffice,
    allOffices: IEBCOffice[]
): Promise<VerificationResult> {
    // Step 1: Run multi-source resolver
    const resolverResults = await runMultiSourceResolver(office);
    const consensus = computeConsensus(resolverResults);

    // Step 2: Detect issue type using resolved coords as reference
    const issue = detectIssueType(office, allOffices, consensus?.lat, consensus?.lng);

    // No issue detected — office is fine
    if (!issue) {
        return {
            issue: { type: "DISPLACED", office, displacementKm: 0 },
            consensus,
            autoApplied: false,
            flaggedForHITL: false,
        };
    }

    // Step 3: Decision gate
    const shouldAutoApply =
        consensus !== null &&
        consensus.confidence >= CONFIDENCE_AUTO_APPLY_THRESHOLD &&
        (issue.type === "DISPLACED" || issue.type === "NULL_COORDS");

    const shouldHITL = !shouldAutoApply;

    let applied = false;
    let auditId: string | undefined;

    if (shouldAutoApply && consensus) {
        // Auto-apply high-confidence results
        applied = await applyToSupabase(office.id, consensus.lat, consensus.lng, consensus.confidence);
        auditId = await logAudit(office, issue.type, consensus.lat, consensus.lng, consensus, true, "multi_source_consensus");
    } else if (shouldHITL) {
        // Log and enqueue for admin review
        auditId = await logAudit(
            office,
            issue.type,
            consensus?.lat ?? null,
            consensus?.lng ?? null,
            consensus,
            false,
            "multi_source_consensus"
        );
        await enqueueHITL(office, consensus, issue.type, auditId);
    }

    return {
        issue,
        consensus,
        autoApplied: applied,
        flaggedForHITL: shouldHITL,
        auditId,
    };
}

// ─── Batch Processing ────────────────────────────────────────────────────────

export async function batchVerifyOffices(
    offices: IEBCOffice[],
    onProgress?: (completed: number, total: number, result: VerificationResult) => void
): Promise<VerificationResult[]> {
    const results: VerificationResult[] = [];
    let completed = 0;

    for (const office of offices) {
        const result = await verifyOffice(office, offices);
        results.push(result);
        completed++;
        if (onProgress) onProgress(completed, offices.length, result);
        // Respect rate limits across all sources
        await new Promise((r) => setTimeout(r, 1200));
    }

    return results;
}

// ─── Admin HITL Queue Methods ────────────────────────────────────────────────

export async function fetchHITLQueue() {
    const { data, error } = await supabase
        .from("geocode_hitl_queue")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: true });

    if (error) {
        console.error("[Geocoder] HITL queue fetch failed:", error.message);
        return [];
    }
    return data ?? [];
}

export async function resolveHITL(
    queueId: string,
    officeId: number,
    approvedLat: number,
    approvedLng: number,
    adminEmail: string
): Promise<boolean> {
    const applied = await applyToSupabase(officeId, approvedLat, approvedLng, 1.0);
    if (!applied) return false;

    const { error } = await supabase
        .from("geocode_hitl_queue")
        .update({
            status: "approved",
            resolved_by: adminEmail,
            resolved_at: new Date().toISOString(),
            final_latitude: approvedLat,
            final_longitude: approvedLng,
        })
        .eq("id", queueId);

    if (error) {
        console.error("[Geocoder] HITL resolve failed:", error.message);
        return false;
    }
    return true;
}

export async function dismissHITL(
    queueId: string,
    adminEmail: string,
    reason: string
): Promise<boolean> {
    const { error } = await supabase
        .from("geocode_hitl_queue")
        .update({
            status: "dismissed",
            resolved_by: adminEmail,
            resolved_at: new Date().toISOString(),
            dismiss_reason: reason,
        })
        .eq("id", queueId);

    if (error) {
        console.error("[Geocoder] HITL dismiss failed:", error.message);
        return false;
    }
    return true;
}
