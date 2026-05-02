const envApiUrl = (process.env.EXPO_PUBLIC_API_URL as string | undefined)?.trim();
const API_URL =
  envApiUrl && envApiUrl.length > 0 ? envApiUrl : 'http://localhost:3005/api';

/** HTTP origin for Socket.IO (strip `/api` path). */
export function getRealtimeBaseUrl(): string {
  try {
    const u = new URL(API_URL);
    return `${u.protocol}//${u.host}`;
  } catch {
    return 'http://localhost:3005';
  }
}
