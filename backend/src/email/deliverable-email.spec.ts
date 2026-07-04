import { isDeliverableEmail } from './deliverable-email';

describe('isDeliverableEmail', () => {
  it('accepts normal addresses', () => {
    expect(isDeliverableEmail('guest@example.com')).toBe(true);
  });

  it('rejects clerk.local placeholders', () => {
    expect(isDeliverableEmail('user_abc@clerk.local')).toBe(false);
  });

  it('rejects empty and invalid', () => {
    expect(isDeliverableEmail(null)).toBe(false);
    expect(isDeliverableEmail('')).toBe(false);
    expect(isDeliverableEmail('nope')).toBe(false);
  });
});
