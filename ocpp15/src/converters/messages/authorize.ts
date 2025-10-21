import { v4 as uuidv4 } from 'uuid';
export function handleAuthorize(json: any): any {
  return [2, uuidv4(), 'Authorize', { idTag: json.idTag || '' }];
}