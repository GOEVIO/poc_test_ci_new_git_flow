const { jest } = require('@jest/globals')

jest.mock('evio-toggle', () => ({
  isEnable: jest.fn(() => true)
}))