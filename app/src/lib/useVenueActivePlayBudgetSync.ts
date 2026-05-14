import { useEffect, useRef } from 'react';
import { apiPost } from './api';
import { fetchDetectedVenue } from './venueDetectClient';

export type VenueActivePlayKind = 'solo_word' | 'word_match' | 'brawler';

type BeginRes = { sessionId: string | null; skipped: boolean };

type TickRes = { remainingActiveSeconds: number; creditedSeconds: number };

/**
 * Server-authoritative “stamina” ticks while the player is in an active venue game.
 * Skipped when `subscriptionActive` or no `venueId`.
 */
export function useVenueActivePlayBudgetSync(opts: {
  getToken: () => Promise<string | null>;
  venueId: string | null | undefined;
  subscriptionActive: boolean;
  kind: VenueActivePlayKind;
  gameSessionId?: string | null;
  soloWordSessionId?: string | null;
  enabled: boolean;
  tickMs?: number;
  onBudgetExhausted?: () => void;
}): void {
  const sessionIdRef = useRef<string | null>(null);
  const endedRef = useRef(false);
  const getTokenRef = useRef(opts.getToken);
  const onBudgetExhaustedRef = useRef(opts.onBudgetExhausted);
  getTokenRef.current = opts.getToken;
  onBudgetExhaustedRef.current = opts.onBudgetExhausted;

  const tickMs = opts.tickMs ?? 20_000;

  useEffect(() => {
    endedRef.current = false;
    sessionIdRef.current = null;
    if (!opts.enabled || !opts.venueId?.trim() || opts.subscriptionActive) {
      return;
    }

    let interval: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    async function endSessionIfOpen() {
      const sid = sessionIdRef.current;
      sessionIdRef.current = null;
      if (!sid || endedRef.current) return;
      endedRef.current = true;
      try {
        const token = await getTokenRef.current();
        if (!token) return;
        await apiPost('/venue-play-budget/active-play/end', { sessionId: sid }, token);
      } catch {
        /* best-effort */
      }
    }

    async function tickOnce() {
      const sid = sessionIdRef.current;
      if (!sid || cancelled) return;
      const t = await getTokenRef.current();
      if (!t) return;
      const loc = await fetchDetectedVenue({ locationAccuracy: 'high' });
      if (!loc.coords) return;
      try {
        const tick = await apiPost<TickRes>(
          '/venue-play-budget/active-play/tick',
          {
            sessionId: sid,
            latitude: loc.coords.lat,
            longitude: loc.coords.lng,
          },
          t,
        );
        if (tick.remainingActiveSeconds <= 0) {
          onBudgetExhaustedRef.current?.();
        }
      } catch (e) {
        const st = (e as Error & { status?: number }).status;
        if (st === 403) {
          onBudgetExhaustedRef.current?.();
        }
      }
    }

    async function begin() {
      const token = await getTokenRef.current();
      if (!token || cancelled) return;
      const { coords } = await fetchDetectedVenue({ locationAccuracy: 'high' });
      if (!coords || cancelled) return;
      const body: Record<string, unknown> = {
        venueId: opts.venueId!.trim(),
        kind: opts.kind,
        latitude: coords.lat,
        longitude: coords.lng,
      };
      if (opts.gameSessionId) body.gameSessionId = opts.gameSessionId;
      if (opts.soloWordSessionId) body.soloWordSessionId = opts.soloWordSessionId;
      try {
        const res = await apiPost<BeginRes>(
          '/venue-play-budget/active-play/begin',
          body,
          token,
        );
        if (cancelled) return;
        if (res.skipped || !res.sessionId) return;
        sessionIdRef.current = res.sessionId;
        endedRef.current = false;

        void tickOnce();
        interval = setInterval(() => {
          void tickOnce();
        }, tickMs);
      } catch {
        /* begin is best-effort; game APIs may still surface errors */
      }
    }

    void begin();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      void endSessionIfOpen();
    };
  }, [
    opts.enabled,
    opts.venueId,
    opts.subscriptionActive,
    opts.kind,
    opts.gameSessionId,
    opts.soloWordSessionId,
    tickMs,
  ]);
}
