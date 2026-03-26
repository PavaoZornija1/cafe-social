export type DailyWordScope = 'global' | 'venue';

export class DailyWordGuessDto {
  scope!: DailyWordScope;
  venueId?: string;
  /** Client-detected venue (same idea as challenges). */
  detectedVenueId?: string | null;
  language?: string;
  guess!: string;
}
