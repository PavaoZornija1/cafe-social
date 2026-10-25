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
    const staffNotify = { notifyBanAppealCreated: jest.fn() };
    return new VenueModerationService({ player: { findUnique: jest.fn().mockResolvedValue({ id: 'p2' }) }, ...prisma } as never, push as never, staffNotify as never);
  }

  describe('createReport', () => {
    it('stores a global report without attaching it to an unrelated venue', async () => {
      const prisma = {
        venuePlayerReport: {
          findFirst: jest.fn().mockResolvedValue(null),
          count: jest.fn().mockResolvedValue(0),
          create: jest.fn().mockResolvedValue({ id: 'global-report' }),
        },
        venuePlayerBan: { findUnique: jest.fn() },
        venueBanAppeal: { findFirst: jest.fn(), create: jest.fn() },
      };
      await expect(
        svc(prisma).createReport({
          venueId: null,
          reporterId: 'p1',
          reportedPlayerId: 'p2',
          reason: ' abuse ',
          note: ' detail ',
        }),
      ).resolves.toEqual({ id: 'global-report' });
      expect(prisma.venuePlayerReport.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            venueId: null,
            reporterId: 'p1',
            reportedPlayerId: 'p2',
          }),
        }),
      );
      expect(prisma.venuePlayerReport.create).toHaveBeenCalledWith({
        data: {
          venueId: null,
          reporterId: 'p1',
          reportedPlayerId: 'p2',
          reason: 'abuse',
          note: 'detail',
        },
      });
    });

    it('rejects a missing target without creating a report', async () => {
      const prisma = {
        player: { findUnique: jest.fn().mockResolvedValue(null) },
        venuePlayerReport: { create: jest.fn() },
      };
      const service = new VenueModerationService(
        prisma as never,
        {} as never,
        {} as never,
      );
      await expect(
        service.createReport({
          venueId: null,
          reporterId: 'p1',
          reportedPlayerId: 'missing',
          reason: 'abuse',
          note: null,
        }),
      ).rejects.toThrow('Player not found');
      expect(prisma.venuePlayerReport.create).not.toHaveBeenCalled();
    });
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

  describe('platform resolution', () => {
    function setup(report: object | null, claimed = 1) {
      const tx = {
        venuePlayerReport: {
          findFirst: jest.fn().mockResolvedValue(report),
          updateMany: jest.fn().mockResolvedValue({ count: claimed }),
        },
        player: { update: jest.fn() },
        venueModerationAuditLog: { create: jest.fn() },
      };
      const service = new VenueModerationService(
        {
          $transaction: (fn: (client: typeof tx) => unknown) => fn(tx),
        } as never,
        {} as never,
        {} as never,
      );
      return { service, tx };
    }
    it('does not resolve a venue report or an already closed report', async () => {
      const { service, tx } = setup(null);
      await expect(
        service.resolvePlatformReport('r1', 'admin', true),
      ).rejects.toThrow('Open platform report not found');
      expect(tx.venuePlayerReport.findFirst).toHaveBeenCalledWith({
        where: { id: 'r1', venueId: null, status: 'open' },
      });
      expect(tx.player.update).not.toHaveBeenCalled();
    });
    it('does not perform a second reset after another moderator claims the report', async () => {
      const { service, tx } = setup({ reportedPlayerId: 'p2' }, 0);
      await expect(
        service.resolvePlatformReport('r1', 'admin', true),
      ).rejects.toThrow('Open platform report not found');
      expect(tx.player.update).not.toHaveBeenCalled();
    });
    it('resets the reported player only and records the actor', async () => {
      const { service, tx } = setup({ reportedPlayerId: 'p2' });
      await service.resolvePlatformReport('r1', 'admin', true, ' reviewed ');
      expect(tx.player.update).toHaveBeenCalledWith({
        where: { id: 'p2' },
        data: { username: expect.stringMatching(/^member_[a-f0-9]{16}$/) },
      });
      expect(tx.venueModerationAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorPlayerId: 'admin',
          venueId: null,
          action: 'report_username_reset',
          entityId: 'r1',
        }),
      });
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
