import {
  plainToInstance,
  instanceToPlain,
  ClassTransformOptions,
} from "class-transformer";

type Ctor<T extends object> = new (...args: any[]) => T;

const DEFAULT_IN_OPTS: ClassTransformOptions = {
  excludeExtraneousValues: true,  
  enableImplicitConversion: true, 
};
const DEFAULT_OUT_OPTS: ClassTransformOptions = {};


// Generic toInstance 
export function toInstance<T extends object, D extends object>(
  Target: Ctor<T>,
  data: D,
  options?: ClassTransformOptions
): T;
export function toInstance<T extends object, D extends object>(
  Target: Ctor<T>,
  data: D[],
  options?: ClassTransformOptions
): T[];

export function toInstance<T extends object, D extends object>(
  Target: Ctor<T>,
  data: D | D[],
  options: ClassTransformOptions = {}
): T | T[] {
  if (data == null) throw new Error("toInstance: data is null/undefined");

  const base = { ...DEFAULT_IN_OPTS, ...options };

  return Array.isArray(data)
    ? plainToInstance(Target, data as object[], base)
    : plainToInstance(Target, data as object, base);
}

// This can be used to transform an object with the exposed fields of the target class
export function toPlainAs<Destination extends object>(
  Target: Ctor<Destination>,
  data: Partial<Destination> | object,
  options?: ClassTransformOptions
): Record<string, unknown>;
export function toPlainAs<Destination extends object>(
  Target: Ctor<Destination>,
  data: Array<Partial<Destination> | object>,
  options?: ClassTransformOptions
): Record<string, unknown>[];

export function toPlainAs<Destination extends object>(
  Target: Ctor<Destination>,
  data: Partial<Destination> | object | Array<Partial<Destination> | object>,
  options: ClassTransformOptions = {}
): Record<string, unknown> | Record<string, unknown>[] {
  if (data == null) throw new Error("toPlainAs: data is null/undefined");
  const base = { ...DEFAULT_OUT_OPTS, ...options };

  const make = (one: Partial<Destination> | object) => {
    const instance = Object.assign(new Target(), one) as Destination;
    return instanceToPlain(instance, base);
  };

  return Array.isArray(data) ? data.map(make) : make(data);
}

