import { IsIn, IsUUID } from 'class-validator';

/** Metadata links for future campaign automations; validated against this venue. */
export const OWNER_CAMPAIGN_BINDING_ENTITY_TYPES = [
  'CHALLENGE',
  'VENUE_PERK',
  'VENUE_OFFER',
] as const;

export type OwnerCampaignBindingEntityType =
  (typeof OWNER_CAMPAIGN_BINDING_ENTITY_TYPES)[number];

export class CreateOwnerCampaignBindingDto {
  @IsIn([...OWNER_CAMPAIGN_BINDING_ENTITY_TYPES])
  entityType!: OwnerCampaignBindingEntityType;

  @IsUUID('4')
  entityId!: string;
}
