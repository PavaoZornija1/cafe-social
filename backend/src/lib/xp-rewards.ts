/** Tier thresholds (total XP including venue + bonus). */
export const XP_TIER_SILVER = 800;
export const XP_TIER_GOLD = 2000;

/** One win / completion grant (venue-scoped vs global / off-venue). */
export const XP_VENUE_WIN = 40;
export const XP_GLOBAL_WIN = 25;

/** Brawler win XP: base (venue/global above) + kills − deaths, clamped. */
export const BRAWLER_XP_PER_KILL = 4;
export const BRAWLER_XP_PER_DEATH_PENALTY = 6;
export const BRAWLER_WIN_XP_MIN = 12;
export const BRAWLER_WIN_XP_MAX = 95;
