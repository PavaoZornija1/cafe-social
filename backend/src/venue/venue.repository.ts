import { Injectable } from '@nestjs/common';
import type { Prisma, Venue } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VenueRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.VenueCreateInput): Promise<Venue> {
    return this.prisma.venue.create({ data });
  }

  findAll(): Promise<Venue[]> {
    return this.prisma.venue.findMany({ orderBy: { createdAt: 'desc' } });
  }

  findDefaultNonPremium(): Promise<Venue | null> {
    // Default venue for MVP "locationRequired" gating: prefer non-premium.
    return this.prisma.venue.findFirst({
      where: { isPremium: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  findFallbackVenue(): Promise<Venue | null> {
    return this.prisma.venue.findFirst({ orderBy: { createdAt: 'desc' } });
  }

  findById(id: string): Promise<Venue | null> {
    return this.prisma.venue.findUnique({ where: { id } });
  }

  update(id: string, data: Prisma.VenueUpdateInput): Promise<Venue> {
    return this.prisma.venue.update({ where: { id }, data });
  }

  delete(id: string): Promise<Venue> {
    return this.prisma.venue.delete({ where: { id } });
  }
}

