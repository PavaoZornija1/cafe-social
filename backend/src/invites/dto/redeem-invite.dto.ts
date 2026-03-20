import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RedeemInviteDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  token!: string;
}
