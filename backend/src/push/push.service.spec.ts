import { ConfigService } from '@nestjs/config';
import { PushService } from './push.service';

describe('PushService', () => {
  it('sendExpo skips fetch when token list is empty', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const prisma = {} as never;
    const config = { get: jest.fn() } as unknown as ConfigService;
    const svc = new PushService(prisma, config);
    await svc.sendExpo([], { title: 't', body: 'b' });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('sendExpo posts to Expo when tokens provided', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ data: [{ status: 'ok' }] }), { status: 200 }));

    const prisma = {} as never;
    const config = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;
    const svc = new PushService(prisma, config);

    await svc.sendExpo(['ExponentPushToken[abc]'], { title: 'Hi', body: 'There', data: { x: 1 } });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toContain('exp.host');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].to).toBe('ExponentPushToken[abc]');
    expect(body[0].title).toBe('Hi');
    expect(body[0].data).toEqual({ x: '1' });

    fetchSpy.mockRestore();
  });
});
