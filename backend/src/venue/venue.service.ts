import { Injectable, NotFoundException } from '@nestjs/common';
import type { Venue } from '@prisma/client';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { VenueRepository } from './venue.repository';

@Injectable()
export class VenueService {
  constructor(private readonly venues: VenueRepository) {}

  create(dto: CreateVenueDto): Promise<Venue> {
    return this.venues.create({
      name: dto.name,
      address: dto.address,
      latitude: dto.latitude,
      longitude: dto.longitude,
      radiusMeters: dto.radiusMeters,
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
    });
  }

  async remove(id: string): Promise<void> {
    await this.venues.delete(id);
  }
}

