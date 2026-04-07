import { apiPost } from './api';

export type ReportPlayerBody = {
  reportedPlayerId: string;
  reason: string;
  note?: string | null;
};

/** Staff receive reports in the partner portal; duplicate reports are rate-limited server-side. */
export function reportPlayerAtVenue(
  token: string,
  venueId: string,
  body: ReportPlayerBody,
): Promise<{ id: string }> {
  return apiPost<{ id: string }>(
    `/venue-context/${encodeURIComponent(venueId)}/report-player`,
    {
      reportedPlayerId: body.reportedPlayerId,
      reason: body.reason.trim(),
      ...(body.note?.trim() ? { note: body.note.trim() } : {}),
    },
    token,
  );
}
