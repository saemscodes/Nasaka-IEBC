// src/hooks/useMapStateMachine.ts
// State-driven map zoom — Uber-style fitBounds/flyToBounds
// Replaces hardcoded zoom levels with context-aware auto-zoom

import { useCallback, useReducer, useRef } from 'react';
import L from 'leaflet';

export type MapPhase =
    | 'idle'
    | 'locating'
    | 'located'
    | 'searching'
    | 'results'
    | 'selected'
    | 'routing';

export interface MapState {
    phase: MapPhase;
    userLat: number | null;
    userLng: number | null;
    searchLat: number | null;
    searchLng: number | null;
    selectedOfficeId: number | string | null;
    nearbyOffices: any[];
    radiusKm: number;
    locationAccuracy: number | null;
    locationSource: 'gps' | 'ip' | 'ip_county_fallback' | 'ip_country_fallback' | 'manual' | null;
}

export type MapAction =
    | { type: 'START_LOCATING' }
    | { type: 'LOCATION_ACQUIRED'; lat: number; lng: number; accuracy: number; source: MapState['locationSource'] }
    | { type: 'LOCATION_FAILED' }
    | { type: 'SEARCH_STARTED'; lat: number; lng: number }
    | { type: 'OFFICES_FOUND'; offices: any[]; radiusKm: number }
    | { type: 'OFFICE_SELECTED'; officeId: number | string }
    | { type: 'OFFICE_DESELECTED' }
    | { type: 'ROUTING_STARTED' }
    | { type: 'RESET' };

const initialState: MapState = {
    phase: 'idle',
    userLat: null,
    userLng: null,
    searchLat: null,
    searchLng: null,
    selectedOfficeId: null,
    nearbyOffices: [],
    radiusKm: 15,
    locationAccuracy: null,
    locationSource: null,
};

function mapReducer(state: MapState, action: MapAction): MapState {
    switch (action.type) {
        case 'START_LOCATING':
            return { ...state, phase: 'locating' };

        case 'LOCATION_ACQUIRED':
            return {
                ...state,
                phase: 'located',
                userLat: action.lat,
                userLng: action.lng,
                locationAccuracy: action.accuracy,
                locationSource: action.source,
                searchLat: action.lat,
                searchLng: action.lng,
            };

        case 'LOCATION_FAILED':
            return { ...state, phase: 'idle' };

        case 'SEARCH_STARTED':
            return {
                ...state,
                phase: 'searching',
                searchLat: action.lat,
                searchLng: action.lng,
                nearbyOffices: [],
                selectedOfficeId: null,
            };

        case 'OFFICES_FOUND':
            return {
                ...state,
                phase: 'results',
                nearbyOffices: action.offices,
                radiusKm: action.radiusKm,
            };

        case 'OFFICE_SELECTED':
            return { ...state, phase: 'selected', selectedOfficeId: action.officeId };

        case 'OFFICE_DESELECTED':
            return {
                ...state,
                phase: state.nearbyOffices.length > 0 ? 'results' : 'located',
                selectedOfficeId: null,
            };

        case 'ROUTING_STARTED':
            return { ...state, phase: 'routing' };

        case 'RESET':
            return initialState;

        default:
            return state;
    }
}

export function useMapStateMachine() {
    const [state, dispatch] = useReducer(mapReducer, initialState);
    const stateRef = useRef(state);
    stateRef.current = state;

    const applyZoom = useCallback((map: L.Map | null, newState: MapState) => {
        if (!map) return;

        switch (newState.phase) {
            case 'idle':
                map.flyTo([-0.0236, 37.9062], 6, { duration: 1.0 });
                break;

            case 'locating':
                // No zoom change — spinner overlay handles UX
                break;

            case 'located':
                if (newState.userLat != null && newState.userLng != null) {
                    map.flyTo([newState.userLat, newState.userLng], 13, {
                        duration: 1.2,
                        easeLinearity: 0.25,
                    });
                }
                break;

            case 'searching':
                if (newState.searchLat != null && newState.searchLng != null) {
                    map.flyTo([newState.searchLat, newState.searchLng], 12, {
                        duration: 0.6,
                    });
                }
                break;

            case 'results': {
                if (newState.nearbyOffices.length === 0) break;

                const points: L.LatLngExpression[] = [];
                if (newState.searchLat != null && newState.searchLng != null) {
                    points.push([newState.searchLat, newState.searchLng]);
                }
                newState.nearbyOffices.slice(0, 10).forEach((o: any) => {
                    const lat = o.latitude ?? o.lat;
                    const lng = o.longitude ?? o.lng;
                    if (lat != null && lng != null) {
                        points.push([lat, lng]);
                    }
                });

                if (points.length === 0) break;

                const bounds = L.latLngBounds(points);
                map.flyToBounds(bounds, {
                    padding: [80, 80],
                    maxZoom: 14,
                    duration: 1.0,
                    easeLinearity: 0.25,
                });
                break;
            }

            case 'selected': {
                const office = newState.nearbyOffices.find(
                    (o: any) => o.id === newState.selectedOfficeId
                );
                if (!office) break;

                const officeLat = office.latitude ?? office.lat;
                const officeLng = office.longitude ?? office.lng;
                if (officeLat == null || officeLng == null) break;

                const selPoints: L.LatLngExpression[] = [];
                if (newState.userLat != null && newState.userLng != null) {
                    selPoints.push([newState.userLat, newState.userLng]);
                }
                selPoints.push([officeLat, officeLng]);

                if (selPoints.length === 1) {
                    map.flyTo(selPoints[0], 16, { duration: 1.2 });
                } else {
                    const selBounds = L.latLngBounds(selPoints);
                    map.flyToBounds(selBounds, {
                        padding: [100, 100],
                        maxZoom: 16,
                        duration: 1.4,
                        easeLinearity: 0.15,
                    });
                }
                break;
            }

            case 'routing':
                // Handled by RoutingSystem component
                break;
        }
    }, []);

    const dispatchWithZoom = useCallback((action: MapAction, map: L.Map | null) => {
        dispatch(action);
        // Apply zoom after state update
        const nextState = mapReducer(stateRef.current, action);
        // Use requestAnimationFrame to ensure state has settled
        requestAnimationFrame(() => {
            applyZoom(map, nextState);
        });
    }, [applyZoom]);

    return {
        mapState: state,
        dispatchMap: dispatchWithZoom,
        applyZoom,
    };
}
