import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SubscriptionDocument = Subscription & Document;

@Schema({ collection: 'subscriptions' })
export class Subscription {
  @Prop({ index: true })
  operatorID: string;

  @Prop()
  operatorName: string;

  @Prop()
  pricingModel: string;

  @Prop()
  validUntil: Date;

  @Prop()
  validFrom: Date;

  @Prop()
  active: boolean;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
