import { VENUE_NUDGE_TYPES, VENUE_TYPE_CODES } from './venue-taxonomy';

describe('venue-taxonomy', () => {
  it('exposes stable venue type codes', () => {
    expect(VENUE_TYPE_CODES.COFFEE_SHOP).toBe('COFFEE_SHOP');
    expect(VENUE_TYPE_CODES.OTHER).toBe('OTHER');
  });

  it('exposes nudge type codes', () => {
    expect(VENUE_NUDGE_TYPES.ORDER_DRINK).toBe('ORDER_DRINK');
    expect(VENUE_NUDGE_TYPES.BROWSE_MENU).toBe('BROWSE_MENU');
  });
});
