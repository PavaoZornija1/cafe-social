const API_URL = (process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? 'http://localhost:3005/api';

/** HTTP origin for Socket.IO (strip `/api` path). */
export function getRealtimeBaseUrl(): string {
  try {
    const u = new URL(API_URL);
    return `${u.protocol}//${u.host}`;
  } catch {
    return 'http://localhost:3005';
  }
}
