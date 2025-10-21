import { Injectable } from '@nestjs/common';
import { SubscriptionRepository } from './subscription.repository';
import { Subscription } from './subscription.schema';
import {OicpPricingModel } from 'evio-library-commons'


@Injectable()
export class SubscriptionService {
  constructor(private readonly subscriptionRepo: SubscriptionRepository) {}

  create(data: Partial<Subscription>) {
    return this.subscriptionRepo.create(data);
  }

  findAll() {
    return this.subscriptionRepo.findAll();
  }

  getOperatorIds() {
    return this.subscriptionRepo.getOperatorIds();
  }

  getActiveSubscriptions() {
    return this.subscriptionRepo.getActiveSubscriptions();
  }

  getOperatorIdsByPricingModel(pricingModel: string) {
    return this.subscriptionRepo.getOperatorIdsByPricingModel(pricingModel);
  }

  findByOperatorId(operatorID: string, active?: boolean) {
    return this.subscriptionRepo.findByOperatorId(operatorID, active);
  }

  update(operatorID: string, update: Partial<Subscription>) {
    return this.subscriptionRepo.updateByOperatorId(operatorID, update);
  }

  delete(operatorID: string) {
    return this.subscriptionRepo.deleteByOperatorId(operatorID);
  }

  extractOperatorIds(subscriptions: Subscription[]): string[] {
    return subscriptions.map(({operatorID}) => operatorID);
  }

  extractDynamicOperatorIds(subscriptions: Subscription[]): string[] {
    return subscriptions.filter(({ pricingModel}) => pricingModel === OicpPricingModel.dynamic).map(({operatorID}) => operatorID);
  }
}
