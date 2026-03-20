import { Injectable, NotFoundException } from '@nestjs/common';
import type { Venue } from '@prisma/client';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { VenueRepository } from './venue.repository';
import { PrismaService } from '../prisma/prisma.service';

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadiusM = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusM * Math.asin(Math.min(1, Math.sqrt(a)));
}

@Injectable()
export class VenueService {
  constructor(
    private readonly venues: VenueRepository,
    private readonly prisma: PrismaService,
  ) {}

  create(dto: CreateVenueDto): Promise<Venue> {
    return this.venues.create({
      name: dto.name,
      address: dto.address,
      latitude: dto.latitude,
      longitude: dto.longitude,
      radiusMeters: dto.radiusMeters,
      ...(dto.city !== undefined && { city: dto.city }),
      ...(dto.country !== undefined && { country: dto.country }),
      ...(dto.region !== undefined && { region: dto.region }),
    });
  }

  findAll(): Promise<Venue[]> {
    return this.venues.findAll();
  }

  async findDefaultVenue(): Promise<Venue | null> {
    return (
      (await this.venues.findDefaultNonPremium()) ??
      this.venues.findFallbackVenue()
    );
  }

  /**
   * Smallest geodesic distance among venues whose circle (radiusMeters) contains the point.
   */
  async findVenueAtCoordinates(latitude: number, longitude: number): Promise<Venue | null> {
    const venues = await this.venues.findAll();
    let best: { venue: Venue; distance: number } | null = null;
    for (const v of venues) {
      const d = haversineMeters(latitude, longitude, v.latitude, v.longitude);
      if (d <= v.radiusMeters) {
        if (!best || d < best.distance) {
          best = { venue: v, distance: d };
        }
      }
    }
    return best?.venue ?? null;
  }

  async findOne(id: string): Promise<Venue> {
    const venue = await this.venues.findById(id);
    if (!venue) {
      throw new NotFoundException(`Venue ${id} not found`);
    }
    return venue;
  }

  async update(id: string, dto: UpdateVenueDto): Promise<Venue> {
    await this.findOne(id);
    return this.venues.update(id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.address !== undefined && { address: dto.address }),
      ...(dto.latitude !== undefined && { latitude: dto.latitude }),
      ...(dto.longitude !== undefined && { longitude: dto.longitude }),
      ...(dto.radiusMeters !== undefined && { radiusMeters: dto.radiusMeters }),
      ...(dto.city !== undefined && { city: dto.city }),
      ...(dto.country !== undefined && { country: dto.country }),
      ...(dto.region !== undefined && { region: dto.region }),
    });
  }

  async remove(id: string): Promise<void> {
    await this.venues.delete(id);
  }

  /** Per-venue XP leaderboard (stored `PlayerVenueStats`). */
  async venueXpLeaderboard(venueId: string, limit = 50) {
    await this.findOne(venueId);
    return this.prisma.playerVenueStats.findMany({
      where: { venueId },
      orderBy: { venueXp: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
      include: {
        player: { select: { id: true, username: true } },
      },
    });
  }
}

