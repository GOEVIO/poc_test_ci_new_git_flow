import { Controller, Post, Body, UsePipes, ValidationPipe, HttpStatus, Res } from '@nestjs/common';
import { CreditNoteService } from './credit-note.service';
import { CreateCreditNoteRequestDto } from './dto/create-credit-note-request.dto';
import { CreateCreditNoteResponseDto } from './dto/create-credit-note-response.dto';

@Controller('credit-notes')
export class CreditNoteController {
  constructor(private readonly creditNoteService: CreditNoteService) {}

  @Post('create')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async createCreditNote(@Body() data: CreateCreditNoteRequestDto, @Res() res): Promise<CreateCreditNoteResponseDto | { success: false; message: string }> {

      const creditNote = await this.creditNoteService.createCreditNote(data);
      const response: CreateCreditNoteResponseDto = {
        creditNoteId: creditNote.id,
        creditNoteNumber: creditNote.credit_note_number ?? null,
        status: creditNote.status,
        message: 'Credit note was created successfully. You will soon receive the credit note with all details.',
      };
      return res.status(HttpStatus.ACCEPTED).json(response);
  }
}