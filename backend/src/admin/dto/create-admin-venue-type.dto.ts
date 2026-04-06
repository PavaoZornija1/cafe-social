import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateAdminVenueTypeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(/^[A-Za-z][A-Za-z0-9_]*$/, {
    message: 'Code must start with a letter and contain only letters, numbers, and underscores.',
  })
  code!: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  label?: string | null;
}
