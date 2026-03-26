/** Challenge “happy hour” / scheduled window in UTC. Null bounds mean open-ended. */
export function isChallengeActiveWindow(
  activeFrom: Date | null | undefined,
  activeTo: Date | null | undefined,
  now = new Date(),
): boolean {
  if (activeFrom && now < activeFrom) return false;
  if (activeTo && now > activeTo) return false;
  return true;
}
