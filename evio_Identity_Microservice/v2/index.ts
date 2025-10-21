import { Router } from 'express'

import groupCSUsers from './routes/groupCSUsers.routes'

const router = Router()

router.use('/groupCSUsers', groupCSUsers)

export { router as v2Router };
