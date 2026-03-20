// src/components/map/RadiusCircle.jsx
// Uber-style expanding radius circle animation
// Shows search area as dashed boundary with sonar pulse

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

const RadiusCircle = ({ center, radiusKm, animating = false }) => {
    const map = useMap();
    const circleRef = useRef(null);
    const pulseRef = useRef(null);
    const centerMarkerRef = useRef(null);
    const animFrameRef = useRef(null);

    useEffect(() => {
        if (!center || !Array.isArray(center) || center.length !== 2) return;
        if (isNaN(center[0]) || isNaN(center[1])) return;

        // Clean up previous
        if (circleRef.current) circleRef.current.remove();
        if (pulseRef.current) pulseRef.current.remove();
        if (centerMarkerRef.current) centerMarkerRef.current.remove();
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

        // Center dot — the searched location
        centerMarkerRef.current = L.circleMarker(center, {
            radius: 8,
            fillColor: '#007AFF',
            fillOpacity: 1,
            color: '#fff',
            weight: 2,
        }).addTo(map);

        // Static radius boundary (dashed)
        circleRef.current = L.circle(center, {
            radius: radiusKm * 1000,
            fillColor: '#007AFF',
            fillOpacity: 0.06,
            color: '#007AFF',
            weight: 1.5,
            dashArray: '6 4',
        }).addTo(map);

        // Expanding pulse circle animation (sonar effect)
        if (animating) {
            let startTime = null;
            const PULSE_DURATION = 2000;
            const MAX_RADIUS = radiusKm * 1000;

            pulseRef.current = L.circle(center, {
                radius: 0,
                fillColor: '#007AFF',
                fillOpacity: 0.15,
                color: '#007AFF',
                weight: 0,
            }).addTo(map);

            const animate = (timestamp) => {
                if (!startTime) startTime = timestamp;
                const elapsed = (timestamp - startTime) % PULSE_DURATION;
                const progress = elapsed / PULSE_DURATION;

                // Ease out cubic
                const eased = 1 - Math.pow(1 - progress, 3);

                const currentRadius = eased * MAX_RADIUS;
                const currentOpacity = 0.2 * (1 - progress);

                if (pulseRef.current) {
                    pulseRef.current.setRadius(currentRadius);
                    pulseRef.current.setStyle({ fillOpacity: currentOpacity });
                }

                animFrameRef.current = requestAnimationFrame(animate);
            };

            animFrameRef.current = requestAnimationFrame(animate);
        }

        return () => {
            if (circleRef.current) circleRef.current.remove();
            if (pulseRef.current) pulseRef.current.remove();
            if (centerMarkerRef.current) centerMarkerRef.current.remove();
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        };
    }, [center, radiusKm, animating, map]);

    return null;
};

export default RadiusCircle;
