/**
 * 404-message.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Nasaka IEBC contextualized 404 handler.
 * Logs 404s, finds best-match routes via fuzzy matching, and returns
 * a themed message from categorized buckets.
 */

import { supabase } from '@/integrations/supabase/client';

// ─── Known Routes ─────────────────────────────────────────────────────────────
const knownRoutes = [
    '/',
    '/iebc-office',
    '/iebc-office/map',
    '/nasaka-iebc',
    '/admin/contributions',
    '/admin/reset-password',
    '/VoterRegistration',
    '/SignPetition',
    '/VerifySignature',
    '/privacy',
    '/terms',
];

// ─── Message Variants (Nasaka IEBC Contextualized) ────────────────────────────
const VARIANTS = {
    playful: [
        "Can't find `{path}`. Our IEBC agents searched every constituency and came up empty.",
        "404: `{path}` went on safari without telling anyone at the registry.",
        "You found a blank spot on the map: `{path}`. Even our GPS can't locate it.",
        "Well this is awkward — `{path}` seems to have moved polling stations without IEBC approval.",
        "Huh. `{path}` is playing hide-and-seek across all 47 counties. We lost.",
        "We searched under every ballot box; `{path}` wasn't there.",
        "Oof. `{path}` bounced like a rejected nomination form. We're on it.",
        "Error 404 — `{path}` transferred its registration to an unknown constituency.",
        "Whoops. `{path}` took a detour to a constituency that doesn't exist yet.",
        "Looks like `{path}` never registered with our URL voter registry.",
        "This page (`{path}`) is practicing social distancing from our server — very Kenyan of it.",
        "Our map doesn't show `{path}`. Maybe IEBC hasn't delimited that zone yet?",
        "We couldn't fetch `{path}`. Maybe it left with the polling station materials.",
        "Hmm. `{path}` must be under boundary review. Check back after delimitation.",
        "404 report: `{path}` — missing but suspected somewhere in the Rift Valley.",
        "It's not you, it's `{path}`. It failed biometric verification.",
        "We checked all 290 constituencies; `{path}` isn't registered in any of them.",
        "This feels like a disputed count: `{path}` exists in parallel reality only.",
        "Your detective work found `{path}` — sadly it's invisible like a phantom voter.",
        "404: `{path}` — currently experiencing a boundary dispute with our server.",
        "We tried to locate `{path}` but it's gone rogue like missing tallying sheets.",
        "Well spotted. `{path}` is absent without leave from the voter register.",
        "Looks like `{path}` took the scenic route through all 47 counties and never returned.",
        "You're right to call this out — `{path}` is officially MIA from our constituency map.",
        "`{path}` went off-grid somewhere between Turkana and Lamu. Can't reach it.",
        "404: `{path}` missed its CVR appointment and was never registered.",
        "Looks like `{path}` is stuck in an eternal recount. No result here.",
        "`{path}` went off-frequency and disappeared from the Results Transmission System.",
        "We're conducting a search for `{path}`, but the returning officers are confused.",
        "404: `{path}` decided to improvise and declared itself an independent page.",
        "`{path}` is playing hide-and-seek with Form 34B. Still tallying.",
        "This page (`{path}`) is having a solo campaign — away from our servers.",
        "We tried to tune into `{path}` but got static from the transmission towers.",
        "`{path}` hit a wrong boundary and vanished into the delimitation void.",
        "404: `{path}` is on a campaign trail across Kenya and forgot to tell us the schedule.",
        "Looks like `{path}` is stuck in a boundary review — we can't find the resolution.",
        "`{path}` went to the tallying centre and never returned for the declaration.",
        "We're getting radio silence from `{path}`. Check your antenna at the constituency?",
        "404: `{path}` is composing a petition somewhere else apparently.",
        "`{path}` dropped its ballot and we can't find where it landed.",
    ],

    apologetic: [
        "We couldn't find `{path}` — pole sana. Can you tell us what you were trying to do?",
        "`{path}` isn't available. We'll map this if you give us a hint of the constituency.",
        "Sorry, but `{path}` seems to have wandered off the IEBC grid. What were you looking for?",
        "We're really sorry — `{path}` is missing from our constituency register. What were you hoping to find?",
        "Our apologies for the inconvenience. `{path}` isn't on our map. Can you describe what you were looking for?",
        "Sorry about this — `{path}` appears to be unregistered. We'd love to help if you can tell us more.",
        "We're sorry to disappoint, but `{path}` isn't responding like a broken RTS signal. What functionality were you trying to access?",
        "Apologies — `{path}` seems to have taken an unexpected break from its civic duties. Can you share what you were trying to accomplish?",
        "Sorry for the trouble. `{path}` is currently outside our constituency boundaries. What were you hoping to see here?",
        "We apologize for the confusion. `{path}` isn't registered in our system right now. Can you help us understand your needs?",
        "Sorry about the dead end — `{path}` isn't loading. Were you looking for an IEBC office?",
        "Our sincere apologies. `{path}` appears to have been degazetted. Can you tell us what should be here?",
        "We're sorry for the frustration. `{path}` isn't accessible at the moment. Were you trying to find a voter registration centre?",
        "Sorry to let you down — `{path}` can't be found. Were you looking for constituency boundaries?",
        "We apologize for this hiccup. `{path}` isn't responding. What kind of IEBC information were you seeking?",
        "Sorry for the inconvenience — `{path}` seems to be offline. Were you trying to check voter registration status?",
        "We're sorry this isn't working as expected. `{path}` is unavailable. Were you trying to find directions to an IEBC office?",
        "Apologies for the broken link. `{path}` can't be reached. Can you describe what you were looking for?",
        "Sorry about the confusion — `{path}` isn't there. What IEBC service were you looking for?",
        "We sincerely apologize. `{path}` appears to be missing from our map. Can you help us figure out what should be here?",
    ],

    investigative: [
        "`{path}` has been requested {count} times. Thanks for flagging — we'll investigate this constituency gap.",
        "This page (`{path}`) looks popular but missing — creating a mapping ticket now.",
        "`{path}` seems to be a frequent target — investigating why this route isn't on our IEBC map.",
        "Interesting pattern: `{path}` has been requested multiple times. Adding to our constituency investigation queue.",
        "Thanks for reporting this. `{path}` appears to be a common request — our mapping team is on the case.",
        "`{path}` is generating a lot of 404s. We're investigating if this is a missing IEBC office.",
        "Good catch! `{path}` seems to be in demand but missing from our records. Investigating now.",
        "We've noticed `{path}` coming up often in our logs. Time for some electoral detective work.",
        "`{path}` is showing up in our analytics as a frequent miss. Looking into it with the mapping team.",
        "Thanks for bringing this to our attention. `{path}` warrants investigation — might be a constituency we haven't mapped yet.",
        "Multiple users have been looking for `{path}`. We're checking if this is a new IEBC office.",
        "`{path}` is trending in our 404 reports. Investigation initiated by CEKA mapping division.",
        "Curious case: `{path}` keeps being requested. We're putting our community verification hats on.",
        "Pattern detected: `{path}` is a repeat offender. Time to solve this constituency mystery.",
        "`{path}` has been flagged by our monitoring systems. Investigation underway — could be a missing office listing.",
    ],

    suggest_fix: [
        "Did you mean `{bestMatch}`? We couldn't find `{path}`.",
        "Try `{bestMatch}` instead of `{path}` — that route leads to an actual IEBC page.",
        "Looks like you might be looking for `{bestMatch}` rather than `{path}`.",
        "Perhaps you meant `{bestMatch}`? The `{path}` constituency doesn't exist on our map, but that one does.",
        "Close! Try `{bestMatch}` — it's similar to `{path}` but actually registered in our system.",
        "We couldn't find `{path}`, but `{bestMatch}` might be the IEBC page you're after.",
        "Almost there! `{bestMatch}` exists on our map, while `{path}` doesn't.",
        "Did you intend to visit `{bestMatch}`? It's close to `{path}` but actually has office data.",
        "Try navigating to `{bestMatch}` instead — `{path}` isn't in our constituency database.",
        "`{path}` doesn't exist on our map, but `{bestMatch}` might be what you need.",
        "We think you meant `{bestMatch}` rather than `{path}`. One letter can change a whole constituency!",
        "Close guess! `{bestMatch}` works, but `{path}` isn't a registered route.",
        "Perhaps there's a typo? Try `{bestMatch}` instead of `{path}`. Constituency names can be tricky.",
        "We couldn't locate `{path}` on the Nasaka map, but `{bestMatch}` is available and similar.",
        "`{bestMatch}` might be the office you're looking for — `{path}` isn't on our IEBC register.",
    ],
};

