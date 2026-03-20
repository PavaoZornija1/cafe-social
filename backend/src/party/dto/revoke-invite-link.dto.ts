import { IsUUID } from 'class-validator';

export class RevokeInviteLinkDto {
  @IsUUID()
  linkId!: string;
}
