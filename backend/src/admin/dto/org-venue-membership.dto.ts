import { IsArray, IsOptional, IsUUID } from 'class-validator';

export class OrgVenueMembershipDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  attachVenueIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  detachVenueIds?: string[];
}
