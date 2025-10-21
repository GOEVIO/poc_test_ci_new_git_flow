import { Router } from 'express';
// Routes
import chargerModels from './chargerModels';
import chargers from './chargers';
import chargersEvio from './chargersEvio';
import chargersMonitoring from './chargersMonitoring';
import chargerTypes from './chargerTypes';
import chargingSchedule from './chargingSchedule';
import chargingSession from './chargingSession';
import chargingSessionMonitoring from './chargingSessionMonitoring';
import commissionClient from './comissionClient';
import commissionEVIO from './comissionEVIO';
import concurrentManufacturers from './concurrentManufacturers';
import controlCenter from './controlCenter';
import controllers from './controllers';
import heartBeat from './heartBeat';
import hostIssues from './hostIssues';
import infrastructure from './infrastructure';
import locations from './locations';
import managementPOIs from './managementPOIs';
import notifyMeHistory from './notifymeHistory';
import operator from './operator';
import qrCode from './qrCode';
import switchboards from './switchboards';
import translationKeyes from './translationKeyes';
import location from './location'
import switchboard from './switchboard'
import solarPV from './solarPV'
import publicGridRoute from './publicGridRoute';

const router: Router = Router();
router.use(chargerModels);
router.use(chargingSession);
router.use(chargers);
router.use(chargersMonitoring);
router.use(chargersEvio);
router.use(chargerTypes);
router.use(chargingSchedule);
router.use(chargingSessionMonitoring);
router.use(commissionClient);
router.use(commissionEVIO);
router.use(concurrentManufacturers);
router.use(controlCenter);
router.use(controllers);
router.use(heartBeat);
router.use(hostIssues);
router.use(infrastructure);
router.use(locations);
router.use(location);
router.use(managementPOIs);
router.use(notifyMeHistory);
router.use(operator);
router.use(qrCode);
router.use(switchboards);
router.use(switchboard);
router.use(translationKeyes);
router.use(solarPV);
router.use(publicGridRoute);

export default router;
