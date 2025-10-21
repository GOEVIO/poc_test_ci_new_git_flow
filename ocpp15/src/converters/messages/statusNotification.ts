import { v4 as uuidv4 } from 'uuid';
export function handleStatusNotification(json: any): any {
  return [2, uuidv4(), 'StatusNotification', {
    connectorId: Number(json.connectorId) || 1,
    errorCode: json.errorCode || 'NoError',
    status: json.status || 'Available'
  }];
}