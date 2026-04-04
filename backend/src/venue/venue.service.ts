import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Venue } from '@prisma/client';
import type { AdminCmsScope } from '../admin/admin-cms-access.service';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { AdminPatchVenueDto } from './dto/admin-patch-venue.dto';
import { VenueRepository } from './venue.repository';
import { PrismaService } from '../prisma/prisma.service';
import {
  assertPinInsidePolygon,
  distanceToVenuePinMeters,
  parseVenueGeofencePolygonInput,
  pointInVenueGeofence,
  polygonFromCenterRadiusMeters,
} from './geofence';
import type { Polygon as GeoJsonPolygon } from 'geojson';

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
      geofencePolygon: polygonFromCenterRadiusMeters(
        dto.latitude,
        dto.longitude,
        dto.radiusMeters,
      ) as unknown as Prisma.InputJsonValue,
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

  /** Partner CMS list: all venues for super admin, scoped venues for owners/managers. */
  async listForAdminCms(scope: AdminCmsScope): Promise<Venue[]> {
    if (scope.kind === 'super_admin') {
      return this.findAll();
    }
    if (scope.managedVenueIds.length === 0) {
      return [];
    }
    return this.prisma.venue.findMany({
      where: { id: { in: scope.managedVenueIds } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Safe, unauthenticated list for the in-app partner discovery map. */
  async listForPublicDiscoveryMap() {
    const rows = await this.venues.findAllForDiscoveryMap();
    return rows.filter(
      (r) =>
        Number.isFinite(r.latitude) &&
        Number.isFinite(r.longitude) &&
        Math.abs(r.latitude) <= 90 &&
        Math.abs(r.longitude) <= 180,
    );
  }

  async findDefaultVenue(): Promise<Venue | null> {
    return (
      (await this.venues.findDefaultNonPremium()) ??
      this.venues.findFallbackVenue()
    );
  }

  /**
   * Closest venue (by pin distance) among those whose stored geofence polygon contains the point.
   */
  async findVenueAtCoordinates(latitude: number, longitude: number): Promise<Venue | null> {
    const venues = await this.venues.findAll();
    let best: { venue: Venue; distance: number } | null = null;
    for (const v of venues) {
      if (v.locked) continue;
      if (!pointInVenueGeofence(latitude, longitude, v)) continue;
      const d = distanceToVenuePinMeters(latitude, longitude, v);
      if (!best || d < best.distance) {
        best = { venue: v, distance: d };
      }
    }
    return best?.venue ?? null;
  }

  /**
   * Closest venue whose geofence contains the point, including locked venues
   * (for public detection / “temporarily unavailable” UX).
   */
  async findVenueAtCoordinatesIncludingLocked(
    latitude: number,
    longitude: number,
  ): Promise<Venue | null> {
    const venues = await this.venues.findAll();
    let best: { venue: Venue; distance: number } | null = null;
    for (const v of venues) {
      if (!pointInVenueGeofence(latitude, longitude, v)) continue;
      const d = distanceToVenuePinMeters(latitude, longitude, v);
      if (!best || d < best.distance) {
        best = { venue: v, distance: d };
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

  /** Full venue row for partner CMS (Clerk super admin JWT). */
  sanitizeVenueForAdmin(venue: Venue): Venue {
    return venue;
  }

  async updateForAdmin(id: string, dto: AdminPatchVenueDto) {
    const venue = await this.findOne(id);
    const {
      organizationId,
      locked,
      lockReason,
      geofencePolygon: geoRaw,
      ...venueFields
    } = dto;

    const nextLat =
      venueFields.latitude !== undefined ? venueFields.latitude : venue.latitude;
    const nextLng =
      venueFields.longitude !== undefined ? venueFields.longitude : venue.longitude;

    if (
      (venueFields.latitude !== undefined || venueFields.longitude !== undefined) &&
      geoRaw === undefined &&
      venue.geofencePolygon != null
    ) {
      const g = venue.geofencePolygon as unknown as GeoJsonPolygon;
      assertPinInsidePolygon(nextLat, nextLng, g);
    }

    let geofenceUpdate: Prisma.InputJsonValue | undefined;
    if (geoRaw !== undefined) {
      const polygon = parseVenueGeofencePolygonInput(geoRaw);
      assertPinInsidePolygon(nextLat, nextLng, polygon);
      geofenceUpdate = polygon as unknown as Prisma.InputJsonValue;
    }

    const hasVenueFields = Object.keys(venueFields).some(
      (k) => (venueFields as Record<string, unknown>)[k] !== undefined,
    );
    if (hasVenueFields) {
      await this.update(id, venueFields as UpdateVenueDto);
    }

    const adminPatch: Prisma.VenueUpdateInput = {};
    if (organizationId !== undefined) {
      adminPatch.organization =
        organizationId && typeof organizationId === 'string'
          ? { connect: { id: organizationId } }
          : { disconnect: true };
    }
    if (locked !== undefined) adminPatch.locked = locked;
    if (lockReason !== undefined) adminPatch.lockReason = lockReason;
    if (geofenceUpdate !== undefined) adminPatch.geofencePolygon = geofenceUpdate;

    if (Object.keys(adminPatch).length > 0) {
      await this.venues.update(id, adminPatch);
    }

    const v = await this.findOne(id);
    return this.sanitizeVenueForAdmin(v);
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
      ...(dto.analyticsTimeZone !== undefined && {
        analyticsTimeZone: dto.analyticsTimeZone?.trim() || null,
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

