const { test, describe, expect } = require('@jest/globals')

const { getTotalPowerConsumed } = require('../../../handlers/stopTransaction')

const startLessThanStop = {
  meterStop: 1000,
  session: {
    meterStart: 100
  }
}

const stopLessThanStart = {
  meterStop: 0,
  session: {
    meterStart: 100
  }
}

const metersLessThanReadingPoints = {
  meterStop: 0,
  session: {
    meterStart: 100,
    readingPoints: [{
      totalPower: 123
    }],
  },
}

const metersLessThanReadingPointsLessThanNotificationsHistory = {
  meterStop: 0,
  session: {
    meterStart: 100,
    readingPoints: [{
      totalPower: 123
    }],
    notificationsHistory: [{
      totalPower: 321
    }],
  },
}

describe('stopTransaction/getTotalPowerConsumed', () => {
  test.each([
    [startLessThanStop, 900],
    [stopLessThanStart, 0],
    [metersLessThanReadingPoints, 123],
    [metersLessThanReadingPointsLessThanNotificationsHistory, 321],
  ])('When session has %o should return %i', (testCase, expected) => {
    const { session, meterStop } = testCase
    expect(getTotalPowerConsumed(session, meterStop)).toBe(expected)
  })
})
