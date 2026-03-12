/**
 * 404 Route Matcher — provides contextual messages and "did you mean?" suggestions
 * for the NotFound page based on the attempted path.
 */

// Known valid routes in the flattened Nasaka architecture
const KNOWN_ROUTES = [
    { path: "/", label: "Home" },
    { path: "/map", label: "Interactive Map" },
    { path: "/privacy", label: "Privacy Policy" },
    { path: "/terms", label: "Terms of Use" },
    { path: "/voter-registration", label: "Voter Registration" },
    { path: "/about", label: "About Nasaka" },
    { path: "/contact", label: "Contact Us" },
    { path: "/admin", label: "Admin Dashboard" },
    { path: "/admin/verifier", label: "IEBC Data Verifier" },
    { path: "/data-api", label: "Data API" },
    { path: "/legislative-tracker", label: "Legislative Tracker" },
];

// Legacy redirects — paths that used to exist but have been flattened
const LEGACY_REDIRECTS: Record<string, string> = {
    "/iebc-office": "/",
    "/iebc-office/map": "/map",
    "/nasaka-iebc": "/",
    "/nasaka-iebc/map": "/map",
    "/iebc-office/voter-registration": "/voter-registration",
};

/**
 * Simple Levenshtein-ish similarity for short path segments.
 */
function similarity(a: string, b: string): number {
    const al = a.toLowerCase().replace(/[^a-z0-9]/g, "");
    const bl = b.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (al === bl) return 1;
    if (!al || !bl) return 0;
    // Check substring containment
    if (al.includes(bl) || bl.includes(al)) return 0.7;
    // Check shared prefix
    let shared = 0;
    for (let i = 0; i < Math.min(al.length, bl.length); i++) {
        if (al[i] === bl[i]) shared++;
        else break;
    }
    return shared / Math.max(al.length, bl.length);
}

export interface Handle404Result {
    message: string;
    bestMatch: string | null;
}

export function handle404(pathname: string): Handle404Result {
    const cleanPath = pathname.replace(/\/+$/, "").toLowerCase() || "/";

    // Check for legacy redirect matches
    const redirect = LEGACY_REDIRECTS[cleanPath];
    if (redirect) {
        return {
            message: `This page has moved`,
            bestMatch: redirect,
        };
    }

    // Find best matching known route
    let bestScore = 0;
    let bestRoute: (typeof KNOWN_ROUTES)[0] | null = null;

    for (const route of KNOWN_ROUTES) {
        const score = similarity(cleanPath, route.path);
        if (score > bestScore && score > 0.3) {
            bestScore = score;
            bestRoute = route;
        }
    }

    // Check if it looks like a constituency/office slug
    if (cleanPath.match(/^\/[a-z-]+$/) && cleanPath.length > 3) {
        return {
            message: `Page not found`,
            bestMatch: bestRoute?.path || "/map",
        };
    }

    return {
        message: `Page not found`,
        bestMatch: bestRoute?.path || null,
    };
}
