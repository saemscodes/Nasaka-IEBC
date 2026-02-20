import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/components/SEO/SEOHead";
import LoadingSpinner from './LoadingSpinner';

/**
 * FlatRouteResolver
 * ─────────────────────────────────────────────────────────────────────────
 * Handles flat slugs like /ruiru or /kiambu.
 * 1. Checks if it's a known county.
 * 2. Checks if it's a known area.
 * 3. Redirects to hierarchical canonical route: /{county}/{area}
 */
const FlatRouteResolver = () => {
    const { slug } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [status, setStatus] = useState<'loading' | 'error' | 'not-found'>('loading');

    useEffect(() => {
        const resolve = async () => {
            if (!slug) {
                navigate('/iebc-office', { replace: true });
                return;
            }

            try {
                // Step 1: Check if it's a direct county slug
                const { data: countyData } = await supabase
                    .from('iebc_offices')
                    .select('county')
                    .ilike('county', slug.replace(/-/g, ' '))
                    .limit(1);

                if (countyData && countyData.length > 0) {
                    const canonicalCounty = slugify(countyData[0].county);
                    navigate(`/${canonicalCounty}`, { replace: true });
                    return;
                }

                // Step 2: Check if it's an area slug (constituency)
                // We fetch to see if this slug matches ANY constituency_name
                const { data: areaData } = await supabase
                    .from('iebc_offices')
                    .select('county, constituency_name')
                    .or(`constituency_name.ilike.${slug.replace(/-/g, ' ')},constituency_name.ilike.${slug.replace(/-town$/, '').replace(/-/g, ' ')}`);

                if (areaData && areaData.length > 0) {
                    // If unique, redirect to hierarchical
                    if (areaData.length === 1 || new Set(areaData.map(a => a.county)).size === 1) {
                        const match = areaData[0];
                        const county_slug = slugify(match.county);
                        let area_slug = slugify(match.constituency_name);

                        // Disambiguation
                        if (area_slug === county_slug) {
                            area_slug = `${area_slug}-town`;
                        }

                        navigate(`/${county_slug}/${area_slug}`, { replace: true });
                        return;
                    } else {
                        // Ambiguous area (exists in multiple counties) - Go to generic map or disambiguation
                        navigate(`/iebc-office/map?q=${slug}`, { replace: true });
                        return;
                    }
                }

                // Step 3: Not found
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
                <p className="mt-4 text-muted-foreground animate-pulse">Resolving IEBC mapping for {slug}...</p>
            </div>
        );
    }

    if (status === 'error' || status === 'not-found') {
        // Let it fall through to NotFound or generic handling
        navigate('/404', { replace: true });
        return null;
    }

    return null;
};

export default FlatRouteResolver;
