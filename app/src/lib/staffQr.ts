/** Same rule as backend `staffVerificationCodeFromRedemptionId` (last 8 hex chars, uppercase). */
export function staffCodeFromRedemptionId(redemptionId: string): string {
  const hex = redemptionId.replace(/-/g, '').toUpperCase();
  return hex.slice(-8);
}

function normalizeEightCharCode(s: string): string | null {
  const t = s.replace(/\s/g, '').toUpperCase();
  if (/^[0-9A-F]{8}$/.test(t)) return t;
  return null;
}

/**
 * Parses QR/manual payload into an 8-character staff verification code.
 * Accepts: raw code, full redemption UUID, JSON with staffVerificationCode / code / redemptionId.
 */
export function parseStaffVerificationFromQr(data: string): string | null {
  const raw = data.trim();
  if (!raw) return null;

  const direct = normalizeEightCharCode(raw);
  if (direct) return direct;

  // UUID (with or without dashes) → same trailing code as server
  const uuidCompact = raw.replace(/-/g, '');
  if (/^[0-9a-fA-F]{32}$/.test(uuidCompact)) {
    return staffCodeFromRedemptionId(raw);
  }

  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    const code =
      (typeof j.staffVerificationCode === 'string' && j.staffVerificationCode) ||
      (typeof j.code === 'string' && j.code) ||
      (typeof j.staffCode === 'string' && j.staffCode) ||
      '';
    const fromJson = normalizeEightCharCode(code);
    if (fromJson) return fromJson;
    if (typeof j.redemptionId === 'string' && j.redemptionId) {
      return staffCodeFromRedemptionId(j.redemptionId);
    }
  } catch {
    /* not JSON */
  }

  return null;
}
