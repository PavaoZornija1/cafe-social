import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeocodeService } from './geocode.service';

describe('GeocodeService', () => {
  const fetchMock = jest.fn();
  let service: GeocodeService;

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    const config = {
      get: jest.fn((key: string) =>
        key === 'MAPBOX_ACCESS_TOKEN' ? 'pk.test-token' : undefined,
      ),
    } as unknown as ConfigService;
    service = new GeocodeService(config);
  });

  it('throws when token missing', async () => {
    const config = { get: jest.fn(() => undefined) } as unknown as ConfigService;
    const svc = new GeocodeService(config);
    await expect(svc.search({ q: 'Main street' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('rejects short queries', async () => {
    await expect(service.search({ q: 'ab' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('maps Mapbox features to normalized hits', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          {
            id: 'address.1',
            place_name: 'Trubarjeva cesta 1, Ljubljana, Slovenia',
            center: [14.5058, 46.0569],
            text: 'Trubarjeva cesta',
            address: '1',
            context: [
              { id: 'place.1', text: 'Ljubljana' },
              { id: 'country.1', short_code: 'si' },
            ],
          },
        ],
      }),
    });

    const hits = await service.search({ q: 'Trubarjeva 1', country: 'SI' });
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      lat: 46.0569,
      lng: 14.5058,
      city: 'Ljubljana',
      country: 'SI',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('mapbox.places'),
      expect.any(Object),
    );
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('country=si');
  });

  it('uses cache on repeat query', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ features: [] }),
    });
    await service.search({ q: 'Cached query here' });
    await service.search({ q: 'Cached query here' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
