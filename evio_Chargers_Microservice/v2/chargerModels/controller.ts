import { Request, Response } from 'express'

import ChargeModel from './model'

export async function getAll(req: Request, res: Response) {
  try {
    const models = await ChargeModel.find(
      {}, // all
      { // projection needed by frontend
        manufacturer: 1,
        models: 1
      }
    )
    return res.status(200).send({ data: models, message: 'OK' })
  } catch (e) {
    console.error('Unexpected error getting all ChargerModels', e)
    return res.status(500).send({
      auth: false,
      code: 'internal_server_error',
      message: "Internal server error"
    })
  }
}
