import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { VenueStaffRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VenueStaffService } from './venue-staff.service';
import { OrganizationStaffGuard } from './organization-staff.guard';

const ORG_ID = 'org-1';

function contextFor(params: { organizationId?: string }): ExecutionContext {
  const req = {
    user: { email: 'staff@example.com' },
    params: { organizationId: params.organizationId },
  };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => function handler() {},
    getClass: () => class Dummy {},
  } as unknown as ExecutionContext;
}

describe('OrganizationStaffGuard', () => {
  let guard: OrganizationStaffGuard;
  let prisma: {
    venueOrganization: { findUnique: jest.Mock };
    player: { findFirst: jest.Mock };
    venue: { findMany: jest.Mock };
  };
  let venueStaff: { findMembership: jest.Mock };
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(async () => {
    prisma = {
      venueOrganization: { findUnique: jest.fn().mockResolvedValue({ id: ORG_ID }) },
      player: {
        findFirst: jest.fn().mockResolvedValue({ id: 'p1', platformRole: 'NONE' }),
      },
      venue: { findMany: jest.fn().mockResolvedValue([{ id: 'v1' }]) },
    };
    venueStaff = { findMembership: jest.fn().mockResolvedValue(null) };
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OrganizationStaffGuard,
        { provide: PrismaService, useValue: prisma },
        { provide: VenueStaffService, useValue: venueStaff },
        { provide: Reflector, useValue: reflector },
      ],
    }).compile();
    guard = moduleRef.get(OrganizationStaffGuard);
  });

  it('rejects a MANAGER on an OWNER-only route (billing)', async () => {
    reflector.getAllAndOverride.mockReturnValue(VenueStaffRole.OWNER);
    venueStaff.findMembership.mockResolvedValue({ role: VenueStaffRole.MANAGER });

    await expect(guard.canActivate(contextFor({ organizationId: ORG_ID }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows an OWNER on an OWNER-only route', async () => {
    reflector.getAllAndOverride.mockReturnValue(VenueStaffRole.OWNER);
    venueStaff.findMembership.mockResolvedValue({ role: VenueStaffRole.OWNER });

    await expect(guard.canActivate(contextFor({ organizationId: ORG_ID }))).resolves.toBe(true);
  });

  it('keeps default MANAGER minimum when no metadata set (analytics)', async () => {
    venueStaff.findMembership.mockResolvedValue({ role: VenueStaffRole.MANAGER });

    await expect(guard.canActivate(contextFor({ organizationId: ORG_ID }))).resolves.toBe(true);
  });

  it('rejects an EMPLOYEE even on default routes', async () => {
    venueStaff.findMembership.mockResolvedValue({ role: VenueStaffRole.EMPLOYEE });

    await expect(guard.canActivate(contextFor({ organizationId: ORG_ID }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects players with no membership in the organization', async () => {
    reflector.getAllAndOverride.mockReturnValue(VenueStaffRole.OWNER);
    venueStaff.findMembership.mockResolvedValue(null);

    await expect(guard.canActivate(contextFor({ organizationId: ORG_ID }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('lets super admins bypass the role requirement', async () => {
    reflector.getAllAndOverride.mockReturnValue(VenueStaffRole.OWNER);
    prisma.player.findFirst.mockResolvedValue({ id: 'p1', platformRole: 'SUPER_ADMIN' });

    await expect(guard.canActivate(contextFor({ organizationId: ORG_ID }))).resolves.toBe(true);
    expect(venueStaff.findMembership).not.toHaveBeenCalled();
  });
});
