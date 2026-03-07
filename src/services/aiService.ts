// src/services/aiService.ts
// Nasaka AI Intelligence Layer — HuggingFace (Mistral) + Groq (Llama 3) + Google Gemini
// Implements the "Nasaka Consensus" for multi-provider AI scoring & ground-truth verification

import { get, set } from 'idb-keyval';

// ─── API Keys (VITE_ pattern matching existing codebase) ────────────────────
const HF_TOKEN = import.meta.env.VITE_HF_API_TOKEN;
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// ─── Types ──────────────────────────────────────────────────────────────────
export interface AIConsensusInput {
    officeName: string;
    county: string;
    latitude: number;
    longitude: number;
    weatherDesc: string;
    temperature: number | null;
    humidity: number | null;
    windSpeed: number | null;
    precipProb: number | null;
    distanceKm: number;
    timeMins: number;
    isVerified: boolean;
    currentScore: number;
    isFallbackDistance?: boolean; // True if using Haversine instead of real routing
}

export interface AIScoreResult {
    score: number;
    reason: string;
    provider: 'mistral' | 'groq' | 'gemini' | 'consensus' | 'cached' | 'fallback';
    confidence: 'high' | 'medium' | 'low';
    groundTruthVerified: boolean;
    groundTruthNote: string | null;
    fetchedAt: number;
}

// ─── In-Memory Cache ────────────────────────────────────────────────────────
interface AICacheEntry {
    result: AIScoreResult;
    timestamp: number;
}

const aiCache = new Map<string, AICacheEntry>();
const AI_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

function aiCacheKey(lat: number, lon: number): string {
    return `ai:${lat.toFixed(2)},${lon.toFixed(2)}`;
}

function getCachedAI(key: string): AIScoreResult | null {
    const entry = aiCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > AI_CACHE_TTL) {
        aiCache.delete(key);
        return null;
    }
    return entry.result;
}

function setCachedAI(key: string, result: AIScoreResult): void {
    aiCache.set(key, { result, timestamp: Date.now() });
}

// ─── IndexedDB Persistence for Offline ──────────────────────────────────────
const IDB_AI_PREFIX = 'nasaka_ai_score_';

async function getPersistedAIScore(key: string): Promise<AIScoreResult | null> {
    try {
        const stored = await get(`${IDB_AI_PREFIX}${key}`);
        if (!stored) return null;
        // Accept persisted scores up to 24 hours old for offline use
        if (Date.now() - stored.fetchedAt > 24 * 60 * 60 * 1000) return null;
        return { ...stored, provider: 'cached' as const, confidence: 'low' as const };
    } catch {
        return null;
    }
}

async function persistAIScore(key: string, result: AIScoreResult): Promise<void> {
    try {
        await set(`${IDB_AI_PREFIX}${key}`, result);
    } catch {
        // Silent fail — persistence is nice-to-have
    }
}

// ─── Quota Tracking ─────────────────────────────────────────────────────────
const aiQuota: Record<string, { count: number; resetAt: number }> = {};

function checkAIQuota(provider: string, dailyLimit: number): boolean {
    const now = Date.now();
    if (!aiQuota[provider] || now > aiQuota[provider].resetAt) {
        aiQuota[provider] = { count: 0, resetAt: now + 24 * 60 * 60 * 1000 };
    }
    return aiQuota[provider].count < dailyLimit * 0.8;
}

function incrementAIQuota(provider: string): void {
    if (aiQuota[provider]) aiQuota[provider].count++;
}

