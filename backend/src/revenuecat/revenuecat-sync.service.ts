import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

const RC_SUBSCRIBERS_URL = 'https://api.revenuecat.com/v1/subscribers';

type RcEntitlementPayload = {
  expires_date?: string | null;
};

type RcSubscriberResponse = {
  subscriber?: {
    entitlements?: Record<string, RcEntitlementPayload | null>;
  };
};

/** Shape of RevenueCat webhook body (v1); extra fields ignored. */
export type RcWebhookBody = {
  event?: {
    type?: string;
    app_user_id?: string;
    expiration_at_ms?: number | null;
  };
};

@Injectable()
export class RevenueCatSyncService {
  private readonly log = new Logger(RevenueCatSyncService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private getEntitlementId(): string {
    return (this.config.get<string>('REVENUECAT_ENTITLEMENT_ID') ?? 'premium').trim();
  }

  private getSecretKey(): string | undefined {
    return this.config.get<string>('REVENUECAT_SECRET_API_KEY')?.trim() || undefined;
  }

  /**
   * Pull canonical subscriber state from RevenueCat REST API (recommended after webhooks).
   */
  async syncFromRestApi(playerId: string): Promise<void> {
    const secret = this.getSecretKey();
    if (!secret) {
      this.log.warn('REVENUECAT_SECRET_API_KEY is not set; skipping REST subscriber sync');
      return;
    }
    const url = `${RC_SUBSCRIBERS_URL}/${encodeURIComponent(playerId)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`RevenueCat REST ${res.status}: ${text.slice(0, 500)}`);
    }
    const data = (await res.json()) as RcSubscriberResponse;
    const entitlementId = this.getEntitlementId();
    const ent = data.subscriber?.entitlements?.[entitlementId];
    await this.persistEntitlement(playerId, ent);
  }

  private async persistEntitlement(
    playerId: string,
    ent: RcEntitlementPayload | null | undefined,
  ): Promise<void> {
    if (!ent || Object.keys(ent).length === 0) {
      await this.upsertRow(playerId, false, null);
      return;
    }
    const raw = ent.expires_date;
    if (raw == null || raw === '') {
      await this.upsertRow(playerId, true, null);
      return;
    }
    const expiresAt = new Date(raw);
    if (Number.isNaN(expiresAt.getTime())) {
      this.log.warn(`Invalid entitlement expires_date for ${playerId}: ${String(raw)}`);
      await this.upsertRow(playerId, false, null);
      return;
    }
    const active = expiresAt.getTime() > Date.now();
    await this.upsertRow(playerId, active, expiresAt);
  }

  private async upsertRow(playerId: string, active: boolean, expiresAt: Date | null): Promise<void> {
    await this.prisma.subscription.upsert({
      where: { playerId },
      create: { playerId, active, expiresAt },
      update: { active, expiresAt },
    });
  }

  /**
   * Best-effort update when REST key is unavailable (dashboard webhook only).
   */
  async applyWebhookEventFallback(body: RcWebhookBody): Promise<boolean> {
    const event = body.event;
    const playerId = event?.app_user_id?.trim();
    if (!playerId) return false;
    const type = event.type ?? '';
    const expMs = event.expiration_at_ms;

    if (type === 'EXPIRATION') {
      await this.upsertRow(playerId, false, expMs != null ? new Date(expMs) : null);
      return true;
    }

    if (expMs != null) {
      const expiresAt = new Date(expMs);
      const active = expiresAt.getTime() > Date.now();
      await this.upsertRow(playerId, active, expiresAt);
      return true;
    }

    return false;
  }

  async playerExists(playerId: string): Promise<boolean> {
    const p = await this.prisma.player.findUnique({
      where: { id: playerId },
      select: { id: true },
    });
    return p != null;
  }
}
