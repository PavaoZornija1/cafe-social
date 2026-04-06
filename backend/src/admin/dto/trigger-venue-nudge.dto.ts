import { IsNotEmpty, IsUUID } from 'class-validator';

export class TriggerVenueNudgeDto {
  @IsUUID()
  assignmentId!: string;
}
