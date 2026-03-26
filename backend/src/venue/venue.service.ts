import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
      ...(dto.isPremium !== undefined && { isPremium: dto.isPremium }),
      ...(dto.menuUrl !== undefined && { menuUrl: dto.menuUrl }),
      ...(dto.orderingUrl !== undefined && { orderingUrl: dto.orderingUrl }),
      ...(dto.orderNudgeTitle !== undefined && { orderNudgeTitle: dto.orderNudgeTitle }),
      ...(dto.orderNudgeBody !== undefined && { orderNudgeBody: dto.orderNudgeBody }),
      ...(dto.featuredOfferTitle !== undefined && { featuredOfferTitle: dto.featuredOfferTitle }),
      ...(dto.featuredOfferBody !== undefined && { featuredOfferBody: dto.featuredOfferBody }),
      ...(dto.featuredOfferEndsAt !== undefined && {
        featuredOfferEndsAt: dto.featuredOfferEndsAt
          ? new Date(dto.featuredOfferEndsAt)
          : null,
      }),
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
      ...(dto.isPremium !== undefined && { isPremium: dto.isPremium }),
      ...(dto.menuUrl !== undefined && { menuUrl: dto.menuUrl }),
      ...(dto.orderingUrl !== undefined && { orderingUrl: dto.orderingUrl }),
      ...(dto.orderNudgeTitle !== undefined && { orderNudgeTitle: dto.orderNudgeTitle }),
      ...(dto.orderNudgeBody !== undefined && { orderNudgeBody: dto.orderNudgeBody }),
      ...(dto.featuredOfferTitle !== undefined && { featuredOfferTitle: dto.featuredOfferTitle }),
      ...(dto.featuredOfferBody !== undefined && { featuredOfferBody: dto.featuredOfferBody }),
      ...(dto.featuredOfferEndsAt !== undefined && {
        featuredOfferEndsAt: dto.featuredOfferEndsAt
          ? new Date(dto.featuredOfferEndsAt)
          : null,
      }),
    });
  }

  /** Public fields for the mobile app (menu, ordering, featured offer). */
  async getPublicCard(id: string) {
    await this.findOne(id);
    const v = await this.prisma.venue.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        menuUrl: true,
        orderingUrl: true,
        featuredOfferTitle: true,
        featuredOfferBody: true,
        featuredOfferEndsAt: true,
      },
    });
    if (!v) throw new NotFoundException(`Venue ${id} not found`);
    const now = new Date();
    const featuredLive =
      !!v.featuredOfferTitle?.trim() &&
      (!v.featuredOfferEndsAt || v.featuredOfferEndsAt > now);
    return {
      id: v.id,
      name: v.name,
      menuUrl: v.menuUrl,
      orderingUrl: v.orderingUrl,
      featuredOffer: featuredLive
        ? {
            title: v.featuredOfferTitle,
            body: v.featuredOfferBody,
            endsAt: v.featuredOfferEndsAt?.toISOString() ?? null,
          }
        : null,
    };
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

  private clampLeaderboardLimit(limit?: number) {
    return Math.min(Math.max(limit ?? 50, 1), 100);
  }

  /** Sum of `venueXp` across all venues per player (global ladder). */
  async globalXpLeaderboard(limit = 50) {
    const take = this.clampLeaderboardLimit(limit);
    const rows = await this.prisma.$queryRaw<
      { playerId: string; totalXp: number; username: string }[]
    >(Prisma.sql`
      SELECT p.id AS "playerId", SUM(pvs."venueXp")::int AS "totalXp", p.username AS "username"
      FROM "PlayerVenueStats" pvs
      INNER JOIN "Player" p ON p.id = pvs."playerId"
      GROUP BY p.id, p.username
      ORDER BY "totalXp" DESC
      LIMIT ${take}
    `);
    return rows.map((r) => ({
      venueXp: r.totalXp,
      player: { id: r.playerId, username: r.username },
    }));
  }

  /** Sum of venue XP for venues in a given country (ISO-style code, e.g. BA). */
  async countryXpLeaderboard(country: string, limit = 50) {
    const take = this.clampLeaderboardLimit(limit);
    const c = country.trim().toUpperCase();
    if (!c || c.length > 3) {
      return [];
    }
    const rows = await this.prisma.$queryRaw<
      { playerId: string; totalXp: number; username: string }[]
    >(Prisma.sql`
      SELECT p.id AS "playerId", SUM(pvs."venueXp")::int AS "totalXp", p.username AS "username"
      FROM "PlayerVenueStats" pvs
      INNER JOIN "Venue" v ON v.id = pvs."venueId"
      INNER JOIN "Player" p ON p.id = pvs."playerId"
      WHERE TRIM(UPPER(v.country)) = ${c}
      GROUP BY p.id, p.username
      ORDER BY "totalXp" DESC
      LIMIT ${take}
    `);
    return rows.map((r) => ({
      venueXp: r.totalXp,
      player: { id: r.playerId, username: r.username },
    }));
  }

  /** Sum of venue XP for venues in a city + country (case-insensitive city match). */
  async cityXpLeaderboard(city: string, country: string, limit = 50) {
    const take = this.clampLeaderboardLimit(limit);
    const cityNorm = city.trim().toLowerCase();
    const c = country.trim().toUpperCase();
    if (!cityNorm || !c || c.length > 3) {
      return [];
    }
    const rows = await this.prisma.$queryRaw<
      { playerId: string; totalXp: number; username: string }[]
    >(Prisma.sql`
      SELECT p.id AS "playerId", SUM(pvs."venueXp")::int AS "totalXp", p.username AS "username"
      FROM "PlayerVenueStats" pvs
      INNER JOIN "Venue" v ON v.id = pvs."venueId"
      INNER JOIN "Player" p ON p.id = pvs."playerId"
      WHERE LOWER(TRIM(COALESCE(v.city, ''))) = ${cityNorm}
        AND TRIM(UPPER(v.country)) = ${c}
      GROUP BY p.id, p.username
      ORDER BY "totalXp" DESC
      LIMIT ${take}
    `);
    return rows.map((r) => ({
      venueXp: r.totalXp,
      player: { id: r.playerId, username: r.username },
    }));
  }
}

