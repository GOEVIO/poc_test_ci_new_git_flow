import { jest } from '@jest/globals'

export const mockResponse = () => {
  const mock = {
    status: jest.fn((s: number) => mock),
    send: jest.fn((b?: any) => mock),
  }
  return mock
}