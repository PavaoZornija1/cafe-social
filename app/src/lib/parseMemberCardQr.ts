const MEMBER_CARD_KIND = 'member_card';

function normalizeToken(raw: string): string | null {
  const t = raw.trim();
  if (t.length < 16 || t.length > 128) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(t)) return null;
  return t;
}

/** Parses a guest member loyalty QR into a member token for staff scanning. */
export function parseMemberTokenFromQr(data: string): string | null {
  const raw = data.trim();
  if (!raw) return null;

  const direct = normalizeToken(raw);
  if (direct) return direct;

  if (/^(?:cafesocial|loyaltysocial):\/\/member/i.test(raw)) {
    try {
      const noScheme = raw.replace(/^(?:cafesocial|loyaltysocial):\/\//i, '');
      const u = new URL(noScheme, 'https://app.local/');
      const t = u.searchParams.get('t') ?? u.searchParams.get('token') ?? u.searchParams.get('memberToken');
      if (t) {
        const parsed = normalizeToken(t);
        if (parsed) return parsed;
      }
    } catch {
      /* */
    }
  }

  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    if (j.kind === MEMBER_CARD_KIND) {
      const token =
        (typeof j.memberToken === 'string' && j.memberToken) ||
        (typeof j.token === 'string' && j.token) ||
        '';
      const parsed = normalizeToken(token);
      if (parsed) return parsed;
    }
  } catch {
    /* */
  }

  return null;
}
