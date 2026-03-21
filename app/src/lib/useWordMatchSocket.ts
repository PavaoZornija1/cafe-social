import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getRealtimeBaseUrl } from './realtimeUrl';

export type WordMatchSocketStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

/**
 * Subscribes to server push for a word match room. On `refresh`, refetch
 * `GET /words/matches/:id/state` (caller provides `onRefresh`).
 * Falls back to slow polling if the socket stays disconnected.
 */
export function useWordMatchSocket(options: {
  sessionId: string | null | undefined;
  enabled: boolean;
  getToken: () => Promise<string | null | undefined>;
  onRefresh: () => void | Promise<void>;
  /** Backup poll (ms) when socket is disconnected; 0 to disable */
  fallbackPollMs?: number;
}): { socketStatus: WordMatchSocketStatus } {
  const onRefreshRef = useRef(options.onRefresh);
  onRefreshRef.current = options.onRefresh;
  const getTokenRef = useRef(options.getToken);
  getTokenRef.current = options.getToken;

  const fallbackMs = options.fallbackPollMs ?? 30000;

  const [socketStatus, setSocketStatus] = useState<WordMatchSocketStatus>('idle');

  useEffect(() => {
    const sid = options.sessionId;
    if (!sid || !options.enabled) {
      setSocketStatus('idle');
      return;
    }

    let cancelled = false;
    let socket: Socket | null = null;
    let slowPoll: ReturnType<typeof setInterval> | null = null;

    const runRefresh = () => {
      void Promise.resolve(onRefreshRef.current());
    };

    setSocketStatus('connecting');

    (async () => {
      const token = await getTokenRef.current();
      if (cancelled || !token) {
        if (!cancelled) setSocketStatus('disconnected');
        return;
      }

      const base = getRealtimeBaseUrl();
      socket = io(`${base}/word-match`, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 12,
        reconnectionDelay: 1500,
      });

      socket.on('connect', () => {
        if (cancelled) return;
        setSocketStatus('connected');
        socket?.emit('subscribe', { sessionId: sid });
      });

      socket.on('disconnect', (reason) => {
        if (cancelled) return;
        if (reason === 'io client disconnect') {
          setSocketStatus('disconnected');
        } else {
          setSocketStatus('reconnecting');
        }
      });

      socket.io.on('reconnect_attempt', () => {
        if (!cancelled) setSocketStatus('reconnecting');
      });

      socket.on('connect_error', () => {
        if (!cancelled) setSocketStatus('reconnecting');
      });

      socket.on('refresh', () => {
        runRefresh();
      });

      if (fallbackMs > 0) {
        slowPoll = setInterval(() => {
          if (cancelled) return;
          if (socket && !socket.connected) {
            runRefresh();
          }
        }, fallbackMs);
      }
    })();

    return () => {
      cancelled = true;
      setSocketStatus('idle');
      if (slowPoll) clearInterval(slowPoll);
      if (socket) {
        try {
          if (socket.connected) {
            socket.emit('unsubscribe', { sessionId: sid });
          }
        } catch {
          /* */
        }
        socket.disconnect();
      }
      socket = null;
    };
  }, [options.sessionId, options.enabled, fallbackMs]);

  return { socketStatus };
}
