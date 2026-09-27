jest.mock('../venue/geofence', () => ({
  parseVenueGeofencePolygonInput: (g: unknown) => g,
  assertPinInsidePolygon: jest.fn(),
}));

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  PartnerVenueApplicationStatus,
  VenueOrganizationKind,
} from '@prisma/client';
import { PartnerApplicationService } from './partner-application.service';

describe('PartnerApplicationService', () => {
  const prisma = {
    partnerVenueApplication: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const provisioning = {
    provisionPartnerOrgAndVenue: jest.fn(),
  };

  const players = {
    findOrCreateByEmail: jest.fn(),
  };

  function svc() {
    return new PartnerApplicationService(
      prisma as never,
      provisioning as never,
      players as never,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPublicApplication', () => {
    it('creates pending application without geofence', async () => {
      prisma.partnerVenueApplication.findFirst.mockResolvedValue(null);
      prisma.partnerVenueApplication.create.mockResolvedValue({
        id: 'app-1',
        status: PartnerVenueApplicationStatus.PENDING,
      });

      const result = await svc().createPublicApplication({
        applicantEmail: 'Owner@Cafe.com',
        applicantName: 'Alex',
        venueName: 'Northside',
        address: 'Main 1',
        city: 'Zagreb',
        country: 'HR',
      });

      expect(result.status).toBe('PENDING');
      expect(prisma.partnerVenueApplication.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            applicantEmail: 'owner@cafe.com',
          }),
        }),
      );
    });

    it('blocks duplicate pending email', async () => {
      prisma.partnerVenueApplication.findFirst.mockResolvedValue({ id: 'x' });
      await expect(
        svc().createPublicApplication({
          applicantEmail: 'a@b.com',
          applicantName: 'A',
          venueName: 'V',
          address: '1',
          city: 'C',
          country: 'HR',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('approve', () => {
    const polygon = {
      type: 'Polygon' as const,
      coordinates: [
        [
          [14.5, 46.05],
          [14.51, 46.05],
          [14.51, 46.06],
          [14.5, 46.06],
          [14.5, 46.05],
        ],
      ],
    };

    it('requires pending status', async () => {
      prisma.partnerVenueApplication.findUnique.mockResolvedValue({
        id: 'app-1',
        status: PartnerVenueApplicationStatus.REJECTED,
        applicantEmail: 'a@b.com',
        venueName: 'V',
        address: '1',
        city: 'C',
        country: 'HR',
      });
      await expect(
        svc().approve('app-1', 'reviewer-1', {
          latitude: 46.055,
          longitude: 14.505,
          geofencePolygon: polygon,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('provisions org and venue on approve', async () => {
      prisma.partnerVenueApplication.findUnique.mockResolvedValue({
        id: 'app-1',
        status: PartnerVenueApplicationStatus.PENDING,
        applicantEmail: 'owner@cafe.com',
        venueName: 'Northside',
        address: 'Main 1',
        city: 'Zagreb',
        country: 'HR',
      });
      players.findOrCreateByEmail.mockResolvedValue({ id: 'player-1' });
      provisioning.provisionPartnerOrgAndVenue.mockResolvedValue({
        organizationId: 'org-1',
        venueId: 'venue-1',
        trialEndsAt: new Date().toISOString(),
        locationKind: VenueOrganizationKind.SINGLE_LOCATION,
      });
      prisma.partnerVenueApplication.update.mockResolvedValue({});

      const result = await svc().approve('app-1', 'reviewer-1', {
        latitude: 46.055,
        longitude: 14.505,
        geofencePolygon: polygon,
      });

      expect(result.venueId).toBe('venue-1');
      expect(provisioning.provisionPartnerOrgAndVenue).toHaveBeenCalled();
    });
  });

  describe('reject', () => {
    it('throws when application missing', async () => {
      prisma.partnerVenueApplication.findUnique.mockResolvedValue(null);
      await expect(svc().reject('missing', 'r1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
