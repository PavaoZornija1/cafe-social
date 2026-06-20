import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type VenueFunnelKind =
  | 'detect'
  | 'enter'
  | 'play'
  | 'redeem'
  | 'member_scan'
  | 'proximity_ring_enter'
  | 'proximity_ring_exit'
  | 'polygon_enter'
  | 'polygon_exit'
  | 'polygon_dwell_qualified'
  | 'attributed_visit'
  | 'billable_visit';

@Injectable()
export class VenueFunnelService {
  private readonly log = new Logger(VenueFunnelService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Best-effort logging; never throws to callers. */
  safeLog(params: {
    venueId: string;
    playerId?: string | null;
    kind: VenueFunnelKind;
  }): void {
    void this.prisma.venueFunnelEvent
      .create({
        data: {
          venueId: params.venueId,
          playerId: params.playerId ?? null,
          kind: params.kind,
        },
      })
      .catch((e: unknown) => {
        this.log.warn(`funnel log failed ${params.kind}: ${String(e)}`);
      });
  }
}
