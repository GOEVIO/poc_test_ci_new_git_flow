import { jest } from '@jest/globals'

export type MockQueryProjectAsyncFunction = jest.Mock<(q: object, p?: object) => Promise<any[]>>