const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeUuid(s: string): string | null {
  const t = s.trim().toLowerCase();
  return UUID_RE.test(t) ? t : null;
}

/**
 * Extract venue id from QR / deep link payloads we support:
 * - Raw UUID
 * - https://.../venue/<uuid> or .../venues/<uuid>
 * - Query ?venueId= or ?id=
 * - JSON { "venueId": "<uuid>" }
 * - cafesocial://unlock?venueId=... or similar (host part ignored)
 */
export function parseVenueIdFromQr(data: string): string | null {
  const raw = data.trim();
  const direct = normalizeUuid(raw);
  if (direct) return direct;

  try {
    const u = new URL(raw, 'https://invalid.local');
    const pathMatch = u.pathname.match(/\/(?:venue|venues)\/([0-9a-f-]{36})/i);
    if (pathMatch?.[1]) {
      const id = normalizeUuid(pathMatch[1]);
      if (id) return id;
    }
    for (const key of ['venueId', 'id', 'venue']) {
      const q = u.searchParams.get(key);
      const id = q ? normalizeUuid(q) : null;
      if (id) return id;
    }
  } catch {
    /* not a URL */
  }

  try {
    const j = JSON.parse(raw) as { venueId?: string };
    if (j.venueId) {
      const id = normalizeUuid(j.venueId);
      if (id) return id;
    }
  } catch {
    /* */
  }

  if (/^cafesocial:\/\//i.test(raw)) {
    const noScheme = raw.replace(/^cafesocial:\/\//i, '');
    try {
      const u = new URL(noScheme, 'https://app.local/');
      for (const key of ['venueId', 'id', 'venue']) {
        const q = u.searchParams.get(key);
        const id = q ? normalizeUuid(q) : null;
        if (id) return id;
      }
      const pathMatch = u.pathname.match(/\/(?:venue|venues)\/([0-9a-f-]{36})/i);
      if (pathMatch?.[1]) {
        const id = normalizeUuid(pathMatch[1]);
        if (id) return id;
      }
    } catch {
      /* */
    }
  }

  return null;
}
