/**
 * 404-message.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Nasaka IEBC contextualized 404 handler.
 * Returns themed messages from categorized buckets and finds best-match
 * routes via fuzzy matching.
 */

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

const VARIANTS = {
    playful: [
        "Can't find `{path}`. Our IEBC agents searched every constituency and came up empty.",
        "404: `{path}` went on safari without telling anyone at the registry.",
        "You found a blank spot on the map: `{path}`. Even our GPS can't locate it.",
        "Huh. `{path}` is playing hide-and-seek across all 47 counties. We lost.",
        "We searched under every ballot box; `{path}` wasn't there.",
        "Error 404 — `{path}` transferred its registration to an unknown constituency.",
        "Looks like `{path}` never registered with our URL voter registry.",
        "Our map doesn't show `{path}`. Maybe IEBC hasn't delimited that zone yet?",
        "We checked all 290 constituencies; `{path}` isn't registered in any of them.",
        "404: `{path}` — currently experiencing a boundary dispute with our server.",
        "Looks like `{path}` took the scenic route through all 47 counties and never returned.",
        "`{path}` went off-grid somewhere between Turkana and Lamu. Can't reach it.",
        "404: `{path}` missed its CVR appointment and was never registered.",
        "`{path}` went off-frequency and disappeared from the Results Transmission System.",
        "404: `{path}` decided to improvise and declared itself an independent page.",
        "`{path}` is playing hide-and-seek with Form 34B. Still tallying.",
        "`{path}` dropped its ballot and we can't find where it landed.",
    ],

    apologetic: [
        "We couldn't find `{path}` — pole sana. Can you tell us what you were trying to do?",
        "`{path}` isn't available. We'll map this if you give us a hint of the constituency.",
        "Sorry, but `{path}` seems to have wandered off the IEBC grid. What were you looking for?",
        "Our apologies. `{path}` isn't on our map. Can you describe what you were looking for?",
        "Sorry about this — `{path}` appears to be unregistered. We'd love to help if you can tell us more.",
        "Sorry about the dead end — `{path}` isn't loading. Were you looking for an IEBC office?",
        "We're sorry for the frustration. `{path}` isn't accessible. Were you trying to find a voter registration centre?",
        "Apologies for the broken link. `{path}` can't be reached. Can you describe what you were looking for?",
        "Sorry about the confusion — `{path}` isn't there. What IEBC service were you looking for?",
    ],

    investigative: [
        "`{path}` has been requested {count} times. Thanks for flagging — we'll investigate this constituency gap.",
        "This page (`{path}`) looks popular but missing — creating a mapping ticket now.",
        "`{path}` seems to be a frequent target — investigating why this route isn't on our IEBC map.",
        "Good catch! `{path}` seems to be in demand but missing from our records. Investigating now.",
        "`{path}` is showing up in our analytics as a frequent miss. Looking into it with the mapping team.",
        "`{path}` is trending in our 404 reports. Investigation initiated by CEKA mapping division.",
        "Pattern detected: `{path}` is a repeat offender. Time to solve this constituency mystery.",
    ],

    suggest_fix: [
        "Did you mean `{bestMatch}`? We couldn't find `{path}`.",
        "Try `{bestMatch}` instead of `{path}` — that route leads to an actual IEBC page.",
        "Looks like you might be looking for `{bestMatch}` rather than `{path}`.",
        "Close! Try `{bestMatch}` — it's similar to `{path}` but actually registered in our system.",
        "We couldn't find `{path}`, but `{bestMatch}` might be the IEBC page you're after.",
        "Perhaps there's a typo? Try `{bestMatch}` instead of `{path}`. Constituency names can be tricky.",
        "`{bestMatch}` might be the office you're looking for — `{path}` isn't on our IEBC register.",
    ],
};

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

function findClosestRoute(path: string): { route: string; distance: number } | null {
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

    if (bestMatch && bestDistance <= 3) {
        return { route: bestMatch, distance: bestDistance };
    }
    return null;
}

export const handle404 = (
    path: string,
    search: string = "",
    referrer: string = "",
    _userAgent: string = ""
) => {
    try {
        const count = 1;
        const closestMatch = findClosestRoute(path);

        let looksLikeTypo = false;
        let bestMatch = '';
        if (closestMatch) {
            looksLikeTypo = true;
            bestMatch = closestMatch.route;
        }

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
            bucket: 'apologetic' as const,
            count: 0,
            bestMatch: null,
        };
    }
};
