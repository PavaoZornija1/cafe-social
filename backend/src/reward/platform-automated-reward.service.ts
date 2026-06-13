import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  computeTierProgressFromLadder,
  type TierLadderRung,
  type TierProgressDto,
} from '../lib/xp-tier-ladder.util';
import {
  type AutomatedPerkGrantSource,
  type ChallengePerkGrantResult,
  PlayerRewardGrantService,
} from './player-reward-grant.service';

export type PlatformAutomatedRewardRow = {
  rewardKey: string;
  perkId: string | null;
  label: string | null;
  minLifetimeXp: number | null;
  isActive: boolean;
  perkTitle: string | null;
};

const TIER_KEY_PREFIX = 'tier.';
const LADDER_CACHE_MS = 30_000;

@Injectable()
export class PlatformAutomatedRewardService {
  private tierLadderCache: { loadedAt: number; rungs: TierLadderRung[] } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly grants: PlayerRewardGrantService,
  ) {}

  displayLabel(row: Pick<PlatformAutomatedRewardRow, 'label' | 'perkTitle'>): string {
    return row.label?.trim() || row.perkTitle?.trim() || 'Partner perk';
  }

  private rowToDto(row: {
    rewardKey: string;
    perkId: string | null;
    label: string | null;
    minLifetimeXp: number | null;
    isActive: boolean;
    perk: { title: string } | null;
  }): PlatformAutomatedRewardRow {
    return {
      rewardKey: row.rewardKey,
      perkId: row.perkId,
      label: row.label,
      minLifetimeXp: row.minLifetimeXp,
      isActive: row.isActive,
      perkTitle: row.perk?.title ?? null,
    };
  }

  async findActive(rewardKey: string): Promise<PlatformAutomatedRewardRow | null> {
    const row = await this.prisma.platformAutomatedReward.findFirst({
      where: { rewardKey, isActive: true },
      include: { perk: { select: { id: true, title: true } } },
    });
    if (!row) return null;
    return this.rowToDto(row);
  }

  async listActive(): Promise<PlatformAutomatedRewardRow[]> {
    const rows = await this.prisma.platformAutomatedReward.findMany({
      where: { isActive: true },
      include: { perk: { select: { id: true, title: true } } },
      orderBy: { rewardKey: 'asc' },
    });
    return rows.map((row) => this.rowToDto(row));
  }

  /** CMS tier ladder for Me tab / summary (rewardKey prefix `tier.`). */
  async getTierLadder(): Promise<TierLadderRung[]> {
    const now = Date.now();
    if (this.tierLadderCache && now - this.tierLadderCache.loadedAt < LADDER_CACHE_MS) {
      return this.tierLadderCache.rungs;
    }

    const rows = await this.prisma.platformAutomatedReward.findMany({
      where: {
        isActive: true,
        minLifetimeXp: { not: null },
        rewardKey: { startsWith: TIER_KEY_PREFIX },
      },
      include: { perk: { select: { title: true } } },
      orderBy: { minLifetimeXp: 'asc' },
    });

    const rungs: TierLadderRung[] = rows.map((row) => ({
      rewardKey: row.rewardKey,
      displayName: this.displayLabel(this.rowToDto(row)),
      minLifetimeXp: row.minLifetimeXp!,
    }));

    this.tierLadderCache = { loadedAt: now, rungs };
    return rungs;
  }

  invalidateTierLadderCache(): void {
    this.tierLadderCache = null;
  }

  async computeTierProgress(totalXp: number): Promise<TierProgressDto> {
    const ladder = await this.getTierLadder();
    return computeTierProgressFromLadder(totalXp, ladder);
  }

  async tryGrantForKey(params: {
    playerId: string;
    rewardKey: string;
    sourceType: AutomatedPerkGrantSource;
    sourceId: string;
    idempotencyKey: string;
  }): Promise<ChallengePerkGrantResult | { ok: false; reason: 'not_configured' }> {
    const link = await this.findActive(params.rewardKey);
    if (!link?.perkId) return { ok: false, reason: 'not_configured' };

    return this.grants.tryIssueAutomatedPerkGrant({
      playerId: params.playerId,
      perkId: link.perkId,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      idempotencyKey: params.idempotencyKey,
    });
  }
}
