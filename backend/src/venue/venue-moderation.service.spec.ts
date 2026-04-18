import { BadRequestException } from '@nestjs/common';
import { VenueModerationService } from './venue-moderation.service';

describe('VenueModerationService', () => {
  function svc(prisma: {
    venuePlayerReport: {
      findFirst: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
    };
    venuePlayerBan: { findUnique: jest.Mock };
    venueBanAppeal: { findFirst: jest.Mock; create: jest.Mock };
  }) {
    const push = { sendExpo: jest.fn() };
    return new VenueModerationService(prisma as never, push as never);
  }

  describe('createReport', () => {
    it('rejects self-report', async () => {
      const prisma = {
        venuePlayerReport: {
          findFirst: jest.fn(),
          count: jest.fn(),
          create: jest.fn(),
        },
        venuePlayerBan: { findUnique: jest.fn() },
        venueBanAppeal: { findFirst: jest.fn(), create: jest.fn() },
      };
      await expect(
        svc(prisma).createReport({
          venueId: 'v1',
          reporterId: 'p1',
          reportedPlayerId: 'p1',
          reason: 'abuse',
          note: null,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.venuePlayerReport.findFirst).not.toHaveBeenCalled();
    });

    it('rejects duplicate report within 24h', async () => {
      const prisma = {
        venuePlayerReport: {
          findFirst: jest.fn().mockResolvedValue({ id: 'r1' }),
          count: jest.fn(),
          create: jest.fn(),
        },
        venuePlayerBan: { findUnique: jest.fn() },
        venueBanAppeal: { findFirst: jest.fn(), create: jest.fn() },
      };
      await expect(
        svc(prisma).createReport({
          venueId: 'v1',
          reporterId: 'p1',
          reportedPlayerId: 'p2',
          reason: 'spam',
          note: null,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.venuePlayerReport.create).not.toHaveBeenCalled();
    });

    it('rejects when daily report cap exceeded', async () => {
      const prisma = {
        venuePlayerReport: {
          findFirst: jest.fn().mockResolvedValue(null),
          count: jest.fn().mockResolvedValueOnce(20).mockResolvedValueOnce(0),
          create: jest.fn(),
        },
        venuePlayerBan: { findUnique: jest.fn() },
        venueBanAppeal: { findFirst: jest.fn(), create: jest.fn() },
      };
      await expect(
        svc(prisma).createReport({
          venueId: 'v1',
          reporterId: 'p1',
          reportedPlayerId: 'p2',
          reason: 'x',
          note: null,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.venuePlayerReport.create).not.toHaveBeenCalled();
    });

    it('rejects when global daily report cap exceeded', async () => {
      const prisma = {
        venuePlayerReport: {
          findFirst: jest.fn().mockResolvedValue(null),
          count: jest.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(50),
          create: jest.fn(),
        },
        venuePlayerBan: { findUnique: jest.fn() },
        venueBanAppeal: { findFirst: jest.fn(), create: jest.fn() },
      };
      await expect(
        svc(prisma).createReport({
          venueId: 'v1',
          reporterId: 'p1',
          reportedPlayerId: 'p2',
          reason: 'x',
          note: null,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.venuePlayerReport.create).not.toHaveBeenCalled();
    });
  });

  describe('createBanAppeal', () => {
    it('rejects when player is not banned', async () => {
      const prisma = {
        venuePlayerReport: {
          findFirst: jest.fn(),
          count: jest.fn(),
          create: jest.fn(),
        },
        venuePlayerBan: { findUnique: jest.fn().mockResolvedValue(null) },
        venueBanAppeal: { findFirst: jest.fn(), create: jest.fn() },
      };
      await expect(
        svc(prisma).createBanAppeal('player-1', 'venue-1', 'please review my case'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.venueBanAppeal.create).not.toHaveBeenCalled();
    });

    it('creates appeal when banned and no open appeal', async () => {
      const prisma = {
        venuePlayerReport: {
          findFirst: jest.fn(),
          count: jest.fn(),
          create: jest.fn(),
        },
        venuePlayerBan: { findUnique: jest.fn().mockResolvedValue({ id: 'b1' }) },
        venueBanAppeal: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'a1' }),
        },
      };
      const r = await svc(prisma).createBanAppeal(
        'player-1',
        'venue-1',
        'I believe this ban was a mistake — staff mixed me up.',
      );
      expect(r).toEqual({ id: 'a1' });
      expect(prisma.venueBanAppeal.create).toHaveBeenCalled();
    });
  });
});
