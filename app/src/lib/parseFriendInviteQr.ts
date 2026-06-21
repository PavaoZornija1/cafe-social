const FRIEND_INVITE_KIND = 'friend_invite';

function normalizeInviteToken(raw: string): string | null {
  const t = raw.trim();
  if (t.length < 16 || t.length > 128) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(t)) return null;
  return t;
}

function tokenFromRedeemUrl(raw: string): string | null {
  try {
    const normalized = raw.replace(/^cafesocial:\/\//i, 'https://x/');
    const u = new URL(normalized.includes('://') ? normalized : `https://x/${normalized}`);
    const token = u.searchParams.get('token');
    if (!token) return null;
    return normalizeInviteToken(token);
  } catch {
    return null;
  }
}

/** Parses a friend-invite QR / link into a redeem token, else `null`. */
export function parseFriendInviteTokenFromQr(data: string): string | null {
  const raw = data.trim();
  if (!raw) return null;

  if (/^cafesocial:\/\/redeem/i.test(raw) || /[?&]token=/.test(raw)) {
    const fromUrl = tokenFromRedeemUrl(raw);
    if (fromUrl) return fromUrl;
  }

  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    if (j.kind === FRIEND_INVITE_KIND) {
      const token = typeof j.token === 'string' ? j.token : '';
      const parsed = normalizeInviteToken(token);
      if (parsed) return parsed;
    }
  } catch {
    /* not JSON */
  }

  return normalizeInviteToken(raw);
}
