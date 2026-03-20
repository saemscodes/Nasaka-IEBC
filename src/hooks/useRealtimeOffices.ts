// src/hooks/useRealtimeOffices.ts
// Supabase Realtime — live marker updates when HITL pipeline validates coordinates
// Smooth marker animation, fade-out on deactivation

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import L from 'leaflet';

interface UseRealtimeOfficesProps {
    map: L.Map | null;
    enabled: boolean;
    onOfficeUpdated?: (office: any) => void;
    onOfficeInserted?: (office: any) => void;
    onOfficeRemoved?: (officeId: number) => void;
}

export function useRealtimeOffices({
    map,
    enabled,
    onOfficeUpdated,
    onOfficeInserted,
    onOfficeRemoved,
}: UseRealtimeOfficesProps) {
    const channelRef = useRef<any>(null);

    // Smooth marker position animation (Kalman filter concept applied visually)
    const animateMarkerTo = useCallback((marker: L.Marker, newLatLng: L.LatLng, durationMs: number) => {
        const startLatLng = marker.getLatLng();
        const startTime = performance.now();

        function step(currentTime: number) {
            const elapsed = currentTime - startTime;
            const t = Math.min(elapsed / durationMs, 1);

            // Ease in-out cubic
            const eased = t < 0.5
                ? 4 * t * t * t
                : 1 - Math.pow(-2 * t + 2, 3) / 2;

            const lat = startLatLng.lat + (newLatLng.lat - startLatLng.lat) * eased;
            const lng = startLatLng.lng + (newLatLng.lng - startLatLng.lng) * eased;

            marker.setLatLng([lat, lng]);

            if (t < 1) {
                requestAnimationFrame(step);
            }
        }

        requestAnimationFrame(step);
    }, []);

    // Fade out marker before removal
    const fadeOutMarker = useCallback((marker: L.Marker) => {
        const el = marker.getElement();
        if (el) {
            el.style.transition = 'opacity 0.5s ease';
            el.style.opacity = '0';
            setTimeout(() => marker.remove(), 500);
        } else {
            marker.remove();
        }
    }, []);

    useEffect(() => {
        if (!enabled || !map) return;

        channelRef.current = supabase
            .channel('iebc-office-realtime-markers')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'iebc_offices',
                },
                (payload) => {
                    const updated = payload.new as any;
                    if (onOfficeUpdated) {
                        onOfficeUpdated(updated);
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'iebc_offices',
                },
                (payload) => {
                    const inserted = payload.new as any;
                    if (inserted.verified && inserted.latitude && inserted.longitude) {
                        if (onOfficeInserted) {
                            onOfficeInserted(inserted);
                        }
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'iebc_offices',
                },
                (payload) => {
                    const deleted = payload.old as any;
                    if (onOfficeRemoved) {
                        onOfficeRemoved(deleted.id);
                    }
                }
            )
            .subscribe();

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [map, enabled, onOfficeUpdated, onOfficeInserted, onOfficeRemoved]);

    return {
        animateMarkerTo,
        fadeOutMarker,
    };
}
