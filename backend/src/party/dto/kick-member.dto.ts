import { IsUUID } from 'class-validator';

export class KickMemberDto {
  @IsUUID()
  targetPlayerId!: string;
}
