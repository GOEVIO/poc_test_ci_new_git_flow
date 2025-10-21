import { Router } from 'express';
import { createAlarms, updateAlarm, getAllAlarms, updateMultipleAlarmsStatus } from '../controllers/alarms.controller';
import { validateAlarmMiddleware, validateAlarmUpdateMiddleware, validateBulkAlarmUpdateMiddleware } from '../middlewares/validation.middleware';
import { parseGetAlarmsFiltersAndSort } from '../helpers/filters.helper';

const router = Router();

router.post('', validateAlarmMiddleware, createAlarms);
router.get('', parseGetAlarmsFiltersAndSort, getAllAlarms);
router.patch('/bulk-update-status', validateBulkAlarmUpdateMiddleware, updateMultipleAlarmsStatus);
router.patch('/:id', validateAlarmUpdateMiddleware, updateAlarm);

export default router;
