import { useAuth } from '@clerk/expo';
import React, { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { apiPost } from '../lib/api';
import { fetchDetectedVenue } from '../lib/venueDetectClient';

/**
 * Periodically re-posts **geofence venue presence** while signed in — whatever the user is doing
 * (Home, settings, word game, etc.). Lets the server measure **real time on premise** for the
 * optional “grab a drink” nudge, not time spent in a match.
 */
const INTERVAL_MS = 5 * 60 * 1000;

export function VenuePresenceHeartbeat() {
    const { isLoaded, isSignedIn, getToken } = useAuth();
    const getTokenRef = useRef(getToken);
    getTokenRef.current = getToken;

    useEffect(() => {
        if (!isLoaded || !isSignedIn) return;

        async function ping() {
            try {
                const token = await getTokenRef.current();
                if (!token) return;
                const v = await fetchDetectedVenue();
                await apiPost('/social/me/presence', { venueId: v?.id ?? null }, token);
            } catch {
                /* non-blocking */
            }
        }

        void ping();
        const id = setInterval(() => void ping(), INTERVAL_MS);
        const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
            if (s === 'active') void ping();
        });

        return () => {
            clearInterval(id);
            sub.remove();
        };
    }, [isLoaded, isSignedIn]);

    return null;
}
