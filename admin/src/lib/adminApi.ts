const base =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) ||
  "http://localhost:3001/api";

export function adminHeaders(): HeadersInit {
  if (typeof window === "undefined") return {};
  const key = sessionStorage.getItem("adminApiKey") ?? "";
  return {
    "Content-Type": "application/json",
    ...(key ? { "X-Admin-Key": key } : {}),
  };
}

export async function adminFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { ...adminHeaders(), ...(init?.headers as object) },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || res.statusText);
  }
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export { base as adminApiBase };
