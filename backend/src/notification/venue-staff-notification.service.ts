import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VenueStaffRole } from '@prisma/client';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';

const STAFF_ROLES: VenueStaffRole[] = [
  VenueStaffRole.OWNER,
  VenueStaffRole.MANAGER,
  VenueStaffRole.EMPLOYEE,
];

@Injectable()
export class VenueStaffNotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  private ownerPortalUrl(venueId: string, path: string): string | undefined {
    const base = this.config.get<string>('PARTNER_PORTAL_BASE_URL')?.trim();
    if (!base) return undefined;
    const normalized = base.replace(/\/$/, '');
    return `${normalized}${path}?venueId=${encodeURIComponent(venueId)}`;
  }

  private async staffEmailsForVenue(venueId: string): Promise<string[]> {
    const rows = await this.prisma.venueStaff.findMany({
      where: { venueId, role: { in: STAFF_ROLES } },
      select: { player: { select: { email: true } } },
    });
    return [...new Set(rows.map((r) => r.player.email).filter(Boolean))];
  }

  async notifyBanAppealCreated(params: {
    venueId: string;
    appealId: string;
    playerId: string;
  }): Promise<void> {
    const [venue, player, emails] = await Promise.all([
      this.prisma.venue.findUnique({
        where: { id: params.venueId },
        select: { name: true },
      }),
      this.prisma.player.findUnique({
        where: { id: params.playerId },
        select: { username: true },
      }),
      this.staffEmailsForVenue(params.venueId),
    ]);
    if (emails.length === 0) return;

    const portal = this.ownerPortalUrl(params.venueId, '/appeals');
    await Promise.all(
      emails.map((to) =>
        this.email.notifyStaffBanAppeal({
          toEmail: to,
          venueName: venue?.name ?? 'your venue',
          playerUsername: player?.username ?? 'A player',
          portalUrl: portal,
        }),
      ),
    );
  }

  async notifyReceiptSubmitted(params: {
    venueId: string;
    submissionId: string;
    playerId: string;
  }): Promise<void> {
    const [venue, player, emails] = await Promise.all([
      this.prisma.venue.findUnique({
        where: { id: params.venueId },
        select: { name: true },
      }),
      this.prisma.player.findUnique({
        where: { id: params.playerId },
        select: { username: true },
      }),
      this.staffEmailsForVenue(params.venueId),
    ]);
    if (emails.length === 0) return;

    const portal = this.ownerPortalUrl(params.venueId, '/receipts');
    await Promise.all(
      emails.map((to) =>
        this.email.notifyStaffReceiptSubmitted({
          toEmail: to,
          venueName: venue?.name ?? 'your venue',
          playerUsername: player?.username ?? 'A player',
          portalUrl: portal,
        }),
      ),
    );
  }

  async notifyCampaignSent(params: {
    venueId: string;
    campaignName: string;
    recipientCount: number;
    sentByEmail?: string | null;
  }): Promise<void> {
    const venue = await this.prisma.venue.findUnique({
      where: { id: params.venueId },
      select: { name: true },
    });
    const emails = await this.staffEmailsForVenue(params.venueId);
    const targets = params.sentByEmail
      ? [...new Set([params.sentByEmail, ...emails])]
      : emails;
    if (targets.length === 0) return;

    await Promise.all(
      targets.map((to) =>
        this.email.notifyStaffCampaignSent({
          toEmail: to,
          venueName: venue?.name ?? 'your venue',
          campaignName: params.campaignName,
          recipientCount: params.recipientCount,
        }),
      ),
    );
  }
}
