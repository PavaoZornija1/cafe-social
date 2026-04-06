import {
  Body,
  Controller,
  Delete,
  Get,
  ConflictException,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformSuperAdminGuard } from '../auth/platform-super-admin.guard';
import { PrismaService } from '../prisma/prisma.service';
import { VenueNudgeAdminService } from '../venue/venue-nudge-admin.service';
import {
  AdminCmsAccessService,
  type AdminCmsScope,
} from './admin-cms-access.service';
import { AdminCmsGuard, getAdminCmsScope } from './admin-cms.guard';
import { CreateVenueNudgeAssignmentDto } from './dto/create-venue-nudge-assignment.dto';
import { PatchVenueNudgeAssignmentDto } from './dto/patch-venue-nudge-assignment.dto';
import { TriggerVenueNudgeDto } from './dto/trigger-venue-nudge.dto';
import type { Request } from 'express';

type ReqWithScope = Request & { adminCmsScope?: AdminCmsScope };

@Controller('admin/venues')
@UseGuards(JwtAuthGuard, AdminCmsGuard)
export class AdminVenueNudgeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cmsAccess: AdminCmsAccessService,
    private readonly nudgeAdmin: VenueNudgeAdminService,
  ) {}

  @Get(':venueId/nudge-assignments')
  async listAssignments(@Req() req: ReqWithScope, @Param('venueId', new ParseUUIDPipe()) venueId: string) {
    const scope = getAdminCmsScope(req);
    this.cmsAccess.assertVenueInScope(scope, venueId);
    return this.prisma.venueNudgeAssignment.findMany({
      where: { venueId },
      orderBy: { sortOrder: 'asc' },
      include: {
        template: true,
      },
    });
  }

  @Post(':venueId/nudge-assignments')
  async createAssignment(
    @Req() req: ReqWithScope,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Body() body: CreateVenueNudgeAssignmentDto,
  ) {
    const scope = getAdminCmsScope(req);
    this.cmsAccess.assertVenueInScope(scope, venueId);
    const tpl = await this.prisma.venueOrderNudgeTemplate.findUnique({
      where: { id: body.templateId },
    });
    if (!tpl) throw new NotFoundException('Template not found');
    if (!tpl.active) throw new NotFoundException('Template is inactive');
    try {
      return await this.prisma.venueNudgeAssignment.create({
        data: {
          venueId,
          templateId: body.templateId,
          sortOrder: body.sortOrder ?? 100,
          titleOverride: body.titleOverride?.trim() ? body.titleOverride.trim() : null,
          bodyOverride: body.bodyOverride?.trim() ? body.bodyOverride.trim() : null,
          afterMinutesOverride: body.afterMinutesOverride ?? null,
          enabled: body.enabled ?? true,
        },
        include: { template: true },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('This nudge is already attached to the venue');
      }
      throw e;
    }
  }

  @Patch(':venueId/nudge-assignments/:assignmentId')
  async patchAssignment(
    @Req() req: ReqWithScope,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Param('assignmentId', new ParseUUIDPipe()) assignmentId: string,
    @Body() body: PatchVenueNudgeAssignmentDto,
  ) {
    const scope = getAdminCmsScope(req);
    this.cmsAccess.assertVenueInScope(scope, venueId);
    const row = await this.prisma.venueNudgeAssignment.findFirst({
      where: { id: assignmentId, venueId },
    });
    if (!row) throw new NotFoundException('Assignment not found');
    return this.prisma.venueNudgeAssignment.update({
      where: { id: assignmentId },
      data: {
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
        ...(body.titleOverride !== undefined && {
          titleOverride: body.titleOverride?.trim() ? body.titleOverride.trim() : null,
        }),
        ...(body.bodyOverride !== undefined && {
          bodyOverride: body.bodyOverride?.trim() ? body.bodyOverride.trim() : null,
        }),
        ...(body.afterMinutesOverride !== undefined && {
          afterMinutesOverride: body.afterMinutesOverride,
        }),
        ...(body.enabled !== undefined && { enabled: body.enabled }),
      },
      include: { template: true },
    });
  }

  @Delete(':venueId/nudge-assignments/:assignmentId')
  async deleteAssignment(
    @Req() req: ReqWithScope,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Param('assignmentId', new ParseUUIDPipe()) assignmentId: string,
  ) {
    const scope = getAdminCmsScope(req);
    this.cmsAccess.assertVenueInScope(scope, venueId);
    const row = await this.prisma.venueNudgeAssignment.findFirst({
      where: { id: assignmentId, venueId },
    });
    if (!row) throw new NotFoundException('Assignment not found');
    await this.prisma.venueNudgeAssignment.delete({ where: { id: assignmentId } });
    return { ok: true };
  }

  /** Super-admin: send this assignment’s copy now to players currently at the venue (throttled). */
  @Post(':venueId/nudge-assignments/trigger')
  @UseGuards(JwtAuthGuard, AdminCmsGuard, PlatformSuperAdminGuard)
  async trigger(
    @Req() req: ReqWithScope,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Body() body: TriggerVenueNudgeDto,
  ) {
    const scope = getAdminCmsScope(req);
    this.cmsAccess.assertVenueInScope(scope, venueId);
    return this.nudgeAdmin.triggerNow(venueId, body.assignmentId);
  }
}
