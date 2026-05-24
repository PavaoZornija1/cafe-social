export const MEMBER_CARD_QR_KIND = 'member_card' as const;

export type MemberCardQrPayload = {
  kind: typeof MEMBER_CARD_QR_KIND;
  memberToken: string;
  v: 1;
};

/** JSON string for the member's personal loyalty QR (staff scanners). */
export function buildMemberCardQrPayload(memberToken: string): string {
  const payload: MemberCardQrPayload = {
    kind: MEMBER_CARD_QR_KIND,
    memberToken: memberToken.trim(),
    v: 1,
  };
  return JSON.stringify(payload);
}

/** Deep link fallback: loyaltysocial://member?t=… or cafesocial://member?t=… */
export function buildMemberCardDeepLink(memberToken: string, scheme = 'cafesocial'): string {
  return `${scheme}://member?t=${encodeURIComponent(memberToken.trim())}`;
}

function normalizeToken(raw: string): string | null {
  const t = raw.trim();
  if (t.length < 16 || t.length > 128) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(t)) return null;
  return t;
}

/**
 * Parses member QR / barcode data into a member token, else `null`.
 * Accepts JSON payload, deep links, or raw token string.
 */
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
    if (j.kind === MEMBER_CARD_QR_KIND || j.kind === 'member_card') {
      const token =
        (typeof j.memberToken === 'string' && j.memberToken) ||
        (typeof j.token === 'string' && j.token) ||
        '';
      const parsed = normalizeToken(token);
      if (parsed) return parsed;
    }
  } catch {
    /* not JSON */
  }

  return null;
}
