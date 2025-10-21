import { DataSource } from 'typeorm';
import { CreditNote } from '../entities/credit-note.entity';

export const CreditNoteRepository = (dataSource: DataSource) =>
  dataSource.getRepository(CreditNote).extend({
    async updateCreditNote(where: Partial<CreditNote>, updateData: Partial<CreditNote>): Promise<void> {
      await this.update(where, updateData);
    },

    async createCreditNote(data: Partial<CreditNote>): Promise<CreditNote> {
      const creditNote = this.create(data);
      return await this.save(creditNote);
    },

    async findCreditNote(where: Partial<CreditNote>): Promise<CreditNote | undefined> {
      return await this.findOne({ where });
    }
  });