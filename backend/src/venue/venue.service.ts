import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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
} from './geofence';
import { haversineKm } from '../lib/haversine-km';
import type { Polygon as GeoJsonPolygon } from 'geojson';
import { loadPublicVenueOffersForVenue } from './venue-offer-public.util';

@Injectable()
export class VenueService {
  constructor(
    private readonly venues: VenueRepository,
    private readonly prisma: PrismaService,
  ) {}

  create(dto: CreateVenueDto): Promise<Venue> {
    const polygon = parseVenueGeofencePolygonInput(dto.geofencePolygon);
    assertPinInsidePolygon(dto.latitude, dto.longitude, polygon);
    return this.venues.create({
      name: dto.name,
      address: dto.address,
      latitude: dto.latitude,
      longitude: dto.longitude,
      geofencePolygon: polygon as unknown as Prisma.InputJsonValue,
      ...(dto.city !== undefined && { city: dto.city }),
      ...(dto.country !== undefined && { country: dto.country }),
      ...(dto.region !== undefined && { region: dto.region }),
      ...(dto.isPremium !== undefined && { isPremium: dto.isPremium }),
      ...(dto.menuUrl !== undefined && { menuUrl: dto.menuUrl }),
      ...(dto.orderingUrl !== undefined && { orderingUrl: dto.orderingUrl }),
      ...(dto.orderNudgeTitle !== undefined && { orderNudgeTitle: dto.orderNudgeTitle }),
      ...(dto.orderNudgeBody !== undefined && { orderNudgeBody: dto.orderNudgeBody }),
    });
  }

  findAll(): Promise<Venue[]> {
    return this.venues.findAll();
  }

