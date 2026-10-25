import { apiPost } from './api';

export type ReportPlayerBody = {
  reportedPlayerId: string;
  reason: string;
  note?: string | null;
};

/** Venue staff or platform moderators review reports; duplicates are rate-limited server-side. */
export function reportPlayerAtVenue(
  token: string,
  venueId: string | undefined,
  body: ReportPlayerBody,
): Promise<{ id: string }> {
  return apiPost<{ id: string }>(
    venueId ? `/venue-context/${encodeURIComponent(venueId)}/report-player` : '/venue-context/report-player',
    {
      reportedPlayerId: body.reportedPlayerId,
      reason: body.reason.trim(),
      ...(body.note?.trim() ? { note: body.note.trim() } : {}),
    },
    token,
  );
}
