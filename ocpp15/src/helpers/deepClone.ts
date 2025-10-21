export function deepClone(obj: any): any {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item));
  }

  if (typeof obj === 'object') {
    const result: any = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = deepClone(v);
    }
    return result;
  }

  return String(obj);
}