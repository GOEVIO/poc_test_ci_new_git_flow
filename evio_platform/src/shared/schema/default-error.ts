export const defaultError = {
  message: 'Some error message',
  error: 'Bad Request',
  statusCode: 400,
}
export const defaultErrorSchema = {
  type: 'object',
  schema: {
    type: 'object',
    properties: defaultError,
  },
}
