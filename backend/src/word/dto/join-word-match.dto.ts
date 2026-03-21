import { IsString, Length } from 'class-validator';

export class JoinWordMatchDto {
  @IsString()
  @Length(4, 8)
  inviteCode!: string;
}
