import { IsUUID } from 'class-validator';

export class FriendAcceptDto {
  @IsUUID()
  otherPlayerId!: string;
}
