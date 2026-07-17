// The controller import pulls ESM-only deps (turf via geofence, jose via auth);
// mock those leaves — this spec only reads route metadata, never instantiates.
jest.mock('../venue/venue.service', () => ({ VenueService: class VenueService {} }));
jest.mock('../venue/geofence', () => ({}));

import { VenueStaffRole } from '@prisma/client';
import { MIN_VENUE_ROLE_KEY } from '../venue-staff/min-venue-role.decorator';
import { MIN_ORG_ROLE_KEY } from '../venue-staff/min-org-role.decorator';
import { OwnerController } from './owner.controller';

function venueRoleOf(method: keyof OwnerController): VenueStaffRole | undefined {
  return Reflect.getMetadata(
    MIN_VENUE_ROLE_KEY,
    OwnerController.prototype[method] as object,
  ) as VenueStaffRole | undefined;
}

function orgRoleOf(method: keyof OwnerController): VenueStaffRole | undefined {
  return Reflect.getMetadata(
    MIN_ORG_ROLE_KEY,
    OwnerController.prototype[method] as object,
  ) as VenueStaffRole | undefined;
}

describe('OwnerController route role metadata', () => {
  describe('organization billing endpoints are OWNER-only', () => {
    it.each([
      'partnerStripeBillingPortal',
      'partnerStripeCheckout',
      'partnerStripePpvCheckout',
      'partnerStripeElementsSubscriptionSetup',
    ] as const)('%s requires org OWNER', (method) => {
      expect(orgRoleOf(method)).toBe(VenueStaffRole.OWNER);
    });

    it.each(['orgAnalytics', 'orgAnalyticsExportCsv', 'orgFunnelExportCsv'] as const)(
      '%s stays manager-accessible (guard default)',
      (method) => {
        expect(orgRoleOf(method)).toBeUndefined();
      },
    );
  });

  describe('moderation report/ban/appeal reads are MANAGER minimum', () => {
    it.each([
      'staffModerationSummary',
      'listBanAppeals',
      'listPlayerReports',
      'listVenueBans',
      'moderationAuditLog',
    ] as const)('%s requires MANAGER', (method) => {
      expect(venueRoleOf(method)).toBe(VenueStaffRole.MANAGER);
    });

    it.each(['scanMemberCard', 'venueRedemptions'] as const)(
      '%s stays EMPLOYEE (operational tools)',
      (method) => {
        expect(venueRoleOf(method)).toBe(VenueStaffRole.EMPLOYEE);
      },
    );
  });
});
