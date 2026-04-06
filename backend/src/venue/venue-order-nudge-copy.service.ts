import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type VenueOrderNudgeEnvDefaults = { title: string; body: string };

export type VenueOrderNudgePushCopy = {
  venueName: string;
  titleRaw: string;
  bodyRaw: string;
  menuUrl: string;
  orderingUrl: string;
};

@Injectable()
export class VenueOrderNudgeCopyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves title/body for the dwell push: per-field optional venue override, then the first
   * matching active library template (lowest `sortPriority`, then `code`) for the venue’s M:N
   * types, then `envDefaults`. Also returns URLs for the notification payload.
   */
  async resolveForPush(
    venueId: string,
    envDefaults: VenueOrderNudgeEnvDefaults,
  ): Promise<VenueOrderNudgePushCopy | null> {
    const venue = await this.prisma.venue.findUnique({
      where: { id: venueId },
      select: {
        name: true,
        orderNudgeTitle: true,
        orderNudgeBody: true,
        menuUrl: true,
        orderingUrl: true,
        venueVenueTypes: { select: { venueTypeId: true } },
      },
    });
    if (!venue) return null;

    const typeIds = venue.venueVenueTypes.map((x) => x.venueTypeId);
    let picked: { titleTemplate: string; bodyTemplate: string } | null = null;
    if (typeIds.length > 0) {
      picked = await this.prisma.venueOrderNudgeTemplate.findFirst({
        where: {
          active: true,
          venueTypeLinks: { some: { venueTypeId: { in: typeIds } } },
        },
        orderBy: [{ sortPriority: 'asc' }, { code: 'asc' }],
        select: { titleTemplate: true, bodyTemplate: true },
      });
    }

    const venueName = venue.name ?? 'this venue';
    return {
      venueName,
      titleRaw:
        venue.orderNudgeTitle?.trim() ||
        picked?.titleTemplate ||
        envDefaults.title,
      bodyRaw:
        venue.orderNudgeBody?.trim() ||
        picked?.bodyTemplate ||
        envDefaults.body,
      menuUrl: venue.menuUrl?.trim() ?? '',
      orderingUrl: venue.orderingUrl?.trim() ?? '',
    };
  }
}
