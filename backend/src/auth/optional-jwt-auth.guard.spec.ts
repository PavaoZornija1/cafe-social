jest.mock('./jwt-validation.service', () => ({
  JwtValidationService: class JwtValidationService {},
}));
import type { ExecutionContext } from '@nestjs/common';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';

describe('optional JWT on public leaderboards', () => {
  const request = (authorization?: string) => ({
    headers: { authorization },
    user: undefined as unknown,
  });
  const context = (req: ReturnType<typeof request>) =>
    ({ switchToHttp: () => ({ getRequest: () => req }) }) as ExecutionContext;
  it('preserves anonymous reads', async () => {
    const validate = jest.fn();
    await expect(
      new OptionalJwtAuthGuard({ validate } as never).canActivate(
        context(request()),
      ),
    ).resolves.toBe(true);
    expect(validate).not.toHaveBeenCalled();
  });
  it('never treats an invalid supplied token as anonymous', async () => {
    const validate = jest.fn().mockRejectedValue(new Error('invalid token'));
    await expect(
      new OptionalJwtAuthGuard({ validate } as never).canActivate(
        context(request('Bearer bad')),
      ),
    ).rejects.toThrow('invalid token');
  });
  it('personalizes only with verified claims', async () => {
    const req = request('Bearer valid');
    const validate = jest
      .fn()
      .mockResolvedValue({ sub: 'u1', email: 'viewer@example.test' });
    await new OptionalJwtAuthGuard({ validate } as never).canActivate(
      context(req),
    );
    expect(req.user).toEqual(
      expect.objectContaining({
        externalId: 'u1',
        email: 'viewer@example.test',
      }),
    );
  });
});
