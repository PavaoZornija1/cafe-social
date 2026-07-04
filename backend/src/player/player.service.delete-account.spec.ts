import { PlayerService } from './player.service';

describe('PlayerService.deleteMyAccount', () => {
  function buildService(player: { id: string; email: string } | null) {
    const players = {
      findByEmail: jest.fn().mockResolvedValue(player),
      deleteById: jest.fn().mockResolvedValue(player),
    };
    const clerkUsers = {
      deleteUser: jest.fn().mockResolvedValue(undefined),
    };
    const service = new PlayerService(
      players as never,
      {} as never,
      {} as never,
      {} as never,
      clerkUsers as never,
    );
    return { service, players, clerkUsers };
  }

  it('deletes player row then Clerk user', async () => {
    const { service, players, clerkUsers } = buildService({
      id: 'p1',
      email: 'user_abc@clerk.local',
    });

    await expect(
      service.deleteMyAccount('user_abc@clerk.local', 'user_abc'),
    ).resolves.toEqual({ ok: true });

    expect(players.deleteById).toHaveBeenCalledWith('p1');
    expect(clerkUsers.deleteUser).toHaveBeenCalledWith('user_abc');
  });

  it('still deletes Clerk when no player row exists', async () => {
    const { service, players, clerkUsers } = buildService(null);

    await expect(
      service.deleteMyAccount('user_abc@clerk.local', 'user_abc'),
    ).resolves.toEqual({ ok: true });

    expect(players.deleteById).not.toHaveBeenCalled();
    expect(clerkUsers.deleteUser).toHaveBeenCalledWith('user_abc');
  });
});
