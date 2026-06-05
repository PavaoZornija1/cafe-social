import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { BrawlerArenaSocketPayload } from '../brawler/arena/arenaRealtime';
import { getRealtimeBaseUrl } from './realtimeUrl';

export type BrawlerSocketStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

/**
 * Subscribes to brawler arena realtime events for a session room.
 * Falls back to slow polling when the socket stays disconnected.
 */
export function useBrawlerSocket(options: {
  sessionId: string | null | undefined;
  enabled: boolean;
  getToken: () => Promise<string | null | undefined>;
  onArenaEvent: (payload: BrawlerArenaSocketPayload) => void;
  onRefresh: () => void | Promise<void>;
  fallbackPollMs?: number;
}): { socketStatus: BrawlerSocketStatus } {
  const onArenaRef = useRef(options.onArenaEvent);
  onArenaRef.current = options.onArenaEvent;
  const onRefreshRef = useRef(options.onRefresh);
  onRefreshRef.current = options.onRefresh;
  const getTokenRef = useRef(options.getToken);
  getTokenRef.current = options.getToken;

  const fallbackMs = options.fallbackPollMs ?? 8000;
  const [socketStatus, setSocketStatus] = useState<BrawlerSocketStatus>('idle');

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
      socket = io(`${base}/brawler`, {
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

      socket.on('arena', (payload: BrawlerArenaSocketPayload) => {
        if (!payload || payload.sessionId !== sid) return;
        onArenaRef.current(payload);
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
