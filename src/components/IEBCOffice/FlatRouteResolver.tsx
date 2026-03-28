import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/components/SEO/SEOHead";
import { resolveLocation } from '@/lib/geocoding/pipeline';
import LoadingSpinner from './LoadingSpinner';

/**
 * FlatRouteResolver
 * ─────────────────────────────────────────────────────────────────────────
 * Handles flat slugs like /ruiru, /kiambu, or /ruiru-greens.
 * 1. Checks if it's a known county.
 * 2. Checks if it's a known constituency.
 * 3. Checks if it's a known ward.
 * 4. Geographical Fallback: Resolve via geocoding -> Find nearest Ward -> Redirect.
 */
const FlatRouteResolver = () => {
    const { slug } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [status, setStatus] = useState<'loading' | 'error' | 'not-found'>('loading');

    useEffect(() => {
        const resolve = async () => {
            if (!slug) {
                navigate('/', { replace: true });
                return;
            }

            try {
                const searchName = slug.replace(/-/g, ' ');

                // Step 1: Check if it's a direct county slug
                const { data: countyData } = await supabase
                    .from('iebc_offices')
                    .select('county, constituency_name')
                    .ilike('county', searchName)
                    .limit(1);

                if (countyData && (countyData as any[]).length > 0) {
                    const match = (countyData as any[])[0];
                    const county_slug = slugify(match.county);
                    let area_slug = slugify(match.constituency_name);
                    if (area_slug === county_slug) area_slug = `${area_slug}-town`;
                    // Navigate to /:county/:constituency to avoid infinite loop on /:slug
                    navigate(`/map/${county_slug}/${area_slug}`, { replace: true });
                    return;
                }

                // Step 2: Check if it's a constituency slug
                const { data: areaData } = await supabase
                    .from('iebc_offices')
                    .select('county, constituency_name')
                    .or(`constituency_name.ilike.${searchName},constituency_name.ilike.${slug.replace(/-town$/, '').replace(/-/g, ' ')}`);

                if (areaData && (areaData as any[]).length > 0) {
                    const match = (areaData as any[])[0];
                    const county_slug = slugify(match.county);
                    let area_slug = slugify(match.constituency_name);
                    if (area_slug === county_slug) area_slug = `${area_slug}-town`;

                    navigate(`/map/${county_slug}/${area_slug}`, { replace: true });
                    return;
                }

                // Step 3: Check Wards table (Full Registry)
                const { data: wardData } = await supabase
                    .from('wards')
                    .select('county, constituency, ward_name')
                    .ilike('ward_name', searchName)
                    .limit(1);

                if (wardData && (wardData as any[]).length > 0) {
                    const w = (wardData as any[])[0];
                    navigate(`/map/${slugify(w.county)}/${slugify(w.constituency)}/${slugify(w.ward_name)}`, { replace: true });
                    return;
                }

                // Step 4: Geographical Fallback (Go Ham)
                // If it's a landmark like "Ruiru Greens" or a specific suburb
                const geo = await resolveLocation(searchName);
                if (geo.result && geo.result.isKenyan) {
                    const { lat, lng } = geo.result;

                    // Find the nearest ward centroid to this resolved point
                    try {
                        const { data: nearestWard } = await (supabase.rpc as any)('get_nearest_ward', {
                            lat_param: lat,
                            lng_param: lng
                        });

                        if (nearestWard && (nearestWard as any[]).length > 0) {
                            const w = (nearestWard as any[])[0];
                            const path = `/map/${slugify(w.county)}/${slugify(w.constituency)}/${slugify(w.ward_name)}`;
                            navigate(`${path}?lat=${lat}&lng=${lng}&q=${encodeURIComponent(searchName)}`, { replace: true });
                            return;
                        }
                    } catch (rpcError) {
                        console.warn('get_nearest_ward RPC unavailable, falling back to county resolution:', rpcError);
                    }

                    // Fallback to county if ward RPC fails
                    // Strip " County" / " county" suffix from geocoded name (Nominatim returns "Bungoma County" but DB stores "BUNGOMA")
                    if (geo.result.county) {
                        const cleanCounty = geo.result.county.replace(/\s+county$/i, '').trim();
                        // Find first constituency in this county to build a 2-segment URL
                        const { data: countyOffice } = await supabase
                            .from('iebc_offices')
                            .select('county, constituency_name')
                            .ilike('county', cleanCounty)
                            .limit(1);

                        if (countyOffice && (countyOffice as any[]).length > 0) {
                            const match = (countyOffice as any[])[0];
                            const c_slug = slugify(match.county);
                            let a_slug = slugify(match.constituency_name);
                            if (a_slug === c_slug) a_slug = `${a_slug}-town`;
                            navigate(`/map/${c_slug}/${a_slug}?lat=${lat}&lng=${lng}&q=${encodeURIComponent(searchName)}`, { replace: true });
                            return;
                        }
                    }
                }

                setStatus('not-found');
            } catch (error) {
                console.error("Resolution error:", error);
                setStatus('error');
            }
        };

        resolve();
    }, [slug, navigate]);

    if (status === 'loading') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6 text-center">
                <LoadingSpinner size="large" />
                <div className="mt-6 space-y-2">
                    <p className="text-lg font-semibold animate-pulse">Locating {slug?.replace(/-/g, ' ')}...</p>
                    <p className="text-sm text-muted-foreground">Mapping your request to the IEBC electoral hierarchy</p>
                </div>
            </div>
        );
    }

    if (status === 'error' || status === 'not-found') {
        navigate('/404', { replace: true });
        return null;
    }

    return null;
};

export default FlatRouteResolver;
