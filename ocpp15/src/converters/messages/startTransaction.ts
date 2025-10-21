import { v4 as uuidv4 } from 'uuid';
export function handleStartTransaction(json: any): any {
  return [2, uuidv4(), 'StartTransaction', {
    connectorId: Number(json.connectorId) || 1,
    idTag: json.idTag || '',
    meterStart: Number(json.meterStart) || 0,
    timestamp: json.timestamp || new Date().toISOString()
  }];
}