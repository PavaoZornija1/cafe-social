import { IsString, Matches, MinLength } from 'class-validator';

export class RegisterExpoPushTokenDto {
  @IsString()
  @MinLength(20)
  @Matches(/^(Expo|Exponent)PushToken\[/, {
    message: 'expoPushToken must be an Expo push token',
  })
  expoPushToken!: string;
}
