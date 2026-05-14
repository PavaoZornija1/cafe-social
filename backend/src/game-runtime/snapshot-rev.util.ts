import { BadRequestException } from '@nestjs/common';

/** Parse `If-Match` / weak ETag style values to a monotonic revision integer. */
export function parseIfMatchHeader(h?: string): number | undefined {
  if (h == null) return undefined;
  const t = h.trim();
  if (!t || t === '*') return undefined;
  let s = t;
  if (/^W\//i.test(s)) s = s.slice(2);
  s = s.replace(/^["']|["']$/g, '').trim();
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

export function resolveIfSnapshotRev(
  ifMatchHeader: string | undefined,
  bodyRev?: number,
): number | undefined {
  const fromH = parseIfMatchHeader(ifMatchHeader);
  if (fromH !== undefined && bodyRev !== undefined && fromH !== bodyRev) {
    throw new BadRequestException('If-Match and ifSnapshotRev disagree');
  }
  return fromH ?? bodyRev;
}
