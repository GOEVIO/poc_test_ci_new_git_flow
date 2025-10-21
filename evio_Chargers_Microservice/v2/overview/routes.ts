import express from 'express'

import { getOverview } from './controller'

const router = express.Router()

router.get('', getOverview)

export default router