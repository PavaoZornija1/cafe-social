import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type VenueOrderNudgeEnvDefaults = { title: string; body: string };

export type VenueOrderNudgePushCopy = {
  venueName: string;
  titleRaw: string;
  bodyRaw: string;
  menuUrl: string;
  orderingUrl: string;
  /** Set when the primary source is a `VenueNudgeAssignment` (dwell or admin). */
  assignmentId: string | null;
  /** Library template `code`, when tied to a template row. */
  templateCode: string | null;
  /** Analytics / routing bucket from `VenueOrderNudgeTemplate.nudgeType`. */
  nudgeType: string | null;
};

/** Replace `{{venueName}}` in template strings (push title/body). */
export function applyVenueNudgePlaceholders(template: string, venueName: string): string {
  return template.replace(/\{\{venueName\}\}/g, venueName);
}

const venueNudgeAssignmentsSelect = {
  where: { enabled: true, template: { active: true } },
  orderBy: { sortOrder: 'asc' as const },
  select: {
    id: true,
    sortOrder: true,
    titleOverride: true,
    bodyOverride: true,
    afterMinutesOverride: true,
    template: {
      select: {
        code: true,
        nudgeType: true,
        titleTemplate: true,
        bodyTemplate: true,
        defaultAfterMinutes: true,
      },
    },
  },
};

const venueNudgeBaseSelect = {
  name: true,
  orderNudgeTitle: true,
  orderNudgeBody: true,
  menuUrl: true,
  orderingUrl: true,
  venueVenueTypes: { select: { venueTypeId: true } },
  nudgeAssignments: venueNudgeAssignmentsSelect,
};

@Injectable()
export class VenueOrderNudgeCopyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Minutes of on-prem dwell before automatic nudge, for this venue.
   * First enabled assignment wins (by sortOrder); then template.defaultAfterMinutes; else null (= use global env).
   */
  async getEffectiveAfterMinutes(venueId: string): Promise<number | null> {
    const venue = await this.prisma.venue.findUnique({
      where: { id: venueId },
      select: { nudgeAssignments: venueNudgeAssignmentsSelect },
    });
    if (!venue || venue.nudgeAssignments.length === 0) return null;
    const a = venue.nudgeAssignments[0]!;
    return a.afterMinutesOverride ?? a.template.defaultAfterMinutes ?? null;
  }

  /**
   * Resolves title/body for the dwell push: primary assignment (lowest sortOrder) overrides, then
   * per-field venue fallback, then first matching active library template by venue M:N types (legacy),
   * then env defaults.
   */
  async resolveForPush(
    venueId: string,
    envDefaults: VenueOrderNudgeEnvDefaults,
  ): Promise<VenueOrderNudgePushCopy | null> {
    const venue = await this.prisma.venue.findUnique({
      where: { id: venueId },
      select: venueNudgeBaseSelect,
    });
    if (!venue) return null;

    const venueName = venue.name ?? 'this venue';
    const typeIds = venue.venueVenueTypes.map((x) => x.venueTypeId);

    let titleRaw: string;
    let bodyRaw: string;

    if (venue.nudgeAssignments.length > 0) {
      const a = venue.nudgeAssignments[0]!;
      const t = a.template;
      titleRaw =
        a.titleOverride?.trim() ||
        venue.orderNudgeTitle?.trim() ||
        t.titleTemplate ||
        envDefaults.title;
      bodyRaw =
        a.bodyOverride?.trim() ||
        venue.orderNudgeBody?.trim() ||
        t.bodyTemplate ||
        envDefaults.body;
      return {
        venueName,
        titleRaw,
        bodyRaw,
        menuUrl: venue.menuUrl?.trim() ?? '',
        orderingUrl: venue.orderingUrl?.trim() ?? '',
        assignmentId: a.id,
        templateCode: t.code,
        nudgeType: t.nudgeType,
      };
    }

    let picked: {
      titleTemplate: string;
      bodyTemplate: string;
      code: string;
      nudgeType: string;
    } | null = null;
    if (typeIds.length > 0) {
      picked = await this.prisma.venueOrderNudgeTemplate.findFirst({
        where: {
          active: true,
          venueTypeLinks: { some: { venueTypeId: { in: typeIds } } },
        },
        orderBy: [{ sortPriority: 'asc' }, { code: 'asc' }],
        select: {
          titleTemplate: true,
          bodyTemplate: true,
          code: true,
          nudgeType: true,
        },
      });
    }
    titleRaw =
      venue.orderNudgeTitle?.trim() ||
      picked?.titleTemplate ||
      envDefaults.title;
    bodyRaw =
      venue.orderNudgeBody?.trim() ||
      picked?.bodyTemplate ||
      envDefaults.body;

    return {
      venueName,
      titleRaw,
      bodyRaw,
      menuUrl: venue.menuUrl?.trim() ?? '',
      orderingUrl: venue.orderingUrl?.trim() ?? '',
      assignmentId: null,
      templateCode: picked?.code ?? null,
      nudgeType: picked?.nudgeType ?? null,
    };
  }

  /**
   * Resolve copy for a specific assignment (e.g. admin “send now”). Does not use sortOrder of other rows.
   */
  async resolveForAssignment(
    venueId: string,
    assignmentId: string,
    envDefaults: VenueOrderNudgeEnvDefaults,
  ): Promise<VenueOrderNudgePushCopy | null> {
    const row = await this.prisma.venueNudgeAssignment.findFirst({
      where: {
        id: assignmentId,
        venueId,
        enabled: true,
        template: { active: true },
      },
      include: {
        template: {
          select: {
            code: true,
            nudgeType: true,
            titleTemplate: true,
            bodyTemplate: true,
            defaultAfterMinutes: true,
          },
        },
      },
    });
    if (!row) return null;

    const venue = await this.prisma.venue.findUnique({
      where: { id: venueId },
      select: {
        name: true,
        orderNudgeTitle: true,
        orderNudgeBody: true,
        menuUrl: true,
        orderingUrl: true,
      },
    });
    if (!venue) return null;

    const venueName = venue.name ?? 'this venue';
    const t = row.template;
    return {
      venueName,
      titleRaw:
        row.titleOverride?.trim() ||
        venue.orderNudgeTitle?.trim() ||
        t.titleTemplate ||
        envDefaults.title,
      bodyRaw:
        row.bodyOverride?.trim() ||
        venue.orderNudgeBody?.trim() ||
        t.bodyTemplate ||
        envDefaults.body,
      menuUrl: venue.menuUrl?.trim() ?? '',
      orderingUrl: venue.orderingUrl?.trim() ?? '',
      assignmentId: row.id,
      templateCode: t.code,
      nudgeType: t.nudgeType,
    };
  }
}
