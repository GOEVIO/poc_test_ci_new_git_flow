import { describe, test, afterEach, jest, expect } from '@jest/globals'
import { Request, Response } from 'express'

import { 
  LocationsV2Controller
} from '../../../v2/locations/controller'
import Infrastructure from '../../../models/infrastructure'

jest.mock('evio-library-identity')

describe('v2/locations/controller.ts LocationsV2Controller.create', () => {
  const saveMock = jest.fn(() => ({}))
  const constructorMock = jest.fn((_: object) => {})
  class infraMock {
    constructor(obj: object) {
      constructorMock(obj)
    }
    async save() {
      return saveMock()
    }
  }

  const saveImageMock = jest.fn(async (_: any) => {})

  const controller = new LocationsV2Controller(
    infraMock as any as typeof Infrastructure,
    saveImageMock
  )

  const sendMock = jest.fn((payload: any) => payload)
  const statusMock = jest.fn((_: number) => ({
    send: sendMock
  }))

  const res = {
    status: statusMock
  }

  const req = (body = {}, userid = 'userid', clientname = 'clientname') => ({
    body,
    headers: {
      userid,
      clientname,
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('Should create file and infrastructure and send response', async () => {
    await controller.create(
      req() as any as Request,
      res as any as Response
    )
    expect(saveMock).toBeCalled()
    expect(saveImageMock).toBeCalled()
    expect(statusMock).toBeCalledWith(201)
    expect(sendMock).toBeCalledWith(expect.objectContaining({ message: 'created' }))
    return
  })

  test('When failed to save file should send 500', async () => {
    saveImageMock.mockRejectedValueOnce({})
    await controller.create(
      req() as any as Request,
      res as any as Response
    )
    expect(saveMock).not.toBeCalled()
    expect(saveImageMock).toBeCalled()
    expect(statusMock).toBeCalledWith(500)
    expect(sendMock).toBeCalledWith(expect.objectContaining({ message: 'Unexpected' }))
    return
  })

  test('When failed to save document should send 500', async () => {
    saveMock.mockRejectedValueOnce({} as never)
    await controller.create(
      req() as any as Request,
      res as any as Response
    )
    expect(saveMock).toBeCalled()
    expect(saveImageMock).toBeCalled()
    expect(statusMock).toBeCalledWith(500)
    expect(sendMock).toBeCalledWith(expect.objectContaining({ message: 'Unexpected' }))
    return
  })
})