import { PartialType } from '@nestjs/mapped-types';
import { CreateVenueOrganizationDto } from './create-venue-organization.dto';

export class PatchVenueOrganizationDto extends PartialType(
  CreateVenueOrganizationDto,
) {}
