import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { PerkExpiryReminderScheduler } from './perk-expiry-reminder.scheduler';

describe('PerkExpiryReminderScheduler', () => {
  let scheduler: PerkExpiryReminderScheduler;
  let prisma: {
    venuePerkRedemption: { findMany: jest.Mock };
    venueStaff: { findMany: jest.Mock };
    perkExpiryReminderLog: { findUnique: jest.Mock; create: jest.Mock };
    player: { findUnique: jest.Mock };
    playerExpoPushToken: { findMany: jest.Mock };
  };
  let push: { sendExpo: jest.Mock };

  const candidate = (over: Partial<{ id: string; playerId: string; venueId: string }> = {}) => ({
    id: over.id ?? 'r1',
    playerId: over.playerId ?? 'p1',
    venueId: over.venueId ?? 'v1',
    perk: { title: 'Free coffee' },
    venue: { name: 'Cafe A' },
  });

  beforeEach(async () => {
    prisma = {
      venuePerkRedemption: { findMany: jest.fn().mockResolvedValue([]) },
      venueStaff: { findMany: jest.fn().mockResolvedValue([]) },
      perkExpiryReminderLog: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      player: {
        findUnique: jest.fn().mockResolvedValue({
          totalPrivacy: false,
          partnerMarketingPush: true,
        }),
      },
      playerExpoPushToken: {
        findMany: jest.fn().mockResolvedValue([{ token: 'ExponentPushToken[x]' }]),
      },
    };
    push = { sendExpo: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PerkExpiryReminderScheduler,
        { provide: PrismaService, useValue: prisma },
        { provide: PushService, useValue: push },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
      ],
    }).compile();
    scheduler = moduleRef.get(PerkExpiryReminderScheduler);
  });

  it('skips reminders for claimants who are staff at that same venue', async () => {
    prisma.venuePerkRedemption.findMany.mockResolvedValue([candidate()]);
    prisma.venueStaff.findMany.mockResolvedValue([{ playerId: 'p1', venueId: 'v1' }]);

    await scheduler.sendUpcomingExpiryPushes();

    expect(push.sendExpo).not.toHaveBeenCalled();
    expect(prisma.perkExpiryReminderLog.create).not.toHaveBeenCalled();
  });

  it('still reminds a claimant who is staff at a different venue', async () => {
    prisma.venuePerkRedemption.findMany.mockResolvedValue([candidate({ venueId: 'v2' })]);
    // Staff membership at v1 only; the redemption is at v2.
    prisma.venueStaff.findMany.mockResolvedValue([{ playerId: 'p1', venueId: 'v1' }]);

    await scheduler.sendUpcomingExpiryPushes();

    expect(push.sendExpo).toHaveBeenCalledTimes(1);
    expect(prisma.perkExpiryReminderLog.create).toHaveBeenCalledWith({
      data: { redemptionId: 'r1', kind: 'active_to_minus_24h' },
    });
  });

  it('batches the staff lookup in a single query', async () => {
    prisma.venuePerkRedemption.findMany.mockResolvedValue([
      candidate({ id: 'r1', playerId: 'p1', venueId: 'v1' }),
      candidate({ id: 'r2', playerId: 'p2', venueId: 'v2' }),
    ]);

    await scheduler.sendUpcomingExpiryPushes();

    expect(prisma.venueStaff.findMany).toHaveBeenCalledTimes(1);
    expect(push.sendExpo).toHaveBeenCalledTimes(2);
  });

  it('does not query staff when there are no candidates', async () => {
    await scheduler.sendUpcomingExpiryPushes();
    expect(prisma.venueStaff.findMany).not.toHaveBeenCalled();
  });
});
