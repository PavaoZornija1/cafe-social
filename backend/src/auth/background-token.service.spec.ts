import { BackgroundTokenService } from './background-token.service';

describe('BackgroundTokenService', () => {
  function build() {
    const prisma = {
      player: {
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
      },
    };
    const service = new BackgroundTokenService(prisma as never);
    return { service, prisma };
  }

  it('issues a bg_ token and stores a hash', async () => {
    const { service, prisma } = build();
    const out = await service.issueForPlayer('p1');
    expect(out.token.startsWith('bg_')).toBe(true);
    expect(prisma.player.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: {
        backgroundTokenHash: expect.any(String),
        backgroundTokenExpiresAt: expect.any(Date),
      },
    });
    const storedHash = prisma.player.update.mock.calls[0][0].data.backgroundTokenHash;
    expect(storedHash).not.toEqual(out.token);
  });

  it('resolves a valid token to the player', async () => {
    const { service, prisma } = build();
    const issued = await service.issueForPlayer('p1');
    const hash = prisma.player.update.mock.calls[0][0].data.backgroundTokenHash;
    const expiresAt = prisma.player.update.mock.calls[0][0].data.backgroundTokenExpiresAt;
    prisma.player.findUnique.mockResolvedValue({
      id: 'p1',
      email: 'user_abc@clerk.local',
      backgroundTokenExpiresAt: expiresAt,
    });

    const player = await service.resolvePlayer(issued.token);
    expect(player).toEqual({ id: 'p1', email: 'user_abc@clerk.local' });
    expect(prisma.player.findUnique).toHaveBeenCalledWith({
      where: { backgroundTokenHash: hash },
      select: {
        id: true,
        email: true,
        backgroundTokenExpiresAt: true,
      },
    });
  });

  it('rejects expired tokens', async () => {
    const { service, prisma } = build();
    const issued = await service.issueForPlayer('p1');
    prisma.player.findUnique.mockResolvedValue({
      id: 'p1',
      email: 'user_abc@clerk.local',
      backgroundTokenExpiresAt: new Date(Date.now() - 1000),
    });
    await expect(service.resolvePlayer(issued.token)).resolves.toBeNull();
  });
});
