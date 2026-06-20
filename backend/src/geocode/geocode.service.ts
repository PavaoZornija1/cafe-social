import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type GeocodeSearchHit,
  type MapboxGeocodeResponse,
  mapboxFeatureToHit,
} from './geocode.types';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;

@Injectable()
export class GeocodeService {
  private readonly log = new Logger(GeocodeService.name);
  private readonly cache = new Map<
    string,
    { expiresAt: number; hits: GeocodeSearchHit[] }
  >();

  constructor(private readonly config: ConfigService) {}

  private token(): string | null {
    return this.config.get<string>('MAPBOX_ACCESS_TOKEN')?.trim() || null;
  }

  private cacheKey(q: string, country?: string, limit?: number): string {
    return `${q.toLowerCase()}|${country?.toUpperCase() ?? ""}|${limit ?? 5}`;
  }

  private readCache(key: string): GeocodeSearchHit[] | null {
    const row = this.cache.get(key);
    if (!row) return null;
    if (row.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return row.hits;
  }

  private writeCache(key: string, hits: GeocodeSearchHit[]): void {
    if (this.cache.size >= CACHE_MAX) {
      const first = this.cache.keys().next().value;
      if (first) this.cache.delete(first);
    }
    this.cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, hits });
  }

  async search(params: {
    q: string;
    country?: string;
    proximityLng?: number;
    proximityLat?: number;
    limit?: number;
  }): Promise<GeocodeSearchHit[]> {
    const token = this.token();
    if (!token) {
      throw new ServiceUnavailableException(
        'Address search is not configured (MAPBOX_ACCESS_TOKEN).',
      );
    }

    const q = params.q.trim();
    if (q.length < 3) {
      throw new BadRequestException('Query must be at least 3 characters.');
    }
    if (q.length > 200) {
      throw new BadRequestException('Query is too long.');
    }

    const limit = Math.min(Math.max(params.limit ?? 5, 1), 8);
    const country = params.country?.trim().toUpperCase();
    if (country && !/^[A-Z]{2}$/.test(country)) {
      throw new BadRequestException('country must be ISO 3166-1 alpha-2.');
    }

    const cacheKey = this.cacheKey(q, country, limit);
    const cached = this.readCache(cacheKey);
    if (cached) return cached;

    const url = new URL(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`,
    );
    url.searchParams.set('access_token', token);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('types', 'address,poi,place');
    url.searchParams.set('autocomplete', 'true');
    if (country) {
      url.searchParams.set('country', country.toLowerCase());
    }
    if (
      params.proximityLng != null &&
      params.proximityLat != null &&
      Number.isFinite(params.proximityLng) &&
      Number.isFinite(params.proximityLat)
    ) {
      url.searchParams.set(
        'proximity',
        `${params.proximityLng},${params.proximityLat}`,
      );
    }

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
      });
    } catch (e) {
      this.log.warn(
        JSON.stringify({
          msg: 'mapbox_geocode_fetch_failed',
          error: (e as Error).message,
        }),
      );
      throw new ServiceUnavailableException('Address search temporarily unavailable.');
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.log.warn(
        JSON.stringify({
          msg: 'mapbox_geocode_error',
          status: res.status,
          body: body.slice(0, 300),
        }),
      );
      throw new ServiceUnavailableException('Address search temporarily unavailable.');
    }

    const data = (await res.json()) as MapboxGeocodeResponse;
    const hits = (data.features ?? [])
      .map(mapboxFeatureToHit)
      .filter((h): h is GeocodeSearchHit => h != null);

    this.writeCache(cacheKey, hits);
    return hits;
  }
}
