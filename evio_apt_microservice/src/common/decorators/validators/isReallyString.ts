import { registerDecorator, ValidationOptions } from 'class-validator'

// eslint-disable-next-line @typescript-eslint/naming-convention
export function IsReallyString(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isReallyString',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          return (
            typeof value === 'string' &&
            value.trim() !== '' &&
            !/^\d+$/.test(value)
          )
        },
      },
    })
  }
}
