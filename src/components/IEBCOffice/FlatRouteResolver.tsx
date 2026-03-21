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
                    .select('county')
                    .ilike('county', searchName)
                    .limit(1);

                if (countyData?.length > 0) {
                    navigate(`/${slugify(countyData[0].county)}`, { replace: true });
                    return;
                }

                // Step 2: Check if it's a constituency slug
                const { data: areaData } = await supabase
                    .from('iebc_offices')
                    .select('county, constituency_name')
                    .or(`constituency_name.ilike.${searchName},constituency_name.ilike.${slug.replace(/-town$/, '').replace(/-/g, ' ')}`);

                if (areaData?.length > 0) {
                    const match = areaData[0];
                    const county_slug = slugify(match.county);
                    let area_slug = slugify(match.constituency_name);
                    if (area_slug === county_slug) area_slug = `${area_slug}-town`;

                    navigate(`/${county_slug}/${area_slug}`, { replace: true });
                    return;
                }

                // Step 3: Check Wards table (Full Registry)
                const { data: wardData } = await supabase
                    .from('wards')
                    .select('county, constituency, ward_name')
                    .ilike('ward_name', searchName)
                    .limit(1);

                if (wardData?.length > 0) {
                    const w = wardData[0];
                    navigate(`/${slugify(w.county)}/${slugify(w.constituency)}/${slugify(w.ward_name)}`, { replace: true });
                    return;
                }

                // Step 4: Geographical Fallback (Go Ham)
                // If it's a landmark like "Ruiru Greens" or a specific suburb
                const geo = await resolveLocation(searchName);
                if (geo.result && geo.result.isKenyan) {
                    const { lat, lng } = geo.result;

                    // Find the nearest ward centroid to this resolved point
                    // We use the wards table which has lat/lng for every ward
                    const { data: nearestWard } = await supabase
                        .rpc('get_nearest_ward', {
                            lat_param: lat,
                            lng_param: lng
                        });

                    if (nearestWard && nearestWard.length > 0) {
                        const w = nearestWard[0];
                        const path = `/${slugify(w.county)}/${slugify(w.constituency)}/${slugify(w.ward_name)}`;
                        // Pass the exact resolved coordinates to center the map correctly at the destination
                        navigate(`${path}?lat=${lat}&lng=${lng}&q=${encodeURIComponent(searchName)}`, { replace: true });
                        return;
                    }

                    // Fallback to constituency if ward RPC fails
                    if (geo.result.county) {
                        navigate(`/${slugify(geo.result.county)}?lat=${lat}&lng=${lng}&q=${encodeURIComponent(searchName)}`, { replace: true });
                        return;
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
