import { v4 as uuidv4 } from 'uuid';
export function handleHeartbeat(json: any): any {
  return [2, uuidv4(), 'Heartbeat', {}];
}