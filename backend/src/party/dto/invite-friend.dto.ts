import { IsUUID } from 'class-validator';

export class InviteFriendDto {
  @IsUUID()
  friendPlayerId!: string;
}
