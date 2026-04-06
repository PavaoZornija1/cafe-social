import {
  Body,
  Controller,
  Get,
  ConflictException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformSuperAdminGuard } from '../auth/platform-super-admin.guard';
import { PrismaService } from '../prisma/prisma.service';
import { AdminCmsGuard } from './admin-cms.guard';
import { CreateAdminNudgeTemplateDto } from './dto/create-admin-nudge-template.dto';
import { PatchAdminNudgeTemplateDto } from './dto/patch-admin-nudge-template.dto';

@Controller('admin/nudge-templates')
export class AdminNudgeTemplateController {
  constructor(private readonly prisma: PrismaService) {}

  /** CMS: library of nudge templates (assign to venues from venue screen). */
  @Get()
  @UseGuards(JwtAuthGuard, AdminCmsGuard)
  list() {
    return this.prisma.venueOrderNudgeTemplate.findMany({
      orderBy: [{ sortPriority: 'asc' }, { code: 'asc' }],
      include: {
        _count: { select: { venueTypeLinks: true, venueAssignments: true } },
      },
    });
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminCmsGuard, PlatformSuperAdminGuard)
  async create(@Body() body: CreateAdminNudgeTemplateDto) {
    const code = body.code.trim().toUpperCase().replace(/\s+/g, '_');
    try {
      return await this.prisma.venueOrderNudgeTemplate.create({
        data: {
          code,
          nudgeType: body.nudgeType.trim(),
          titleTemplate: body.titleTemplate.trim(),
          bodyTemplate: body.bodyTemplate.trim(),
          ...(body.description !== undefined && {
            description: body.description?.trim() || null,
          }),
          ...(body.defaultAfterMinutes !== undefined && {
            defaultAfterMinutes: body.defaultAfterMinutes,
          }),
          sortPriority: body.sortPriority ?? 100,
          active: body.active ?? true,
        },
        include: {
          _count: { select: { venueTypeLinks: true, venueAssignments: true } },
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Nudge template code "${code}" already exists`);
      }
      throw e;
    }
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminCmsGuard, PlatformSuperAdminGuard)
  async patch(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: PatchAdminNudgeTemplateDto) {
    await this.prisma.venueOrderNudgeTemplate.findUniqueOrThrow({ where: { id } });
    return this.prisma.venueOrderNudgeTemplate.update({
      where: { id },
      data: {
        ...(body.nudgeType !== undefined && { nudgeType: body.nudgeType.trim() }),
        ...(body.titleTemplate !== undefined && { titleTemplate: body.titleTemplate.trim() }),
        ...(body.bodyTemplate !== undefined && { bodyTemplate: body.bodyTemplate.trim() }),
        ...(body.description !== undefined && {
          description: body.description === null ? null : body.description?.trim() || null,
        }),
        ...(body.defaultAfterMinutes !== undefined && {
          defaultAfterMinutes: body.defaultAfterMinutes,
        }),
        ...(body.sortPriority !== undefined && { sortPriority: body.sortPriority }),
        ...(body.active !== undefined && { active: body.active }),
      },
      include: {
        _count: { select: { venueTypeLinks: true, venueAssignments: true } },
      },
    });
  }
}
