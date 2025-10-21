import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SessionDocument = ChargingSession & Document;

@Schema()
export class ChargingSession {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  sessionDuration: number;

  @Prop({ required: true })
  amountExlVat: number;

  @Prop({ required: true })
  amountIncVat: number;

  @Prop({ required: true, enum: ['valid', 'processed', 'invalid'] })
  status: string;

  @Prop({ required: true, default: Date.now })
  timestamp: Date;
}

export const SessionSchema = SchemaFactory.createForClass(ChargingSession);