// ─── Levenshtein distance ─────────────────────────────────────────────────────
function levenshtein(a: string, b: string): number {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
        }
    }
    return dp[a.length][b.length];
}

function findClosestRoute(
    path: string,
    confidenceLevel: 'high' | 'medium' | 'low' = 'medium'
): { route: string; distance: number } | null {
    let bestMatch: string | null = null;
    let bestDistance = Infinity;

    for (const route of knownRoutes) {
        const cleanRoute = route.replace(/:[^/]+/g, '');
        const cleanPath = path.replace(/\/$/, '');
        const distance = levenshtein(cleanPath, cleanRoute);
        if (distance < bestDistance) {
            bestDistance = distance;
            bestMatch = route;
        }
    }

    const thresholds: Record<string, number> = { high: 1, medium: 2, low: 3 };
    const threshold = thresholds[confidenceLevel] ?? 2;

    if (bestMatch && bestDistance <= threshold) {
        return { route: bestMatch, distance: bestDistance };
    }
    return null;
}

// ─── Main 404 Handler ─────────────────────────────────────────────────────────
export const handle404 = async (
    path: string,
    search: string,
    referrer: string,
    userAgent: string
) => {
    try {
        const now = new Date().toISOString();

        // Log to Supabase (if page_404s table exists — cast as any since table may not be in generated types)
        let count = 1;
        try {
            const sb = supabase as any;
            const { data: existing, error: selectError } = await sb
                .from('page_404s')
                .select('id, count, referrers, user_agents')
                .eq('path', path)
                .maybeSingle();

            if (!selectError && existing) {
                count = (existing.count || 0) + 1;
                const referrers = Array.from(
                    new Set([...(existing.referrers || []), referrer].filter(Boolean))
                );
                const user_agents = Array.from(
                    new Set([...(existing.user_agents || []), userAgent].filter(Boolean))
                );

                await sb
                    .from('page_404s')
                    .update({
                        count,
                        last_seen: now,
                        referrers,
                        user_agents,
                        query_params: search || null,
                    })
                    .eq('id', existing.id);
            } else if (!selectError) {
                await sb.from('page_404s').insert({
                    path,
                    first_seen: now,
                    last_seen: now,
                    count: 1,
                    referrers: referrer ? [referrer] : [],
                    user_agents: userAgent ? [userAgent] : [],
                    query_params: search || null,
                });
            }
        } catch {
            // page_404s table may not exist — that's fine, continue without logging
        }

        // Find closest route match
        const confidenceLevels = ['high', 'medium', 'low'] as const;
        let closestMatch: { route: string; distance: number } | null = null;
        for (const level of confidenceLevels) {
            closestMatch = findClosestRoute(path, level);
            if (closestMatch) break;
        }

        let looksLikeTypo = false;
        let bestMatch = '';
        if (closestMatch) {
            looksLikeTypo = true;
            bestMatch = closestMatch.route;
        }

        // Determine message bucket
        const hasQuery = !!search;
        const isFrequent = count > 10;
        const externalReferrer = referrer && !referrer.includes(window.location.hostname);

        let bucket: keyof typeof VARIANTS = 'playful';
        if (looksLikeTypo) {
            bucket = 'suggest_fix';
        } else if (isFrequent) {
            bucket = 'investigative';
        } else if (hasQuery) {
            bucket = 'apologetic';
        } else if (externalReferrer) {
            bucket = 'playful';
        }

        const variants = VARIANTS[bucket];
        const rawMessage = variants[Math.floor(Math.random() * variants.length)];
        const message = rawMessage
            .replace(/{path}/g, path)
            .replace(/{count}/g, String(count))
            .replace(/{bestMatch}/g, bestMatch);

        return { message, bucket, count, bestMatch: looksLikeTypo ? bestMatch : null };
    } catch (error) {
        console.error('Error in 404 handler:', error);
        return {
            message: `We couldn't find the page ${path}. Try searching for an IEBC office on our map instead.`,
            bucket: 'apologetic',
            count: 0,
            bestMatch: null,
        };
    }
};
