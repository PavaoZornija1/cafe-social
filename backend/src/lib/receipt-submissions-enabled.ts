import { ConfigService } from '@nestjs/config';

/** Guest receipt photo → staff review (optional perk lock). Off unless explicitly enabled. */
export function isReceiptSubmissionsEnabled(config?: ConfigService): boolean {
  const raw =
    config?.get<string>('RECEIPT_SUBMISSIONS_ENABLED') ??
    process.env.RECEIPT_SUBMISSIONS_ENABLED;
  const v = raw?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}
