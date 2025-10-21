import { v4 as uuidv4 } from 'uuid';
export function handleStopTransaction(json: any): any {
  return [2, uuidv4(), 'StopTransaction', {
    transactionId: Number(json.transactionId) || 1,
    meterStop: Number(json.meterStop) || 0,
    timestamp: json.timestamp || new Date().toISOString()
  }];
}