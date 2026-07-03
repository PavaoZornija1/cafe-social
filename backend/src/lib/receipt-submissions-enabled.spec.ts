import { ConfigService } from '@nestjs/config';
import { isReceiptSubmissionsEnabled } from './receipt-submissions-enabled';

describe('isReceiptSubmissionsEnabled', () => {
  const prev = process.env.RECEIPT_SUBMISSIONS_ENABLED;

  afterEach(() => {
    if (prev === undefined) delete process.env.RECEIPT_SUBMISSIONS_ENABLED;
    else process.env.RECEIPT_SUBMISSIONS_ENABLED = prev;
  });

  it('is false when unset', () => {
    delete process.env.RECEIPT_SUBMISSIONS_ENABLED;
    expect(isReceiptSubmissionsEnabled()).toBe(false);
  });

  it('is true for common truthy strings', () => {
    process.env.RECEIPT_SUBMISSIONS_ENABLED = 'true';
    expect(isReceiptSubmissionsEnabled()).toBe(true);
    process.env.RECEIPT_SUBMISSIONS_ENABLED = '1';
    expect(isReceiptSubmissionsEnabled()).toBe(true);
  });

  it('reads from ConfigService when provided', () => {
    const config = {
      get: jest.fn().mockReturnValue('yes'),
    } as unknown as ConfigService;
    expect(isReceiptSubmissionsEnabled(config)).toBe(true);
  });
});
