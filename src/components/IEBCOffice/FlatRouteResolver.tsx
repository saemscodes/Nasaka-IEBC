import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/components/SEO/SEOHead";
import LoadingSpinner from './LoadingSpinner';

/**
 * FlatRouteResolver
 * ─────────────────────────────────────────────────────────────────────────
 * Handles flat slugs like /ruiru or /kiambu.
 * 1. Checks if it's a known county.
 * 2. Checks if it's a known area (constituency).
 * 3. Checks if it's a known ward.
 * 4. Redirects to hierarchical canonical route.
 */
const FlatRouteResolver = () => {
    const { slug } = useParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState<'loading' | 'error' | 'not-found'>('loading');

    useEffect(() => {
        const resolve = async () => {
            if (!slug) {
                navigate('/', { replace: true });
                return;
            }

            try {
                // Step 1: Check if it's a direct county slug
                const { data: countyData } = await supabase
                    .from('iebc_offices')
                    .select('county')
                    .ilike('county', slug.replace(/-/g, ' '))
                    .limit(1);

                if (countyData && (countyData as any[]).length > 0) {
                    const data = countyData as any[];
                    const canonicalCounty = slugify(data[0].county);
                    navigate(`/${canonicalCounty}`, { replace: true });
                    return;
                }

                // Step 2: Check if it's an area slug (constituency)
                const { data: areaData } = await supabase
                    .from('iebc_offices')
                    .select('county, constituency_name')
                    .or(`constituency_name.ilike.${slug.replace(/-/g, ' ')},constituency_name.ilike.${slug.replace(/-town$/, '').replace(/-/g, ' ')}`);

                if (areaData && (areaData as any[]).length > 0) {
                    const data = areaData as any[];
                    if (data.length === 1 || new Set(data.map(a => a.county)).size === 1) {
                        const match = data[0];
                        const county_slug = slugify(match.county);
                        let area_slug = slugify(match.constituency_name);

                        if (area_slug === county_slug) {
                            area_slug = `${area_slug}-town`;
                        }

                        navigate(`/${county_slug}/${area_slug}`, { replace: true });
                        return;
                    } else {
                        navigate(`/map?q=${slug}`, { replace: true });
                        return;
                    }
                }

                // Step 3: Check if it's a Ward slug
                const { data: wardData } = await supabase
                    .from('iebc_offices')
                    .select('county, constituency_name, ward_name')
                    .ilike('ward_name', slug.replace(/-/g, ' '))
                    .limit(1);

                if (wardData && (wardData as any[]).length > 0) {
                    const match = (wardData as any[])[0];
                    const county_slug = slugify(match.county);
                    const constituency_slug = slugify(match.constituency_name);
                    const ward_slug = slugify(match.ward_name);

                    navigate(`/${county_slug}/${constituency_slug}/${ward_slug}`, { replace: true });
                    return;
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
                <p className="mt-4 text-muted-foreground animate-pulse">Resolving IEBC mapping for {slug}...</p>
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
