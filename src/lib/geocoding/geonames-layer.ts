// src/lib/geocoding/geonames-layer.ts
// GeoNames geocoder layer (v10.3)

import { GeocodingSource, GeocodedResult } from "./pipeline";

export async function layer_geonames(
    query: string,
    countryCode = "KE"
): Promise<GeocodedResult[]> {
    const USERNAME = (typeof import.meta !== "undefined" && import.meta.env?.VITE_GEONAMES_USERNAME) ||
        (typeof process !== "undefined" && process.env?.VITE_GEONAMES_USERNAME) ||
        "civiceducationkenya";

    const params = new URLSearchParams({
        q: query,
        country: countryCode,
        maxRows: "5",
        type: "json",
        username: USERNAME,
        lang: "en",
        style: "FULL",
    });

    try {
        const res = await fetch(
            `http://api.geonames.org/searchJSON?${params}`
        );
        if (!res.ok) throw new Error("GeoNames failed");

        const data = await res.json();

        if (data.status) {
            // GeoNames returns status object on error
            console.warn(`GeoNames error: ${data.status.message}`);
            return [];
        }

        return (data.geonames || []).map((r: any) => ({
            lat: parseFloat(r.lat),
            lng: parseFloat(r.lng),
            name: r.name,
            displayName: [r.name, r.adminName2, r.adminName1, r.countryName]
                .filter(Boolean).join(", "),
            confidence: r.score ? Math.min(r.score / 100, 1) : 0.65,
            source: "geonames" as GeocodingSource,
            type: r.fclName || r.fcodeName || "place",
            county: r.adminName1,
            country: r.countryName,
            countryCode: r.countryCode,
            isKenyan: r.countryCode === "KE",
        })).filter((r: any) => r.lat && r.lng);
    } catch (err) {
        console.error("GeoNames layer failed:", err);
        return [];
    }
}
