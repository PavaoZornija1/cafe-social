import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PlatformRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeUserEmail } from '../auth/user-email.util';
import {
  PARTNER_TRIAL_LOCK_REASON,
  isPayingPartnerOrg,
} from './partner-access.constants';
import { PARTNER_TRIAL_VENUES_LOCKED } from './partner-ops.events';

/**
 * Applies partner trial expiry: locks all venues under an org when trial ended and org is not paying.
 * Unlocking after payment is handled from Stripe sync (see StripePartnerBillingService).
 */
@Injectable()
export class PartnerOrgAccessService {
  private readonly log = new Logger(PartnerOrgAccessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async syncVenueLocksForOrganization(organizationId: string): Promise<void> {
    const org = await this.prisma.venueOrganization.findUnique({
      where: { id: organizationId },
      include: { venues: { select: { id: true, locked: true, lockReason: true } } },
    });
    if (!org) return;

    const paying = isPayingPartnerOrg(org.platformBillingStatus);
    const trialEnd = org.trialEndsAt;
    const trialExpired =
      trialEnd !== null && trialEnd.getTime() <= Date.now() && !paying;

    if (!trialExpired) {
      return;
    }

    const lockedVenueIds: string[] = [];
    for (const v of org.venues) {
      if (v.locked && v.lockReason && v.lockReason !== PARTNER_TRIAL_LOCK_REASON) {
        continue;
      }
      await this.prisma.venue.update({
        where: { id: v.id },
        data: {
          locked: true,
          lockReason: PARTNER_TRIAL_LOCK_REASON,
        },
      });
      lockedVenueIds.push(v.id);
    }
    if (lockedVenueIds.length > 0) {
      this.events.emit(PARTNER_TRIAL_VENUES_LOCKED, {
        organizationId,
        venueIds: lockedVenueIds,
      });
    }
  }

  /**
   * After Stripe reports an active subscription, clear trial auto-locks for this org.
   */
  async unlockTrialLockedVenuesForPaidOrganization(
    organizationId: string,
  ): Promise<void> {
    const org = await this.prisma.venueOrganization.findUnique({
      where: { id: organizationId },
      select: { platformBillingStatus: true },
    });
    if (!org || !isPayingPartnerOrg(org.platformBillingStatus)) {
      return;
    }

    await this.prisma.venue.updateMany({
      where: {
        organizationId,
        locked: true,
        lockReason: PARTNER_TRIAL_LOCK_REASON,
      },
      data: {
        locked: false,
        lockReason: null,
      },
    });
  }

  async syncVenueLocksForOrganizations(orgIds: Iterable<string>): Promise<void> {
    const seen = new Set<string>();
    for (const id of orgIds) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      try {
        await this.syncVenueLocksForOrganization(id);
      } catch (e) {
        this.log.warn(
          `syncVenueLocksForOrganization failed for ${id}: ${e instanceof Error ? e.message : e}`,
        );
      }
    }
  }

  /**
   * Organization-scoped partner write check (e.g. create venue under org).
   * Super admins bypass. Does not check per-venue locks — use assertPartnerMayMutateVenue for those.
   */
  async assertPartnerMayMutateOrganization(
    organizationId: string,
    requestUser?: unknown,
  ): Promise<void> {
    const email = requestUser ? normalizeUserEmail(requestUser) : null;
    if (email) {
      const sa = await this.prisma.player.findFirst({
        where: { email: { equals: email.trim(), mode: 'insensitive' } },
        select: { platformRole: true },
      });
      if (sa?.platformRole === PlatformRole.SUPER_ADMIN) {
        return;
      }
    }

    const org = await this.prisma.venueOrganization.findUnique({
      where: { id: organizationId },
      select: {
        trialEndsAt: true,
        platformBillingStatus: true,
      },
    });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    if (org.trialEndsAt) {
      const paying = isPayingPartnerOrg(org.platformBillingStatus);
      if (!paying && org.trialEndsAt.getTime() <= Date.now()) {
        throw new ForbiddenException(
          'Your trial has ended. Subscribe to make changes.',
        );
      }
    }
  }

  /**
   * Blocks partner portal mutations when the venue (or its org trial) is not allowed to edit.
   * Super admin bypasses unless `portalVenueContextHeader` matches `venueId` (acting as that venue’s partner).
   */
  async assertPartnerMayMutateVenue(
    venueId: string,
    requestUser?: unknown,
    opts?: { portalVenueContextHeader?: string | null },
  ): Promise<void> {
    const email = requestUser ? normalizeUserEmail(requestUser) : null;
    let superAdmin = false;
    if (email) {
      const row = await this.prisma.player.findFirst({
        where: { email: { equals: email.trim(), mode: 'insensitive' } },
        select: { platformRole: true },
      });
      superAdmin = row?.platformRole === PlatformRole.SUPER_ADMIN;
    }

    if (superAdmin) {
      const ctx = opts?.portalVenueContextHeader?.trim() ?? '';
      if (ctx !== venueId) {
        return;
      }
    }

    const venue = await this.prisma.venue.findUnique({
      where: { id: venueId },
      include: {
        organization: {
          select: {
            platformBillingStatus: true,
            trialEndsAt: true,
          },
        },
      },
    });
    if (!venue) {
      throw new NotFoundException('Venue not found');
    }

    if (venue.locked) {
      const msg =
        venue.lockReason === PARTNER_TRIAL_LOCK_REASON
          ? 'This location is not active on Cafe Social (trial ended or billing required). Renew to make changes.'
          : venue.lockReason?.trim() ||
            'This venue is locked — editing is disabled.';
      throw new ForbiddenException(msg);
    }

    const org = venue.organization;
    if (org?.trialEndsAt) {
      const paying = isPayingPartnerOrg(org.platformBillingStatus);
      if (
        !paying &&
        org.trialEndsAt.getTime() <= Date.now()
      ) {
        throw new ForbiddenException(
          'Your trial has ended. Subscribe to make changes.',
        );
      }
    }
  }
}