  /** Partner CMS list: paginated; scoped for owners/managers, all for super admin. */
  async listForAdminCmsPaginated(
    scope: AdminCmsScope,
    params: {
      page: number;
      limit: number;
      search?: string;
      location?: string;
      lockedOnly?: boolean;
      organizationId?: string;
      countries?: string[];
    },
  ): Promise<{
    items: Array<{
      id: string;
      name: string;
      city: string | null;
      country: string | null;
      organizationId: string | null;
      locked: boolean;
      menuUrl: string | null;
      orderingUrl: string | null;
      organization: { id: string; name: string } | null;
    }>;
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    const { page, limit, search, location, lockedOnly, organizationId, countries } = params;
    const andParts: Prisma.VenueWhereInput[] = [];

    if (scope.kind !== 'super_admin') {
      if (scope.managedVenueIds.length === 0) {
        return { items: [], total: 0, page, limit, hasMore: false };
      }
      andParts.push({ id: { in: scope.managedVenueIds } });
    }

    if (lockedOnly) andParts.push({ locked: true });

    if (organizationId === '__none__') {
      andParts.push({ organizationId: null });
    } else if (organizationId && organizationId.length > 0) {
      andParts.push({ organizationId });
    }

    if (scope.kind === 'super_admin' && countries && countries.length > 0) {
      andParts.push({
        country: { in: countries },
      });
    }

    const q = search?.trim();
    if (q) {
      const orParts: Prisma.VenueWhereInput[] = [
        { name: { contains: q, mode: 'insensitive' } },
      ];
      if (/^[0-9a-f-]{36}$/i.test(q)) {
        orParts.push({ id: q });
      } else if (q.length >= 2) {
        orParts.push({ id: { contains: q, mode: 'insensitive' } });
      }
      andParts.push({ OR: orParts });
    }

    const loc = location?.trim();
    if (loc) {
      andParts.push({
        OR: [
          { city: { contains: loc, mode: 'insensitive' } },
          { country: { contains: loc, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.VenueWhereInput =
      andParts.length === 0 ? {} : andParts.length === 1 ? andParts[0]! : { AND: andParts };

    const skip = (page - 1) * limit;

    const [total, rows] = await Promise.all([
      this.prisma.venue.count({ where }),
      this.prisma.venue.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          city: true,
          country: true,
          organizationId: true,
          locked: true,
          menuUrl: true,
          orderingUrl: true,
          organization: { select: { id: true, name: true } },
        },
      }),
    ]);

    const items = rows.map((r) => ({
      id: r.id,
      name: r.name,
      city: r.city,
      country: r.country,
      organizationId: r.organizationId,
      locked: r.locked,
      menuUrl: r.menuUrl,
      orderingUrl: r.orderingUrl,
      organization: r.organization,
    }));

    return {
      items,
      total,
      page,
      limit,
      hasMore: page * limit < total,
    };
  }

  /** Safe, unauthenticated list for the in-app partner discovery map. */
  async listForPublicDiscoveryMap() {
    return this.listPublicDiscoveryMapFiltered({});
  }

  /**
   * Map pins with optional filters: venue type codes (ANY match), distance from lat/lng,
   * and venues with at least one **active, non-exhausted** public offer.
   */
  async listPublicDiscoveryMapFiltered(filters: {
    venueTypeCodes?: string[];
    lat?: number;
    lng?: number;
    radiusKm?: number;
    hasActiveOffer?: boolean;
  }) {
    const now = new Date();
    const typeCodesUpper = (filters.venueTypeCodes ?? [])
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);

    const rows = await this.prisma.venue.findMany({
      where: { locked: false },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        address: true,
        city: true,
        country: true,
        isPremium: true,
        geofencePolygon: true,
        venueVenueTypes: {
          select: { venueType: { select: { code: true } } },
        },
      },
    });

    const offers = await this.prisma.venueOffer.findMany({
      where: { status: 'ACTIVE' },
      select: {
        venueId: true,
        maxRedemptions: true,
        redemptionCount: true,
        validFrom: true,
        validTo: true,
      },
    });

    const venuesWithActiveOffer = new Set<string>();
    for (const o of offers) {
      if (o.validFrom && now < o.validFrom) continue;
      if (o.validTo && now > o.validTo) continue;
      if (o.maxRedemptions != null && o.redemptionCount >= o.maxRedemptions) continue;
      venuesWithActiveOffer.add(o.venueId);
    }

    const lat0 = filters.lat;
    const lng0 = filters.lng;
    const radiusKm = filters.radiusKm;
    const hasCenter =
      typeof lat0 === 'number' &&
      typeof lng0 === 'number' &&
      Number.isFinite(lat0) &&
      Number.isFinite(lng0) &&
      typeof radiusKm === 'number' &&
      Number.isFinite(radiusKm) &&
      radiusKm > 0;

    const out: Array<{
      id: string;
      name: string;
      latitude: number;
      longitude: number;
      address: string | null;
      city: string | null;
      country: string | null;
      isPremium: boolean;
      geofencePolygon: unknown | null;
      venueTypeCodes: string[];
      hasActiveOffer: boolean;
    }> = [];

    for (const r of rows) {
      if (
        !Number.isFinite(r.latitude) ||
        !Number.isFinite(r.longitude) ||
        Math.abs(r.latitude) > 90 ||
        Math.abs(r.longitude) > 180
      ) {
        continue;
      }
      const codes = r.venueVenueTypes.map((x) => x.venueType.code);
      if (typeCodesUpper.length > 0) {
        const hit = codes.some((c) => typeCodesUpper.includes(c.toUpperCase()));
        if (!hit) continue;
      }
      const hasOffer = venuesWithActiveOffer.has(r.id);
      if (filters.hasActiveOffer && !hasOffer) continue;
      if (hasCenter) {
        const d = haversineKm(lat0!, lng0!, r.latitude, r.longitude);
        if (d > radiusKm!) continue;
      }
      out.push({
        id: r.id,
        name: r.name,
        latitude: r.latitude,
        longitude: r.longitude,
        address: r.address,
        city: r.city,
        country: r.country,
        isPremium: r.isPremium,
        geofencePolygon: r.geofencePolygon,
        venueTypeCodes: codes,
        hasActiveOffer: hasOffer,
      });
    }
    return out;
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

  /**
   * Guest flows (play, redeem, receipts): point must lie in this venue’s geofence.
   * Locked venues are rejected with a clear message (not a generic “not at venue”).
   */
  async assertCoordinatesAllowedForGuestVenue(
    venueId: string,
    latitude: number,
    longitude: number,
  ): Promise<void> {
    const inside = await this.findVenueAtCoordinatesIncludingLocked(latitude, longitude);
    if (!inside || inside.id !== venueId) {
      throw new ForbiddenException('You must be at the venue');
    }
    if (inside.locked) {
      throw new ForbiddenException('This venue is temporarily unavailable');
    }
  }

  async findOne(id: string): Promise<Venue> {
    const venue = await this.venues.findById(id);
    if (!venue) {
      throw new NotFoundException(`Venue ${id} not found`);
    }
    return venue;
  }

  /** Venue row plus organization label for admin CMS pickers. */
  async findOneWithOrgForAdmin(id: string): Promise<{
    venue: Venue;
    organization: { id: string; name: string } | null;
  }> {
    const venue = await this.findOne(id);
    const organization = venue.organizationId
      ? await this.prisma.venueOrganization.findUnique({
          where: { id: venue.organizationId },
          select: { id: true, name: true },
        })
      : null;
    return { venue, organization };
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
      venueTypeCodes,
      guestPlayDailyGamesLimit,
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
    if (guestPlayDailyGamesLimit !== undefined) {
      adminPatch.guestPlayDailyGamesLimit = guestPlayDailyGamesLimit;
    }

    if (Object.keys(adminPatch).length > 0) {
      await this.venues.update(id, adminPatch);
    }

    if (venueTypeCodes !== undefined) {
      await this.replaceVenueTypesForVenue(id, venueTypeCodes);
    }

    const v = await this.findOne(id);
    return this.sanitizeVenueForAdmin(v);
  }

  async replaceVenueTypesForVenue(venueId: string, codes: string[]) {
    const normalized = [
      ...new Set(
        codes
          .map((c) => String(c).trim().toUpperCase())
          .filter((c) => c.length > 0),
      ),
    ];
    const types = await this.prisma.venueType.findMany({
      where: { code: { in: normalized } },
    });
    if (types.length !== normalized.length) {
      const found = new Set(types.map((t) => t.code));
      const missing = normalized.filter((c) => !found.has(c));
      throw new BadRequestException(`Unknown venue type code(s): ${missing.join(', ')}`);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.venueVenueType.deleteMany({ where: { venueId } });
      if (types.length > 0) {
        await tx.venueVenueType.createMany({
          data: types.map((t) => ({ venueId, venueTypeId: t.id })),
        });
      }
    });
  }

  async update(id: string, dto: UpdateVenueDto): Promise<Venue> {
    const existing = await this.findOne(id);
    let geofenceUpdate: Prisma.InputJsonValue | undefined;
    if (dto.geofencePolygon !== undefined) {
      const polygon = parseVenueGeofencePolygonInput(dto.geofencePolygon);
      const lat = dto.latitude !== undefined ? dto.latitude : existing.latitude;
      const lng = dto.longitude !== undefined ? dto.longitude : existing.longitude;
      assertPinInsidePolygon(lat, lng, polygon);
      geofenceUpdate = polygon as unknown as Prisma.InputJsonValue;
    }
    return this.venues.update(id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.address !== undefined && { address: dto.address }),
      ...(dto.latitude !== undefined && { latitude: dto.latitude }),
      ...(dto.longitude !== undefined && { longitude: dto.longitude }),
      ...(geofenceUpdate !== undefined && { geofencePolygon: geofenceUpdate }),
      ...(dto.city !== undefined && { city: dto.city }),
      ...(dto.country !== undefined && { country: dto.country }),
      ...(dto.region !== undefined && { region: dto.region }),
      ...(dto.isPremium !== undefined && { isPremium: dto.isPremium }),
      ...(dto.menuUrl !== undefined && { menuUrl: dto.menuUrl }),
      ...(dto.orderingUrl !== undefined && { orderingUrl: dto.orderingUrl }),
      ...(dto.orderNudgeTitle !== undefined && { orderNudgeTitle: dto.orderNudgeTitle }),
      ...(dto.orderNudgeBody !== undefined && { orderNudgeBody: dto.orderNudgeBody }),
      ...(dto.analyticsTimeZone !== undefined && {
        analyticsTimeZone: dto.analyticsTimeZone?.trim() || null,
      }),
    });
  }

  /** Public fields for the mobile app (menu, ordering, offers). */
  async getPublicCard(id: string) {
    await this.findOne(id);
    const v = await this.prisma.venue.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        menuUrl: true,
        orderingUrl: true,
        locked: true,
        latitude: true,
        longitude: true,
      },
    });
    if (!v) throw new NotFoundException(`Venue ${id} not found`);
    const geofenceForClient = {
      latitude: v.latitude,
      longitude: v.longitude,
      /// Circular region radius for OS geofencing (meters); approximate vs polygon geofence.
      radiusMeters: 200,
    };
    if (v.locked) {
      return {
        id: v.id,
        name: v.name,
        menuUrl: v.menuUrl,
        orderingUrl: v.orderingUrl,
        offers: [],
        featuredOffer: null,
        geofence: geofenceForClient,
      };
    }
    const { offers, featuredOffer } = await loadPublicVenueOffersForVenue(this.prisma, id);
    return {
      id: v.id,
      name: v.name,
      menuUrl: v.menuUrl,
      orderingUrl: v.orderingUrl,
      offers,
      featuredOffer,
      geofence: geofenceForClient,
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

