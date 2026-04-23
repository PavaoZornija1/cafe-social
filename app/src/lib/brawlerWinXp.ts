/**
 * Preview XP for a brawler WIN (must match backend `GameXpAwardService` + `xp-rewards`).
 */
const XP_VENUE_WIN = 40;
const XP_GLOBAL_WIN = 25;
const BRAWLER_XP_PER_KILL = 4;
const BRAWLER_XP_PER_DEATH_PENALTY = 6;
const BRAWLER_WIN_XP_MIN = 12;
const BRAWLER_WIN_XP_MAX = 95;

export function previewBrawlerWinXp(
  venueScoped: boolean,
  kills: number,
  deaths: number,
): number {
  const base = venueScoped ? XP_VENUE_WIN : XP_GLOBAL_WIN;
  const raw =
    base + kills * BRAWLER_XP_PER_KILL - deaths * BRAWLER_XP_PER_DEATH_PENALTY;
  return Math.round(
    Math.max(BRAWLER_WIN_XP_MIN, Math.min(BRAWLER_WIN_XP_MAX, raw)),
  );
}
