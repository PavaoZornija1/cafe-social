import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DismissModerationReportDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  /** Shown to the reporter in the app when the report is dismissed. */
  dismissalNoteToReporter?: string;
}
