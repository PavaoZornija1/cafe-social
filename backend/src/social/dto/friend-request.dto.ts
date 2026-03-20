import { IsUUID } from 'class-validator';

export class FriendRequestDto {
  @IsUUID()
  targetPlayerId!: string;
}
