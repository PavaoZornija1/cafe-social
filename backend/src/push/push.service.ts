import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** Expo clients expect string values in `data` (especially Android). */
function expoDataStrings(data: Record<string, unknown> | undefined): Record<string, string> {
  if (!data) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = v === null || v === undefined ? '' : String(v);
  }
  return out;
}

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
};

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Upsert token for this device; moves token to current player if reinstall / account switch. */
  async registerPlayerToken(playerId: string, expoPushToken: string): Promise<void> {
    const token = expoPushToken.trim();
    await this.prisma.playerExpoPushToken.upsert({
      where: { token },
      create: { playerId, token },
      update: { playerId },
    });
  }

  async removeToken(playerId: string, expoPushToken: string): Promise<void> {
    await this.prisma.playerExpoPushToken.deleteMany({
      where: { playerId, token: expoPushToken.trim() },
    });
  }

  private async tokensForPlayers(playerIds: string[]): Promise<string[]> {
    if (playerIds.length === 0) return [];
    const rows = await this.prisma.playerExpoPushToken.findMany({
      where: { playerId: { in: playerIds } },
      select: { token: true },
    });
    return [...new Set(rows.map((r) => r.token))];
  }

  /**
   * Notify everyone in `playerIds` except `exceptPlayerId` (optional).
   * Respects per-player push prefs when `channel` is set.
   */
  async sendToPlayers(
    playerIds: string[],
    exceptPlayerId: string | undefined,
    message: Omit<ExpoPushMessage, 'to'>,
    opts?: { channel?: 'partner_marketing' | 'match' },
  ): Promise<void> {
    let targets = exceptPlayerId
      ? playerIds.filter((id) => id !== exceptPlayerId)
      : [...playerIds];

    if (opts?.channel === 'match') {
      const rows = await this.prisma.player.findMany({
        where: { id: { in: targets }, matchActivityPush: true },
        select: { id: true },
      });
      targets = rows.map((r) => r.id);
    } else if (opts?.channel === 'partner_marketing') {
      const rows = await this.prisma.player.findMany({
        where: {
          id: { in: targets },
          partnerMarketingPush: true,
          totalPrivacy: false,
        },
        select: { id: true },
      });
      targets = rows.map((r) => r.id);
    }

    const tokens = await this.tokensForPlayers(targets);
    await this.sendExpo(tokens, message);
  }

  async sendExpo(tokens: string[], message: Omit<ExpoPushMessage, 'to'>): Promise<void> {
    if (tokens.length === 0) return;

    const accessToken = this.config.get<string>('EXPO_ACCESS_TOKEN')?.trim();
    const chunks: string[][] = [];
    for (let i = 0; i < tokens.length; i += 99) {
      chunks.push(tokens.slice(i, i + 99));
    }

    for (const chunk of chunks) {
      const body = chunk.map((to) => ({
        to,
        title: message.title,
        body: message.body,
        data: expoDataStrings(message.data),
        sound: message.sound ?? 'default',
      }));

      try {
        const res = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const text = await res.text();
          this.logger.warn(`Expo push HTTP ${res.status}: ${text.slice(0, 200)}`);
        }
      } catch (e) {
        this.logger.warn(`Expo push failed: ${(e as Error).message}`);
      }
    }
  }
}
