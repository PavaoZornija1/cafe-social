import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { RevenueCatSyncService, type RcWebhookBody } from './revenuecat-sync.service';

@Controller('webhooks/revenuecat')
export class RevenueCatWebhookController {
  private readonly log = new Logger(RevenueCatWebhookController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly sync: RevenueCatSyncService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handle(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    const body = req.body as RcWebhookBody;
    const expected = this.config.get<string>('REVENUECAT_WEBHOOK_AUTHORIZATION')?.trim();
    if (expected) {
      const received = authorization?.trim() ?? '';
      if (received !== expected) {
        this.log.warn('RevenueCat webhook rejected: authorization mismatch');
        throw new UnauthorizedException();
      }
    }

    const playerId = body.event?.app_user_id?.trim();
    if (!playerId) {
      this.log.warn('RevenueCat webhook: missing event.app_user_id');
      return { ok: true };
    }

    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(playerId)) {
      this.log.warn(`RevenueCat webhook: app_user_id is not a UUID: ${playerId}`);
      return { ok: true };
    }

    const exists = await this.sync.playerExists(playerId);
    if (!exists) {
      this.log.warn(`RevenueCat webhook: no player for app_user_id ${playerId}`);
      return { ok: true };
    }

    try {
      if (this.config.get<string>('REVENUECAT_SECRET_API_KEY')?.trim()) {
        await this.sync.syncFromRestApi(playerId);
      } else {
        const applied = await this.sync.applyWebhookEventFallback(body);
        if (!applied) {
          this.log.warn(
            `RevenueCat webhook: no REST key and event not actionable for ${playerId} (type=${body.event?.type ?? ''})`,
          );
        }
      }
    } catch (e) {
      this.log.error(`RevenueCat webhook sync failed for ${playerId}`, e instanceof Error ? e.stack : e);
      throw e;
    }

    return { ok: true };
  }
}
