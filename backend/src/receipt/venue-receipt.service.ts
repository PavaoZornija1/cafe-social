import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ReceiptSubmissionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VenueService } from '../venue/venue.service';

const MAX_IMAGE_BYTES = 2_500_000;

function estimateBase64Bytes(s: string): number {
  return Math.floor((s.length * 3) / 4);
}

@Injectable()
export class VenueReceiptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly venues: VenueService,
  ) {}

  async submit(params: {
    venueId: string;
    playerId: string;
    imageData: string;
    mimeType?: string;
    notePlayer?: string;
    latitude?: number;
    longitude?: number;
  }) {
    const hasCoords =
      typeof params.latitude === 'number' &&
      typeof params.longitude === 'number' &&
      Number.isFinite(params.latitude) &&
      Number.isFinite(params.longitude);
    if (!hasCoords) {
      throw new BadRequestException('Location (lat/lng) is required to submit a receipt here');
    }
    const at = await this.venues.findVenueAtCoordinates(params.latitude!, params.longitude!);
    if (!at || at.id !== params.venueId) {
      throw new BadRequestException('You must be at this venue to submit a receipt');
    }

    const raw = params.imageData.trim();
    if (!raw) throw new BadRequestException('imageData is required');
    if (estimateBase64Bytes(raw) > MAX_IMAGE_BYTES) {
      throw new BadRequestException('Image too large (max ~2MB)');
    }

    const retention = new Date();
    retention.setUTCDate(retention.getUTCDate() + 90);

    const row = await this.prisma.venueReceiptSubmission.create({
      data: {
        venueId: params.venueId,
        playerId: params.playerId,
        imageData: raw,
        mimeType: params.mimeType?.trim().slice(0, 64) || 'image/jpeg',
        notePlayer: params.notePlayer?.trim()?.slice(0, 2000),
        retentionUntil: retention,
        status: ReceiptSubmissionStatus.PENDING,
      },
    });
    return {
      id: row.id,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      retentionUntil: row.retentionUntil?.toISOString() ?? null,
    };
  }

  listSummaryForVenue(venueId: string, status?: ReceiptSubmissionStatus) {
    return this.prisma.venueReceiptSubmission.findMany({
      where: {
        venueId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        venueId: true,
        playerId: true,
        mimeType: true,
        notePlayer: true,
        status: true,
        staffNote: true,
        abuseFlag: true,
        retentionUntil: true,
        reviewedAt: true,
        reviewedByPlayerId: true,
        createdAt: true,
        player: { select: { id: true, username: true, email: true } },
      },
    });
  }

  async getDetailForVenueStaff(venueId: string, id: string) {
    const row = await this.prisma.venueReceiptSubmission.findFirst({
      where: { id, venueId },
      include: {
        player: { select: { id: true, username: true, email: true } },
      },
    });
    if (!row) throw new NotFoundException('Submission not found');
    return row;
  }

  async review(params: {
    venueId: string;
    submissionId: string;
    reviewerPlayerId: string;
    status: 'APPROVED' | 'REJECTED';
    staffNote?: string;
    abuseFlag?: boolean;
  }) {
    const row = await this.prisma.venueReceiptSubmission.findFirst({
      where: { id: params.submissionId, venueId: params.venueId },
    });
    if (!row) throw new NotFoundException('Submission not found');
    if (row.status !== ReceiptSubmissionStatus.PENDING) {
      throw new BadRequestException('Already reviewed');
    }

    return this.prisma.venueReceiptSubmission.update({
      where: { id: row.id },
      data: {
        status: params.status as ReceiptSubmissionStatus,
        staffNote: params.staffNote?.trim()?.slice(0, 2000),
        abuseFlag: params.abuseFlag ?? false,
        reviewedAt: new Date(),
        reviewedByPlayerId: params.reviewerPlayerId,
      },
    });
  }
}
