import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class CreatePlayerDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  username!: string;
}

