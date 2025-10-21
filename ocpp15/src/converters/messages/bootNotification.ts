import { v4 as uuidv4 } from 'uuid';
export function handleBootNotification(json: any): any {
  const payload = {
    chargePointVendor: json.chargePointVendor || '',
    chargePointModel: json.chargePointModel || '',
    chargePointSerialNumber: json.chargePointSerialNumber || '',
    chargeBoxSerialNumber: json.chargeBoxSerialNumber || '',
    firmwareVersion: json.firmwareVersion || '',
    meterType: json.meterType || '',
    meterSerialNumber: json.meterSerialNumber || ''
  };
  return [2, uuidv4(), 'BootNotification', payload];
}