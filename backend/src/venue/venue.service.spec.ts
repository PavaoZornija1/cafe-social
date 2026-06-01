jest.mock('./geofence', () => ({
  parseVenueGeofencePolygonInput: (input: unknown) => input,
  assertPinInsidePolygon: jest.fn(),
  distanceToVenuePinMeters: (
    lat: number,
    lng: number,
    v: { latitude: number; longitude: number },
  ) => {
    const dLat = lat - v.latitude;
    const dLng = lng - v.longitude;
    return Math.sqrt(dLat * dLat + dLng * dLng) * 111_000;
  },
  pointInVenueGeofence: jest.fn(),
}));

import { NotFoundException } from '@nestjs/common';
import { VenueService } from './venue.service';
import { PROXIMITY_ALERT_RADIUS_DEFAULT } from '../lib/proximity-alert-radius';

const playPolygon = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [15.9, 45.8],
      [15.901, 45.8],
      [15.901, 45.801],
      [15.9, 45.801],
      [15.9, 45.8],
    ],
  ],
};

describe('VenueService', () => {
  let service: VenueService;
  let venues: {
    findById: jest.Mock;
    update: jest.Mock;
    create: jest.Mock;
  };
  let prisma: {
    venue: { findMany: jest.Mock; findUnique: jest.Mock };
  };

  beforeEach(() => {
    venues = {
      findById: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    };
    prisma = {
      venue: { findMany: jest.fn(), findUnique: jest.fn() },
    };
    service = new VenueService(venues as never, prisma as never);
  });

  describe('create', () => {
    it('sets default proximity alert fields', async () => {
      venues.create.mockResolvedValue({ id: 'v1' });
      await service.create({
        name: 'Pilot Café',
        latitude: 45.8,
        longitude: 15.9,
        geofencePolygon: playPolygon,
      } as never);

      expect(venues.create).toHaveBeenCalledWith(
        expect.objectContaining({
          proximityAlertRadiusMeters: 100,
          proximityAlertsEnabled: true,
        }),
      );
    });
  });

  describe('update', () => {
    const existing = {
      id: 'v1',
      latitude: 45.8,
      longitude: 15.9,
      geofencePolygon: playPolygon,
    };

    it('resets proximity radius to default when pin moves', async () => {
      venues.findById.mockResolvedValue(existing);
      venues.update.mockResolvedValue(existing);

      await service.update('v1', { latitude: 45.802 } as never);

      expect(venues.update).toHaveBeenCalledWith(
        'v1',
        expect.objectContaining({
          latitude: 45.802,
          proximityAlertRadiusMeters: PROXIMITY_ALERT_RADIUS_DEFAULT,
        }),
      );
    });

    it('does not reset proximity radius when only non-geo fields change', async () => {
      venues.findById.mockResolvedValue(existing);
      venues.update.mockResolvedValue(existing);

      await service.update('v1', { name: 'Renamed' } as never);

      const patch = venues.update.mock.calls[0]![1] as Record<string, unknown>;
      expect(patch.proximityAlertRadiusMeters).toBeUndefined();
    });
  });

  describe('updateForAdmin', () => {
    it('persists normalized proximity radius from admin patch', async () => {
      venues.findById.mockResolvedValue({
        id: 'v1',
        latitude: 45.8,
        longitude: 15.9,
        geofencePolygon: playPolygon,
        organizationId: null,
      });
      venues.update.mockResolvedValue({ id: 'v1' });

      await service.updateForAdmin('v1', { proximityAlertRadiusMeters: 175 } as never);

      expect(venues.update).toHaveBeenCalledWith(
        'v1',
        expect.objectContaining({ proximityAlertRadiusMeters: 175 }),
      );
    });
  });

  describe('listProximityGeofencesNear', () => {
    it('returns nearest venues sorted, capped, without distance field', async () => {
      prisma.venue.findMany.mockResolvedValue([
        {
          id: 'far',
          name: 'Far',
          latitude: 46.5,
          longitude: 16.5,
          proximityAlertRadiusMeters: 100,
        },
        {
          id: 'near',
          name: 'Near',
          latitude: 45.801,
          longitude: 15.901,
          proximityAlertRadiusMeters: 200,
        },
      ]);

      const out = await service.listProximityGeofencesNear({
        latitude: 45.8,
        longitude: 15.9,
        limit: 1,
      });

      expect(prisma.venue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { locked: false, proximityAlertsEnabled: true },
        }),
      );
      expect(out).toHaveLength(1);
      expect(out[0]).toEqual({
        venueId: 'near',
        name: 'Near',
        latitude: 45.801,
        longitude: 15.901,
        radiusMeters: 200,
      });
      expect(out[0]).not.toHaveProperty('distanceMeters');
    });
  });

  describe('findOne', () => {
    it('throws when venue missing', async () => {
      venues.findById.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
