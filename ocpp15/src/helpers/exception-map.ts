import { ValidationError } from 'class-validator'

export const exceptionsMap = (
  validationErrors: Array<ValidationError> = [],
): Array<any> => {
  const errors = validationErrors.map(({ constraints, property, children }) => {
    const errorMessages = {}

    if (constraints)
      errorMessages[property] = Object.keys(constraints).map(
        (key) => constraints[key],
      )

    if (children)
      Object.assign(errorMessages, childrenExceptions(children, property))

    return errorMessages
  })

  return errors
}

const childrenExceptions = (
  children: Array<ValidationError> = [],
  fatherProperty: string,
): Record<string, any> => {
  const errorMessages = {}

  const childrenErrors = exceptionsMap(children)

  if (childrenErrors) {
    childrenErrors?.forEach((childError: Record<string, unknown>) => {
      Object.entries(childError).forEach(([childProperty, value]) => {
        errorMessages[`${fatherProperty}.${childProperty}`] = value
      })
    })
  }

  return errorMessages
}
