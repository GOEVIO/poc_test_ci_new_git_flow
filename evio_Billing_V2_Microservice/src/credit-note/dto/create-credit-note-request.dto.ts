import { IsString, IsArray, ArrayNotEmpty } from 'class-validator';

export class CreateCreditNoteRequestDto {
  @IsString()
  invoiceId: string;

  @IsString()
  reason: string;

  @IsArray()
  @ArrayNotEmpty()
  session_ids: string[];

  @IsString()
  raisedBy: string;
}