// ─── Prompt Engineering ─────────────────────────────────────────────────────
function buildScoringPrompt(input: AIConsensusInput): string {
    return `You are the Nasaka Intelligence Engine for Kenya's IEBC voter registration centers. Analyze this data for "${input.officeName}" in ${input.county} County and calculate a Visit Difficulty Score from 0 (easiest) to 100 (hardest).

DATA:
- Weather: ${input.weatherDesc || 'Unknown'}
- Temperature: ${input.temperature !== null ? `${input.temperature}°C` : 'N/A'}
- Humidity: ${input.humidity !== null ? `${input.humidity}%` : 'N/A'}
- Wind: ${input.windSpeed !== null ? `${input.windSpeed} km/h` : 'N/A'}
- Precipitation Probability: ${input.precipProb !== null ? `${input.precipProb}%` : 'N/A'}
- Travel Distance: ${input.distanceKm} km
- Estimated Travel Time: ${input.timeMins} minutes
- Office Verified: ${input.isVerified ? 'Yes (community verified)' : 'No (unverified)'}
- Current Algorithm Score: ${input.currentScore}/100

SCORING RULES:
- 0-25: Easy visit (clear weather, short distance, verified office)
- 26-50: Moderate (some weather, medium distance)
- 51-75: Difficult (rain/wind, long distance, or unverified)
- 76-100: Very difficult (severe weather + long distance + unverified)
- Spatial Intuition: ${input.isFallbackDistance ? `Note: Routing APIs failed. Using Haversine distance. Apply your knowledge of ${input.county} County terrain (e.g. mountainous, desert, urban traffic) to refine the difficulty.` : 'Routing data is accurate.'}
- Factor in Kenyan road conditions: unpaved roads in rural areas add difficulty.
- Rain in Kenya significantly impacts road safety and travel time.

Return ONLY a valid JSON object with no markdown formatting, no code blocks, no extra text:
{"score": <number 0-100>, "reason": "<one sentence explanation>"}`;
}

function buildGroundTruthPrompt(input: AIConsensusInput): string {
    return `You are a weather and travel verification agent for Kenya. Your task is to verify the accuracy of this weather report for a location in ${input.county} County, Kenya (coordinates: ${input.latitude}, ${input.longitude}).

REPORTED CONDITIONS:
- Weather: ${input.weatherDesc || 'Unknown'}
- Temperature: ${input.temperature !== null ? `${input.temperature}°C` : 'N/A'}
- Wind Speed: ${input.windSpeed !== null ? `${input.windSpeed} km/h` : 'N/A'}
- Precipitation: ${input.precipProb !== null ? `${input.precipProb}%` : 'N/A'}
- Humidity: ${input.humidity !== null ? `${input.humidity}%` : 'N/A'}

INSTRUCTIONS:
1. Search for the current actual weather conditions in ${input.county} County, Kenya right now.
2. Compare the reported conditions above against what you find from real-time sources.
3. Determine if the reported conditions are accurate, slightly off, or significantly wrong.

Return ONLY a valid JSON object with no markdown formatting:
{"verified": <true or false>, "note": "<one sentence about accuracy>", "actualConditions": "<what you found>"}`;
}

// ─── Provider 1: HuggingFace (Mistral-7B-Instruct) — Primary Scorer ────────
async function fetchMistralScore(input: AIConsensusInput): Promise<AIScoreResult | null> {
    if (!checkAIQuota('mistral', 1000)) return null;

    try {
        const prompt = buildScoringPrompt(input);
        const res = await fetch('/api/ai-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                provider: 'mistral',
                body: {
                    inputs: `[INST] ${prompt} [/INST]`,
                    parameters: {
                        max_new_tokens: 150,
                        temperature: 0.1,
                        return_full_text: false
                    }
                }
            }),
            signal: AbortSignal.timeout(15000)
        });

        incrementAIQuota('mistral');

        if (!res.ok) return null;

        const data = await res.json();
        const text = Array.isArray(data) ? data[0]?.generated_text : data?.generated_text;
        if (!text) return null;

        const parsed = extractJSON(text);
        if (!parsed || typeof parsed.score !== 'number') return null;

        return {
            score: Math.max(0, Math.min(100, Math.round(parsed.score))),
            reason: parsed.reason || 'Scored by Mistral-7B',
            provider: 'mistral',
            confidence: 'high',
            groundTruthVerified: false,
            groundTruthNote: null,
            fetchedAt: Date.now()
        };
    } catch {
        return null;
    }
}

