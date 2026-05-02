/** Tier thresholds (total XP including venue + bonus). */
export const XP_TIER_SILVER = 800;
export const XP_TIER_GOLD = 2000;

/** One win / completion grant (venue-scoped vs global / off-venue). */
export const XP_VENUE_WIN = 40;
export const XP_GLOBAL_WIN = 25;

/** Word room: co-op perfect clear (each winning participant). */
export const XP_WORD_COOP_PERFECT = 15;
export const XP_WORD_COOP_GLOBAL = 12;
/** Word room: solo deck finished with every word solved (venue/global base same pattern as other wins). */
export const XP_WORD_SOLO_VENUE = 30;
export const XP_WORD_SOLO_GLOBAL = 22;
/** Versus: 2nd place by score (same ballpark as solo). */
export const XP_WORD_VERSUS_SECOND = 30;
export const XP_WORD_VERSUS_SECOND_GLOBAL = 22;
/** Versus: 1st place by score. */
export const XP_WORD_VERSUS_FIRST = 55;
export const XP_WORD_VERSUS_FIRST_GLOBAL = 40;

/** Brawler win XP: base (venue/global above) + kills − deaths, clamped. */
export const BRAWLER_XP_PER_KILL = 4;
export const BRAWLER_XP_PER_DEATH_PENALTY = 6;
export const BRAWLER_WIN_XP_MIN = 12;
export const BRAWLER_WIN_XP_MAX = 95;
