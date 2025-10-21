import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Subscription, SubscriptionDocument } from './subscription.schema'

@Injectable()
export class SubscriptionRepository {
  constructor(
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<SubscriptionDocument>,
  ) {}

  async create(data: Partial<Subscription>): Promise<Subscription> {
    return this.subscriptionModel.create(data)
  }

  async findAll(): Promise<Subscription[]> {
    return this.subscriptionModel.find().exec()
  }

  async getOperatorIds(): Promise<string[]> {
    const now = new Date()
    return this.subscriptionModel
      .distinct('operatorID', {
        active: true,
        validFrom: { $lte: now },
        validUntil: { $gte: now },
      })
      .exec()
  }

  async getActiveSubscriptions(): Promise<Subscription[]> {
    const now = new Date()
    return this.subscriptionModel
      .find({
        active: true,
        validFrom: { $lte: now },
        validUntil: { $gte: now },
      })
      .exec()
  }

  async getOperatorIdsByPricingModel(pricingModel: string): Promise<string[]> {
    const now = new Date()
    return this.subscriptionModel
      .distinct('operatorID', {
        active: true,
        pricingModel,
        validFrom: { $lte: now },
        validUntil: { $gte: now },
      })
      .exec()
  }

  async findByOperatorId(
    operatorID: string,
    active?: boolean,
  ): Promise<Subscription | null> {
    const now = new Date()
    const filter: {
      operatorID: string
      active?: boolean
      validFrom: { $lte: Date }
      validUntil: { $gte: Date }
    } = { operatorID, validFrom: { $lte: now }, validUntil: { $gte: now } }
    if (active !== undefined) filter.active = active

    return this.subscriptionModel.findOne(filter).exec()
  }

  async deleteByOperatorId(operatorID: string): Promise<void> {
    await this.subscriptionModel.deleteOne({ operatorID }).exec()
  }

  async updateByOperatorId(
    operatorID: string,
    update: Partial<Subscription>,
  ): Promise<Subscription | null> {
    return this.subscriptionModel
      .findOneAndUpdate({ operatorID }, update, { new: true })
      .exec()
  }
}
