import { Router } from 'express'

import chargers from './chargers/routes'
import locations from './locations/routes'
import chargerModels from './chargerModels/routes'
import chargerTests from './chargerTests/routes'
import overview from './overview/routes'
import assetType from './assetType/routes'
import facilitiesType from './facilitiesType/routes'
import parkingType from './parkingType/routes'
import costTariffs from './costTariffs/routes'
import switchBoards from './switchboards/routes'
import chargerImages from './chargerImages/chargerImages.routes';
import chargingSessionsRouter  from './chargingSessions/chargingSessions.routes';
import tariffs from './tariffs/tariffs.routes';
import alarmsRouter from './alarms/routes/alarms.routes';

const router = Router()

router.use('/', chargers)
router.use('/locations', locations)
router.use('/models', chargerModels)
router.use('/overview', overview)
router.use('/chargerTests', chargerTests )
router.use('/assetType', assetType)
router.use('/facilitiesType', facilitiesType)
router.use('/parkingType', parkingType)
router.use('/costTariffs', costTariffs)
router.use('/switchboards', switchBoards)
router.use('/chargerImages', chargerImages);
router.use('/chargingSessions', chargingSessionsRouter);
router.use('/tariffs', tariffs);
router.use('/alarms', alarmsRouter);

export default router