// ─── Provider 2: Groq (Llama 3) — Fast Fallback Scorer ─────────────────────
async function fetchGroqScore(input: AIConsensusInput): Promise<AIScoreResult | null> {
    if (!checkAIQuota('groq', 14400)) return null;

    try {
        const prompt = buildScoringPrompt(input);
        const res = await fetch('/api/ai-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                provider: 'groq',
                body: {
                    model: 'llama-3.3-70b-versatile',
                    messages: [
                        { role: 'system', content: 'You are a precise scoring engine. Return only valid JSON.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.1,
                    max_tokens: 150,
                    response_format: { type: 'json_object' }
                }
            }),
            signal: AbortSignal.timeout(8000)
        });

        incrementAIQuota('groq');

        if (!res.ok) return null;

        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (!text) return null;

        const parsed = extractJSON(text);
        if (!parsed || typeof parsed.score !== 'number') return null;

        return {
            score: Math.max(0, Math.min(100, Math.round(parsed.score))),
            reason: parsed.reason || 'Scored by Groq/Llama 3',
            provider: 'groq',
            confidence: 'high',
            groundTruthVerified: false,
            groundTruthNote: null,
            fetchedAt: Date.now()
        };
    } catch {
        return null;
    }
}

// ─── Provider 3: Gemini — Referee + Ground Truth Verifier ───────────────────
async function fetchGeminiReferee(
    input: AIConsensusInput,
    scoreA: number | null,
    scoreB: number | null
): Promise<AIScoreResult | null> {
    if (!checkAIQuota('gemini', 1500)) return null;

    try {
        const prompt = scoreA !== null && scoreB !== null
            ? `${buildScoringPrompt(input)}\n\nTwo other AI models scored this location:\n- Model A: ${scoreA}/100\n- Model B: ${scoreB}/100\n\nConsider both scores and provide your own independent assessment. If they disagree by more than 25 points, lean toward the more conservative (higher difficulty) score for safety.`
            : buildScoringPrompt(input);

        const res = await fetch('/api/ai-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                provider: 'gemini',
                body: {
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 200,
                        responseMimeType: 'application/json'
                    }
                }
            }),
            signal: AbortSignal.timeout(12000)
        });

        incrementAIQuota('gemini');

        if (!res.ok) return null;

        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return null;

        const parsed = extractJSON(text);
        if (!parsed || typeof parsed.score !== 'number') return null;

        return {
            score: Math.max(0, Math.min(100, Math.round(parsed.score))),
            reason: parsed.reason || 'Scored by Gemini',
            provider: 'gemini',
            confidence: 'high',
            groundTruthVerified: false,
            groundTruthNote: null,
            fetchedAt: Date.now()
        };
    } catch {
        return null;
    }
}

// ─── Ground Truth Verification (Gemini with Search Grounding) ───────────────
async function verifyGroundTruth(input: AIConsensusInput): Promise<{ verified: boolean; note: string } | null> {
    if (!checkAIQuota('gemini_ground', 500)) return null;

    try {
        const prompt = buildGroundTruthPrompt(input);

        const res = await fetch('/api/ai-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                provider: 'gemini_ground',
                body: {
                    contents: [{ parts: [{ text: prompt }] }],
                    tools: [{ google_search: {} }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 200
                    }
                }
            }),
            signal: AbortSignal.timeout(15000)
        });

        incrementAIQuota('gemini_ground');

        if (!res.ok) return null;

        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return null;

        const parsed = extractJSON(text);
        if (!parsed) return null;

        return {
            verified: !!parsed.verified,
            note: parsed.note || parsed.actualConditions || 'Verification attempted'
        };
    } catch {
        return null;
    }
}

