/**
 * Push deep-link parsers live in the mobile app; backend tests keep them honest for pilot flows.
 */
import {
  DAILY_STREAK_AT_RISK_KIND,
  PERK_EXPIRY_REMINDER_KIND,
  VENUE_CAMPAIGN_PUSH_TYPE,
  VENUE_PROXIMITY_ARRIVAL_PUSH_TYPE,
  parseDailyStreakAtRiskPayload,
  parsePerkExpiryReminderPayload,
  parseVenueCampaignPayload,
  parseVenueProximityArrivalPayload,
} from '../../../app/src/lib/partnerMarketingPush';

describe('partnerMarketingPush parsers (app)', () => {
  describe('parseVenueProximityArrivalPayload', () => {
    it('parses proximity arrival payload', () => {
      const out = parseVenueProximityArrivalPayload({
        type: VENUE_PROXIMITY_ARRIVAL_PUSH_TYPE,
        venueId: 'venue-1',
        venueName: 'Pilot Café',
        pushCategory: 'partner_marketing',
      });
      expect(out).toEqual({
        type: VENUE_PROXIMITY_ARRIVAL_PUSH_TYPE,
        venueId: 'venue-1',
        venueName: 'Pilot Café',
        pushCategory: 'partner_marketing',
      });
    });

    it('returns null for wrong type', () => {
      expect(
        parseVenueProximityArrivalPayload({
          type: VENUE_CAMPAIGN_PUSH_TYPE,
          venueId: 'venue-1',
        }),
      ).toBeNull();
    });
  });

  describe('parseVenueCampaignPayload', () => {
    it('parses campaign payload', () => {
      const out = parseVenueCampaignPayload({
        type: VENUE_CAMPAIGN_PUSH_TYPE,
        venueId: 'v1',
        campaignId: 'c1',
        venueName: 'Café',
      });
      expect(out?.campaignId).toBe('c1');
      expect(out?.venueId).toBe('v1');
    });
  });

  describe('parsePerkExpiryReminderPayload', () => {
    it('parses perk expiry reminder', () => {
      const out = parsePerkExpiryReminderPayload({
        kind: PERK_EXPIRY_REMINDER_KIND,
        venueId: 'v1',
        redemptionId: 'r1',
      });
      expect(out).toEqual({
        kind: PERK_EXPIRY_REMINDER_KIND,
        venueId: 'v1',
        redemptionId: 'r1',
      });
    });
  });

  describe('parseDailyStreakAtRiskPayload', () => {
    it('parses streak-at-risk with numeric streak', () => {
      const out = parseDailyStreakAtRiskPayload({
        kind: DAILY_STREAK_AT_RISK_KIND,
        scopeKey: 'global',
        streak: 4,
      });
      expect(out).toEqual({
        kind: DAILY_STREAK_AT_RISK_KIND,
        scopeKey: 'global',
        venueId: undefined,
        streak: 4,
      });
    });

    it('coerces string streak', () => {
      const out = parseDailyStreakAtRiskPayload({
        kind: DAILY_STREAK_AT_RISK_KIND,
        scopeKey: 'venue-1',
        venueId: 'venue-1',
        streak: '5',
      });
      expect(out?.streak).toBe(5);
      expect(out?.venueId).toBe('venue-1');
    });
  });
});
