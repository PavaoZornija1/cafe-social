import Constants from 'expo-constants';
import { Platform } from 'react-native';

const envApiUrl = (process.env.EXPO_PUBLIC_API_URL as string | undefined)?.trim();
const API_URL =
  envApiUrl && envApiUrl.length > 0 ? envApiUrl : 'http://localhost:3005/api';

if (
  __DEV__ &&
  Platform.OS !== 'web' &&
  Constants.isDevice &&
  (!envApiUrl || envApiUrl.includes('localhost') || envApiUrl.includes('127.0.0.1'))
) {
  // eslint-disable-next-line no-console
  console.warn(
    '[api] API URL is missing or still points at localhost — a real device cannot reach your Mac that way. Set EXPO_PUBLIC_API_URL in app/.env to http://<YOUR_MAC_LAN_IP>:3005/api (see ipconfig getifaddr en0), restart Metro with --clear and reload, or rebuild if JS is embedded from Xcode.',
  );
}

type Json = Record<string, unknown>;

async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const body = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;

  if (!res.ok) {
    let message = `Request failed with ${res.status}`;

    if (typeof body === 'string') {
      message = body;
    } else if (body) {
      const maybeMessage = (body as Json & { message?: unknown }).message;
      if (typeof maybeMessage === 'string') {
        message = maybeMessage;
      }
    }

    throw new Error(message);
  }

  return body as T;
}

export async function apiGet<T>(path: string, token?: string | null | undefined): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return handleResponse<T>(res);
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  token?: string | null | undefined,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(res);
}

export async function apiPatch<T>(
  path: string,
  body?: unknown,
  token?: string | null | undefined,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PATCH',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(res);
}

export async function apiDelete<T>(
  path: string,
  token?: string | null | undefined,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return handleResponse<T>(res);
}

