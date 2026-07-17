import { Test } from '@nestjs/testing';
import { VenueOfferFulfillment, VenueOfferStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VenueStaffService } from '../venue-staff/venue-staff.service';
import { PlayerVenueStatsRepository } from './player-venue-stats.repository';

describe('PlayerVenueStatsRepository.addVenueXp', () => {
  let repo: PlayerVenueStatsRepository;
  let prisma: {
    venueOffer: { findMany: jest.Mock };
    playerVenueStats: { upsert: jest.Mock };
  };
  let venueStaff: { isStaffAtVenue: jest.Mock };

  const liveAutoOffer = (multiplier: number) => ({
    autoXpMultiplier: multiplier,
    validFrom: null,
    validTo: null,
    status: VenueOfferStatus.ACTIVE,
    fulfillment: VenueOfferFulfillment.AUTO,
  });

  beforeEach(async () => {
    prisma = {
      venueOffer: { findMany: jest.fn().mockResolvedValue([]) },
      playerVenueStats: { upsert: jest.fn().mockResolvedValue({}) },
    };
    venueStaff = { isStaffAtVenue: jest.fn().mockResolvedValue(false) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PlayerVenueStatsRepository,
        { provide: PrismaService, useValue: prisma },
        { provide: VenueStaffService, useValue: venueStaff },
      ],
    }).compile();
    repo = moduleRef.get(PlayerVenueStatsRepository);
  });

  it('applies the active AUTO multiplier for guests', async () => {
    prisma.venueOffer.findMany.mockResolvedValue([liveAutoOffer(2)]);

    await repo.addVenueXp('p1', 'v1', 10);

    expect(prisma.playerVenueStats.upsert).toHaveBeenCalledWith({
      where: { playerId_venueId: { playerId: 'p1', venueId: 'v1' } },
      create: { playerId: 'p1', venueId: 'v1', venueXp: 20 },
      update: { venueXp: { increment: 20 } },
    });
  });

  it('awards base XP without the multiplier when the player is staff at that venue', async () => {
    prisma.venueOffer.findMany.mockResolvedValue([liveAutoOffer(3)]);
    venueStaff.isStaffAtVenue.mockResolvedValue(true);

    await repo.addVenueXp('p1', 'v1', 10);

    expect(venueStaff.isStaffAtVenue).toHaveBeenCalledWith('p1', 'v1');
    expect(prisma.playerVenueStats.upsert).toHaveBeenCalledWith({
      where: { playerId_venueId: { playerId: 'p1', venueId: 'v1' } },
      create: { playerId: 'p1', venueId: 'v1', venueXp: 10 },
      update: { venueXp: { increment: 10 } },
    });
  });

  it('scopes the staff exclusion to the exact venue receiving XP', async () => {
    // Player is staff somewhere else; at v2 they are a normal guest.
    prisma.venueOffer.findMany.mockResolvedValue([liveAutoOffer(2)]);
    venueStaff.isStaffAtVenue.mockResolvedValue(false);

    await repo.addVenueXp('p1', 'v2', 5);

    expect(venueStaff.isStaffAtVenue).toHaveBeenCalledWith('p1', 'v2');
    expect(prisma.playerVenueStats.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { venueXp: { increment: 10 } },
      }),
    );
  });

  it('does nothing for a zero delta', async () => {
    await repo.addVenueXp('p1', 'v1', 0);
    expect(prisma.playerVenueStats.upsert).not.toHaveBeenCalled();
    expect(venueStaff.isStaffAtVenue).not.toHaveBeenCalled();
  });
});
