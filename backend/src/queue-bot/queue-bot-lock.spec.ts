import {
  acquireQueueBotLock,
  QueueBotLockBusyError,
  QUEUE_BOT_FILL_LOCK,
} from './queue-bot-lock';

describe('acquireQueueBotLock', () => {
  it('uses only the supplied transaction client, without another transaction or an unlock', async () => {
    const tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ ok: true }]),
      $transaction: jest.fn(),
      $executeRawUnsafe: jest.fn(),
    };
    await acquireQueueBotLock(tx as never, QUEUE_BOT_FILL_LOCK);
    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith(
      'SELECT pg_try_advisory_xact_lock($1::integer, $2::integer) AS ok',
      ...QUEUE_BOT_FILL_LOCK,
    );
    expect(tx.$transaction).not.toHaveBeenCalled();
    expect(tx.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('fails closed on contention or database errors', async () => {
    const tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ ok: false }]),
    };
    await expect(
      acquireQueueBotLock(tx as never, QUEUE_BOT_FILL_LOCK),
    ).rejects.toBeInstanceOf(QueueBotLockBusyError);
    tx.$queryRawUnsafe.mockRejectedValue(new Error('database unavailable'));
    await expect(
      acquireQueueBotLock(tx as never, QUEUE_BOT_FILL_LOCK),
    ).rejects.toThrow('database unavailable');
  });
});
