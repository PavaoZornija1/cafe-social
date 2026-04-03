import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import {
  PARTNER_ONBOARDING_THROTTLED,
  PARTNER_TRIAL_VENUES_LOCKED,
} from './partner-ops.events';

@Injectable()
export class PartnerOpsListener {
  private readonly log = new Logger(PartnerOpsListener.name);

  constructor(private readonly config: ConfigService) {}

  @OnEvent(PARTNER_TRIAL_VENUES_LOCKED)
  async onTrialVenuesLocked(payload: {
    organizationId: string;
    venueIds: string[];
  }): Promise<void> {
    const body = {
      metric: 'partner_trial_venues_locked',
      organizationId: payload.organizationId,
      venueCount: payload.venueIds.length,
      venueIds: payload.venueIds,
      at: new Date().toISOString(),
    };
    this.log.log(JSON.stringify(body));

    const url = this.config.get<string>('PARTNER_OPS_WEBHOOK_URL')?.trim();
    if (!url) return;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        this.log.warn(
          `PARTNER_OPS_WEBHOOK_URL responded ${res.status} ${res.statusText}`,
        );
      }
    } catch (e) {
      this.log.warn(
        `PARTNER_OPS_WEBHOOK_URL request failed: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  @OnEvent(PARTNER_ONBOARDING_THROTTLED)
  async onOnboardingThrottled(payload: { path: string }): Promise<void> {
    const body = {
      metric: 'partner_onboarding_throttled',
      path: payload.path,
      at: new Date().toISOString(),
    };
    this.log.log(JSON.stringify(body));

    const url = this.config.get<string>('PARTNER_OPS_WEBHOOK_URL')?.trim();
    if (!url) return;
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (e) {
      this.log.warn(
        `PARTNER_OPS_WEBHOOK_URL (throttle) failed: ${e instanceof Error ? e.message : e}`,
      );
    }
  }
}
