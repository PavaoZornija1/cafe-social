import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VenueFunnelService {
  private readonly log = new Logger(VenueFunnelService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Best-effort logging; never throws to callers. */
  safeLog(params: {
    venueId: string;
    playerId?: string | null;
    kind: 'detect' | 'enter' | 'play' | 'redeem';
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
