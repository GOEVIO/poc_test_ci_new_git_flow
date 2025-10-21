import { RetryOperation } from '../retry.enums';

export interface ScheduleRetryInput {
  relatedObjectType: string;
  relatedObjectId: string;
  operation: RetryOperation;
  failureReason: string;
  objectType: string;
}