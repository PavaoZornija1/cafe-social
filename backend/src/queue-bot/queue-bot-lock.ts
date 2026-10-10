import type { Prisma } from '@prisma/client';

// New namespaces bypass locks leaked by the former session-scoped implementation.
export const QUEUE_BOT_FILL_LOCK = [58_294_237, 92_837_461] as const;
export const WORD_BOT_TURN_LOCK = [58_294_238, 92_837_462] as const;

export class QueueBotLockBusyError extends Error {
  constructor() {
    super('queue bot advisory lock is busy');
  }
}

/** Use the mutation's existing transaction; commit/rollback releases the lock. */
export async function acquireQueueBotLock(
  tx: Prisma.TransactionClient,
  keys: readonly [number, number],
): Promise<void> {
  const rows = await tx.$queryRawUnsafe<Array<{ ok: boolean }>>(
    'SELECT pg_try_advisory_xact_lock($1::integer, $2::integer) AS ok',
    ...keys,
  );
  if (!rows[0]?.ok) throw new QueueBotLockBusyError();
}
