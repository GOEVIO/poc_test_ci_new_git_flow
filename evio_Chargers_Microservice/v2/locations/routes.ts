/**
 * Here we're exposing under locations for the frontend but internally it actually means infrastructure
 */

import express, { Request, Response } from 'express'
import { validateLocationsV2Middleware } from './validation.middleware'
import { LocationsV2Controller } from './controller'

const router = express.Router()
const controller = new LocationsV2Controller()

router.post('',
  validateLocationsV2Middleware,
  // this is not to loose the controller instance context inside the create method
  (req: Request, res: Response) => controller.create(req, res)
)

router.get(
    '',
    (req: Request, res: Response) => controller.getLocations(req, res)
);

router.get(
    '/locationsList',
    (req: Request, res: Response) => controller.getLocationsList(req, res)
);

router.put('',
    validateLocationsV2Middleware,
    (req: Request, res: Response) => controller.update(req, res)
)

router.delete('',
    (req: Request, res: Response) => controller.delete(req, res)
)

export default router
