import { Router } from 'express'

import salesTariffs from './routes/salesTariff.routes'

const router = Router()

router.use('/salesTariff', salesTariffs)

export { router as v2Router };