// ─── JSON Extraction Helper ─────────────────────────────────────────────────
function extractJSON(text: string): any {
    try {
        return JSON.parse(text.trim());
    } catch {
        // Try to find JSON in the text
        const jsonMatch = text.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]);
            } catch {
                return null;
            }
        }
        return null;
    }
}

// ─── Main Entry Point: The Nasaka Consensus ─────────────────────────────────
export async function getAIDifficultyScore(input: AIConsensusInput): Promise<AIScoreResult> {
    const cacheKey = aiCacheKey(input.latitude, input.longitude);

    // 1. Check in-memory cache
    const cached = getCachedAI(cacheKey);
    if (cached) return cached;

    // 2. Check IndexedDB persistence (offline support)
    const persisted = await getPersistedAIScore(cacheKey);
    if (persisted && !navigator.onLine) return persisted;

    // 3. If offline, return deterministic fallback
    if (!navigator.onLine) {
        return {
            score: input.currentScore,
            reason: 'Offline — using algorithm score',
            provider: 'fallback',
            confidence: 'low',
            groundTruthVerified: false,
            groundTruthNote: null,
            fetchedAt: Date.now()
        };
    }

    // 4. Multi-provider consensus — parallel fetch from Mistral + Groq
    const [mistralResult, groqResult] = await Promise.allSettled([
        fetchMistralScore(input),
        fetchGroqScore(input)
    ]);

    const mistral = mistralResult.status === 'fulfilled' ? mistralResult.value : null;
    const groq = groqResult.status === 'fulfilled' ? groqResult.value : null;

    let finalResult: AIScoreResult;

    if (mistral && groq) {
        const deviation = Math.abs(mistral.score - groq.score);

        if (deviation > 25) {
            // High disagreement — bring in Gemini as referee
            const gemini = await fetchGeminiReferee(input, mistral.score, groq.score);
            if (gemini) {
                finalResult = {
                    ...gemini,
                    provider: 'consensus',
                    reason: `Referee: ${gemini.reason} (Mistral: ${mistral.score}, Groq: ${groq.score}, Gemini: ${gemini.score})`
                };
            } else {
                // Gemini unavailable — use the more conservative (higher/harder) score for safety
                const conservative = mistral.score > groq.score ? mistral : groq;
                finalResult = {
                    ...conservative,
                    provider: 'consensus',
                    confidence: 'medium',
                    reason: `Conservative: ${conservative.reason} (deviation: ${deviation}pts)`
                };
            }
        } else {
            // Providers agree — average them
            const avgScore = Math.round((mistral.score + groq.score) / 2);
            finalResult = {
                score: avgScore,
                reason: mistral.reason || groq.reason || 'AI consensus score',
                provider: 'consensus',
                confidence: 'high',
                groundTruthVerified: false,
                groundTruthNote: null,
                fetchedAt: Date.now()
            };
        }
    } else if (mistral) {
        finalResult = mistral;
    } else if (groq) {
        finalResult = groq;
    } else {
        // Both failed — try Gemini as standalone
        const gemini = await fetchGeminiReferee(input, null, null);
        if (gemini) {
            finalResult = gemini;
        } else {
            // All providers down — use persisted or algorithm fallback
            if (persisted) return persisted;
            return {
                score: input.currentScore,
                reason: 'AI services unavailable — using algorithm score',
                provider: 'fallback',
                confidence: 'low',
                groundTruthVerified: false,
                groundTruthNote: null,
                fetchedAt: Date.now()
            };
        }
    }

    // 5. Ground Truth Verification Layer (Gemini with Google Search)
    const groundTruth = await verifyGroundTruth(input);
    if (groundTruth) {
        finalResult.groundTruthVerified = groundTruth.verified;
        finalResult.groundTruthNote = groundTruth.note;
        if (!groundTruth.verified) {
            finalResult.confidence = 'medium';
        }
    }

    // 6. Cache the result
    setCachedAI(cacheKey, finalResult);
    await persistAIScore(cacheKey, finalResult);

    return finalResult;
}
