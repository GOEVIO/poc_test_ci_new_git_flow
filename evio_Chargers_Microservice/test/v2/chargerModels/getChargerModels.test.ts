import { describe, test, afterEach, beforeAll, jest, expect } from '@jest/globals'
import { Request, Response } from 'express'

import {
  getAll
} from '../../../v2/chargerModels/controller'
import ChargerModel from '../../../v2/chargerModels/model'

describe('v2/chargerModels/controller.ts getAll', () => {
  const sendMock = jest.fn((payload: any) => payload)
  const statusMock = jest.fn((_: number) => ({
    send: sendMock
  }))

  const res = {
    status: statusMock
  } as any as Response

  const req = () => ({} as any as Request)

  const findMock = jest.fn() as jest.Mock<typeof ChargerModel.find>

  const chargerModelMock = {
    manufacturer: 'manufacturer',
    models: [{
      model: 'model',
      versions: [{
        protocol: 'protocol',
        firmwareVersion: 'firmwareVersion',
        compatibility: 'compatibility',
      }]
    }]
  } as any

  beforeAll(() => {
    ChargerModel.find = findMock as typeof ChargerModel.find
    findMock.mockResolvedValue([chargerModelMock])
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('Should send response', async () => {
    await getAll(req(), res)
    expect(findMock).toBeCalled()
    expect(statusMock).toBeCalledWith(200)
    expect(sendMock)
      .toBeCalledWith(expect.objectContaining(
        { message: 'OK', data: [chargerModelMock] }
      ))
    return
  })

  test('When failed to retrieve from db Should send error response', async () => {
    findMock.mockRejectedValue('error')

    await getAll(req(), res)
    expect(findMock).toBeCalled()
    expect(statusMock).toBeCalledWith(500)
    expect(sendMock)
      .toBeCalledWith(expect.objectContaining(
          {"auth": false, "code": "internal_server_error", "message": "Internal server error"}
      ))
    return
  })
})
