import type { TrackedParticipant } from './types';

/**
 * Historical PvP hold gate. Authoritative combat is live — never hold 2-human play.
 * Kept as a named helper so call sites stay explicit.
 */
export function shouldHoldTwoHumanPvp(
  _participants: ReadonlyArray<Pick<TrackedParticipant, 'isBot'>>,
): boolean {
  return false;
}

/**
 * Human+bot fallback winner when combat snapshot has not ended yet.
 * Prefer server combat winner when available.
 */
export function resolveLocalFinalizeWinner(params: {
  localParticipantId: string | null;
  localAlive: boolean;
  botParticipantId: string | undefined;
}): string | undefined {
  const { localParticipantId, localAlive, botParticipantId } = params;
  if (!localParticipantId) {
    return localAlive ? undefined : botParticipantId;
  }
  if (!localAlive) {
    return botParticipantId ?? localParticipantId;
  }
  return localParticipantId;
}
