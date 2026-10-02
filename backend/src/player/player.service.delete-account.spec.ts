import { UnauthorizedException } from '@nestjs/common';
import { PlayerService } from './player.service';

describe('PlayerService.deleteMyAccount', () => {
  function buildService(
    player: { id: string; email: string } | null,
    tombstone: { email: string; clerkUserId: string | null; deletedAt: Date } | null = null,
  ) {
    const players = {
      findByEmail: jest.fn().mockResolvedValue(player),
      deleteById: jest.fn().mockResolvedValue(player),
      create: jest.fn(async (data: { email: string }) => ({
        id: 'new',
        ...data,
        memberQrToken: 'tok',
      })),
      recordDeletedAccount: jest.fn().mockResolvedValue(undefined),
      findDeletedAccount: jest.fn().mockResolvedValue(tombstone),
      clearDeletedAccount: jest.fn().mockResolvedValue(undefined),
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

  it('records a tombstone so a trailing request cannot resurrect the row', async () => {
    const { service, players } = buildService({
      id: 'p1',
      email: 'user_abc@clerk.local',
    });

    await service.deleteMyAccount('user_abc@clerk.local', 'user_abc');

    expect(players.recordDeletedAccount).toHaveBeenCalledWith(
      'user_abc@clerk.local',
      'user_abc',
    );
  });

  it('writes the tombstone even when no player row existed', async () => {
    const { service, players } = buildService(null);

    await service.deleteMyAccount('user_abc@clerk.local', 'user_abc');

    expect(players.recordDeletedAccount).toHaveBeenCalledWith(
      'user_abc@clerk.local',
      'user_abc',
    );
  });
});

describe('PlayerService.findOrCreateByEmail after deletion', () => {
  function buildService(
    tombstone: { email: string; clerkUserId: string | null; deletedAt: Date } | null,
  ) {
    const players = {
      findByEmail: jest.fn().mockResolvedValue(null),
      create: jest.fn(async (data: { email: string; username: string }) => ({
        id: 'new',
        ...data,
        memberQrToken: 'tok',
      })),
      findDeletedAccount: jest.fn().mockResolvedValue(tombstone),
      clearDeletedAccount: jest.fn().mockResolvedValue(undefined),
    };
    const service = new PlayerService(
      players as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, players };
  }

  it('provisions normally when the identity was never deleted', async () => {
    const { service, players } = buildService(null);

    await expect(
      service.findOrCreateByEmail('user_new@clerk.local'),
    ).resolves.toMatchObject({ id: 'new' });
    expect(players.create).toHaveBeenCalled();
  });

  it('refuses to re-provision a clerk.local identity, permanently', async () => {
    const { service, players } = buildService({
      email: 'user_abc@clerk.local',
      clerkUserId: 'user_abc',
      // Long past the guard window: Clerk never reuses a user id, so this
      // address can never belong to a genuine new sign-up.
      deletedAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
    });

    await expect(
      service.findOrCreateByEmail('user_abc@clerk.local'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(players.create).not.toHaveBeenCalled();
  });

  it('refuses a real email while the trailing JWT could still be alive', async () => {
    const { service, players } = buildService({
      email: 'someone@example.com',
      clerkUserId: 'user_abc',
      deletedAt: new Date(Date.now() - 1000),
    });

    await expect(
      service.findOrCreateByEmail('someone@example.com'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(players.create).not.toHaveBeenCalled();
  });

  it('lets a real email register again once the guard window has passed', async () => {
    const { service, players } = buildService({
      email: 'someone@example.com',
      clerkUserId: 'user_abc',
      deletedAt: new Date(Date.now() - 60 * 60 * 1000),
    });

    await expect(
      service.findOrCreateByEmail('someone@example.com'),
    ).resolves.toMatchObject({ id: 'new' });
    expect(players.clearDeletedAccount).toHaveBeenCalledWith('someone@example.com');
    expect(players.create).toHaveBeenCalled();
  });
});
