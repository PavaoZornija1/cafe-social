import { PushService } from './push.service';

describe('PushService channel prefs', () => {
  function makeService(playerRows: { id: string }[]) {
    const prisma = {
      player: {
        findMany: jest.fn().mockResolvedValue(playerRows),
      },
      playerExpoPushToken: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const config = { get: jest.fn() };
    const svc = new PushService(prisma as never, config as never);
    jest.spyOn(svc, 'sendExpo').mockResolvedValue(undefined);
    return { svc, prisma };
  }

  it('social channel requires matchActivityPush and not totalPrivacy', async () => {
    const { svc, prisma } = makeService([{ id: 'p1' }]);
    await svc.sendToPlayers(
      ['p1', 'p2'],
      undefined,
      { title: 't', body: 'b', channelId: 'social' },
      { channel: 'social' },
    );
    expect(prisma.player.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['p1', 'p2'] },
        matchActivityPush: true,
        totalPrivacy: false,
      },
      select: { id: true },
    });
  });

  it('rewards channel requires partnerMarketingPush and not totalPrivacy', async () => {
    const { svc, prisma } = makeService([{ id: 'p1' }]);
    await svc.sendToPlayers(
      ['p1'],
      undefined,
      { title: 't', body: 'b', channelId: 'partner_marketing' },
      { channel: 'rewards' },
    );
    expect(prisma.player.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['p1'] },
        partnerMarketingPush: true,
        totalPrivacy: false,
      },
      select: { id: true },
    });
  });
});
