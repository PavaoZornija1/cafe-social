import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformSuperAdminGuard } from '../auth/platform-super-admin.guard';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVenueOrganizationDto } from './dto/create-venue-organization.dto';
import { PatchVenueOrganizationDto } from './dto/patch-venue-organization.dto';

@Controller('admin/organizations')
@UseGuards(JwtAuthGuard, PlatformSuperAdminGuard)
export class AdminOrganizationController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.venueOrganization.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { venues: true } },
      },
    });
  }

  @Get(':id')
  async get(@Param('id', new ParseUUIDPipe()) id: string) {
    const row = await this.prisma.venueOrganization.findUnique({
      where: { id },
      include: {
        venues: {
          select: {
            id: true,
            name: true,
            locked: true,
            city: true,
            country: true,
            address: true,
          },
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!row) throw new NotFoundException('Organization not found');
    return row;
  }

  @Post()
  create(@Body() body: CreateVenueOrganizationDto) {
    return this.prisma.venueOrganization.create({
      data: {
        name: body.name.trim(),
        slug: body.slug?.trim() || null,
        platformBillingPlan: body.platformBillingPlan?.trim() || null,
        platformBillingStatus: body.platformBillingStatus?.trim() || 'NONE',
        platformBillingRenewsAt: body.platformBillingRenewsAt
          ? new Date(body.platformBillingRenewsAt)
          : null,
        stripeCustomerId: body.stripeCustomerId?.trim() || null,
        billingPortalUrl: body.billingPortalUrl?.trim() || null,
      },
    });
  }

  @Patch(':id')
  async patch(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: PatchVenueOrganizationDto,
  ) {
    await this.prisma.venueOrganization.findUniqueOrThrow({ where: { id } });
    return this.prisma.venueOrganization.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.slug !== undefined && { slug: body.slug?.trim() || null }),
        ...(body.platformBillingPlan !== undefined && {
          platformBillingPlan: body.platformBillingPlan?.trim() || null,
        }),
        ...(body.platformBillingStatus !== undefined && {
          platformBillingStatus: body.platformBillingStatus?.trim() || undefined,
        }),
        ...(body.platformBillingRenewsAt !== undefined && {
          platformBillingRenewsAt: body.platformBillingRenewsAt
            ? new Date(body.platformBillingRenewsAt)
            : null,
        }),
        ...(body.stripeCustomerId !== undefined && {
          stripeCustomerId: body.stripeCustomerId?.trim() || null,
        }),
        ...(body.billingPortalUrl !== undefined && {
          billingPortalUrl: body.billingPortalUrl?.trim() || null,
        }),
      },
    });
  }

  @Delete(':id')
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.prisma.venueOrganization.delete({ where: { id } });
    return { ok: true };
  }
}
