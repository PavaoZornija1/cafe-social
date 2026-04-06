/**
 * Canonical venue category codes (stored as strings on `VenueType.code`).
 * Prefer importing these instead of spelling raw strings in app code.
 */
export const VENUE_TYPE_CODES = {
  RESTAURANT: 'RESTAURANT',
  COFFEE_SHOP: 'COFFEE_SHOP',
  BAR: 'BAR',
  BAKERY: 'BAKERY',
  GAME_SHOP: 'GAME_SHOP',
  RETAIL: 'RETAIL',
  OTHER: 'OTHER',
} as const;

export type VenueTypeCode = (typeof VENUE_TYPE_CODES)[keyof typeof VENUE_TYPE_CODES];

/**
 * Logical nudge / campaign bucket for templates (`VenueOrderNudgeTemplate.nudgeType`).
 * Correlates with venue types via `VenueOrderNudgeTemplateVenueType` (which types a template applies to).
 */
export const VENUE_NUDGE_TYPES = {
  ORDER_DRINK: 'ORDER_DRINK',
  ORDER_FOOD: 'ORDER_FOOD',
  ORDER_SNACK: 'ORDER_SNACK',
  BROWSE_MENU: 'BROWSE_MENU',
} as const;

export type VenueNudgeType = (typeof VENUE_NUDGE_TYPES)[keyof typeof VENUE_NUDGE_TYPES];
