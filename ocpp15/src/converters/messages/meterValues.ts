import { v4 as uuidv4 } from 'uuid';

export function handleMeterValues(json: any): any {
  const values = json.values || [];
  const timestamp = values.length > 0 ? values[0]?.timestamp : new Date().toISOString();

  const sampledValue = values.map((v: any) => ({
    value: v.value._,
    context: v.value.$?.context || 'Sample.Periodic',
    format: v.value.$?.format || 'Raw',
    measurand: v.value.$?.measurand || 'Energy.Active.Import.Register',
    unit: v.value.$?.unit || 'Wh'
  }));

  return [2, uuidv4(), 'MeterValues', {
    connectorId: Number(json.connectorId) || 1,
    transactionId: Number(json.transactionId) || 0,
    meterValue: [
      {
        timestamp,
        sampledValue
      }
    ]
  }];
}

