import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PartnerVenueApplicationStatus,
  Prisma,
  VenueOrganizationKind,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePartnerApplicationDto } from './dto/create-partner-application.dto';
import { ApprovePartnerApplicationDto } from './dto/approve-partner-application.dto';
import { PartnerProvisioningService } from './partner-provisioning.service';
import { PlayerService } from '../player/player.service';
import {
  assertPinInsidePolygon,
  parseVenueGeofencePolygonInput,
} from '../venue/geofence';

function normalizeApplicantEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class PartnerApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provisioning: PartnerProvisioningService,
    private readonly players: PlayerService,
  ) {}

  async createPublicApplication(
    dto: CreatePartnerApplicationDto,
    submittedByPlayerId?: string,
  ) {
    const applicantEmail = normalizeApplicantEmail(dto.applicantEmail);
    const existingPending = await this.prisma.partnerVenueApplication.findFirst(
      {
        where: {
          applicantEmail,
          status: PartnerVenueApplicationStatus.PENDING,
        },
      },
    );
    if (existingPending) {
      throw new ConflictException(
        'An application for this email is already pending review.',
      );
    }

    try {
      return await this.prisma.partnerVenueApplication.create({
        data: {
          applicantEmail,
          applicantName: dto.applicantName.trim(),
          applicantPhone: dto.applicantPhone?.trim() || null,
          venueName: dto.venueName.trim(),
          address: dto.address.trim(),
          city: dto.city.trim(),
          country: dto.country.trim(),
          submittedByPlayerId: submittedByPlayerId ?? null,
        },
        select: { id: true, status: true },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'An application for this email is already pending review.',
        );
      }
      throw e;
    }
  }

  async getLatestForEmail(email: string) {
    const applicantEmail = normalizeApplicantEmail(email);
    return this.prisma.partnerVenueApplication.findFirst({
      where: { applicantEmail },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        rejectionReason: true,
        createdVenueId: true,
        createdOrganizationId: true,
        createdAt: true,
      },
    });
  }

  async listForAdmin(params: {
    status?: PartnerVenueApplicationStatus;
    page: number;
    limit: number;
    search?: string;
  }) {
    const { page, limit, search } = params;
    const status =
      params.status ?? PartnerVenueApplicationStatus.PENDING;

    const andParts: Prisma.PartnerVenueApplicationWhereInput[] = [
      { status },
    ];
    const q = search?.trim();
    if (q) {
      andParts.push({
        OR: [
          { applicantEmail: { contains: q, mode: 'insensitive' } },
          { applicantName: { contains: q, mode: 'insensitive' } },
          { venueName: { contains: q, mode: 'insensitive' } },
          { city: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.PartnerVenueApplicationWhereInput = { AND: andParts };

    const [total, items] = await Promise.all([
      this.prisma.partnerVenueApplication.count({ where }),
      this.prisma.partnerVenueApplication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          status: true,
          applicantEmail: true,
          applicantName: true,
          applicantPhone: true,
          venueName: true,
          city: true,
          country: true,
          createdAt: true,
          reviewedAt: true,
        },
      }),
    ]);

    return { total, page, limit, items };
  }

  async getByIdForAdmin(id: string) {
    const row = await this.prisma.partnerVenueApplication.findUnique({
      where: { id },
    });
    if (!row) {
      throw new NotFoundException('Application not found');
    }
    return row;
  }

  async approve(id: string, reviewerPlayerId: string, body: ApprovePartnerApplicationDto) {
    const app = await this.getByIdForAdmin(id);
    if (app.status === PartnerVenueApplicationStatus.APPROVED) {
      return {
        alreadyApproved: true,
        organizationId: app.createdOrganizationId,
        venueId: app.createdVenueId,
      };
    }
    if (app.status === PartnerVenueApplicationStatus.REJECTED) {
      throw new BadRequestException('Cannot approve a rejected application');
    }

    const polygon = parseVenueGeofencePolygonInput(body.geofencePolygon);
    assertPinInsidePolygon(body.latitude, body.longitude, polygon);

    const venueName = (body.venueName ?? app.venueName).trim();
    const organizationName = (
      body.organizationName ?? venueName
    ).trim();
    const locationKind =
      body.locationKind ?? VenueOrganizationKind.SINGLE_LOCATION;

    const player = await this.players.findOrCreateByEmail(app.applicantEmail);

    const provisioned = await this.provisioning.provisionPartnerOrgAndVenue(
      player.id,
      {
        locationKind,
        organizationName,
        venueName,
        latitude: body.latitude,
        longitude: body.longitude,
        geofencePolygon: body.geofencePolygon,
        address: app.address,
        city: app.city,
        country: app.country,
        analyticsTimeZone: body.analyticsTimeZone,
      },
    );

    await this.prisma.partnerVenueApplication.update({
      where: { id },
      data: {
        status: PartnerVenueApplicationStatus.APPROVED,
        reviewedAt: new Date(),
        reviewedByPlayerId: reviewerPlayerId,
        latitude: body.latitude,
        longitude: body.longitude,
        geofencePolygon: polygon as unknown as Prisma.InputJsonValue,
        locationKind,
        organizationName,
        venueName,
        analyticsTimeZone: body.analyticsTimeZone?.trim() || null,
        createdOrganizationId: provisioned.organizationId,
        createdVenueId: provisioned.venueId,
      },
    });

    return {
      alreadyApproved: false,
      organizationId: provisioned.organizationId,
      venueId: provisioned.venueId,
      trialEndsAt: provisioned.trialEndsAt,
    };
  }

  async reject(id: string, reviewerPlayerId: string, reason?: string) {
    const app = await this.getByIdForAdmin(id);
    if (app.status === PartnerVenueApplicationStatus.REJECTED) {
      return { alreadyRejected: true };
    }
    if (app.status === PartnerVenueApplicationStatus.APPROVED) {
      throw new BadRequestException('Cannot reject an approved application');
    }

    await this.prisma.partnerVenueApplication.update({
      where: { id },
      data: {
        status: PartnerVenueApplicationStatus.REJECTED,
        reviewedAt: new Date(),
        reviewedByPlayerId: reviewerPlayerId,
        rejectionReason: reason?.trim() || null,
      },
    });

    return { alreadyRejected: false };
  }
}
