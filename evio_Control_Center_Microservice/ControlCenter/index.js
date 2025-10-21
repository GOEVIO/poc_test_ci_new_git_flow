const express = require('express');
const router = express.Router({ mergeParams: true });
var usersManagement = require('./users/usersManagement');
var activation = require('./users/activation');
var recoverPassword = require('./users/recoverPassword');
var userClientsManagement = require('./userClients/userClientsManagement');
var authentication = require('./users/authentication');
let cpoManagement = require('./cpos/management');
let cpoTariffs = require('./cpos/tariffs');
let cpoTechnical = require('./cpos/technical');
let cpoLogs = require('./cpos/logs');
let cpoReports = require('./cpos/reports');
var chargersManagement = require('./chargers/chargersManagement');
let chargersManagementAssistance = require('./chargers/assistance')
let chargersManagementMaintenance = require('./chargers/maintenance')
let chargersManagementAlarms = require('./chargers/alarms')
let chargersManagementUsage = require('./chargers/usage')
let chargersManagementSystemLog = require('./chargers/systemLog')
const cemeTarrifs = require('./tariffs/cemeTarrifs')

//endpoint to create user
router.post('/users', (req, res) => {
    usersManagement.create(req, res);
});

//endpoint to delete user
router.delete('/users', (req, res) => {
    usersManagement.delete(req, res);
});

//endpoint to update user
router.patch('/users', (req, res) => {
    usersManagement.update(req, res);
});

//endpoint to get ceme tariffs
router.get('/users/cemeTariff', cemeTarrifs.get);

//endpoint to get owner ids
router.get('/ownerIds', (req, res) => {
    usersManagement.getOwnerIds(req, res);
});

//endpoint to create recoverPassword
router.post('/recoverPassword', (req, res) => {
    recoverPassword.create(req, res);
});

//endpoint to get get tin classification
router.get('/userClients/tin-classification', userClientsManagement.getTINClassification);

//endpoint to update recoverPassword
router.put('/recoverPassword', (req, res) => {
    recoverPassword.update(req, res);
});

//endpoint to create user clients
router.post('/userClients', (req, res) => {
    userClientsManagement.create(req, res);
});

//endpoint to get user clients
router.get('/userClients', (req, res) => {
    userClientsManagement.get(req, res);
});

//endpoint to get user clients
router.delete('/userClients', (req, res) => {
    userClientsManagement.delete(req, res);
});

//endpoint to get update user clients
router.patch('/userClients', (req, res) => {
    userClientsManagement.updateUser(req, res);
});

//endpoint to update user clients billingProfile
router.patch('/userClientsBillingProfile', (req, res) => {
    userClientsManagement.updateUserBillingProfile(req, res);
});

//endpoint to block user cleints 
router.patch('/userClientsBlock', (req, res) => {
    userClientsManagement.blockUser(req, res);
});

//endpoint to unlock user clients
router.patch('/userClientsUnlock', (req, res) => {
    userClientsManagement.unlockUser(req, res);
});

//endpoint to do login in control center
router.post('/login', (req, res) => {
    authentication.login(req, res);
});

//endpoint to do login in control center
router.post('/logout', (req, res) => {
    authentication.logout(req, res);
});

//endpoint to create cpo, used for mobie and roaming integrations
router.post('/cpo', (req, res) => {
    cpoManagement.cpo.create(req, res);
});

//endpoint to get specific infrastructure
router.get('/charger/details', (req, res) => {
    chargersManagement.getDetails(req, res);
});

//endpoint to get charger tariffs by network
router.get('/charger/tariffs', (req, res) => {
    chargersManagement.getNetworkChargerTariffs(req, res);
});

//endpoint to get infrastructures
router.get('/allInfrastructures', (req, res) => {
    chargersManagement.get(req, res);
});

//endpoint to create infrastructure
router.post('/infrastructure', (req, res) => {
    chargersManagement.createInfrastructure(req, res);
});

//endpoint to get specific infrastructure
router.get('/infrastructure', (req, res) => {
    chargersManagement.getInfrastructure(req, res);
});

//endpoint to update specific infrastructure
router.patch('/infrastructure', (req, res) => {
    chargersManagement.updateInfrastructure(req, res);
});

//endpoint to delete specific infrastructure
router.delete('/infrastructure', (req, res) => {
    chargersManagement.deleteInfrastructure(req, res);
});

//endpoint to create charger
router.post('/charger', (req, res) => {
    chargersManagement.create(req, res);
});

//endpoint to update charger
router.patch('/charger', (req, res) => {
    chargersManagement.update(req, res);
});

router.patch('/charger/plugs', (req, res) => {
    chargersManagement.updatePlugs(req, res);
});

router.delete('/charger', (req, res) => {
    chargersManagement.delete(req, res);
});

//endpoint to create charger
router.patch('/charger/network', (req, res) => {
    chargersManagement.networkActivation(req, res);
});

//endpoint to create charger
router.get('/chargerNetworks', (req, res) => {
    chargersManagement.getNetworks(req, res);
});

//endpoint to create charger
router.put('/charger/toOcpi', (req, res) => {
    chargersManagement.toOcpi(req, res);
});

//endpoint to get charger plugs
router.get('/charger/plugs', (req, res) => {
    chargersManagement.getPlugs(req, res);
});


//////////////////////////////////////////////////////////// 
////////////////////    ASSISTANCE    //////////////////////
////////////////////////////////////////////////////////////


//endpoint to send reset charger
router.post('/charger/assistance/reset', (req, res) => {
    chargersManagementAssistance.reset.send(req, res);
});

//endpoint to get diagnostics
router.post('/charger/assistance/diagnostics', (req, res) => {
    chargersManagementAssistance.diagnostics.send(req, res);
});

//endpoint to clear cache
router.post('/charger/assistance/cache', (req, res) => {
    chargersManagementAssistance.cache.send(req, res);
});

//endpoint to unlock connector
router.post('/charger/assistance/unlock', (req, res) => {
    chargersManagementAssistance.unlock.send(req, res);
});

router.route('/charger/assistance/firmware')
//endpoint to update firmware
.post( (req, res) => {
    chargersManagementAssistance.firmware.update(req, res);
});


//endpoint to change availability
router.post('/charger/assistance/availability', (req, res) => {
    chargersManagementAssistance.availability.send(req, res);
});

//endpoint to remote start
router.post('/charger/assistance/start', (req, res) => {
    chargersManagementAssistance.start.send(req, res);
});

//endpoint to remote stop
router.post('/charger/assistance/stop', (req, res) => {
    chargersManagementAssistance.stop.send(req, res);
});

//endpoint to activate account by email
router.patch('/accountActivation/email', (req, res) => {
    activation.accountActivationEmail(req, res);
});

//endpoint to get whitelist
router.get('/charger/assistance/whitelist', (req, res) => {
    chargersManagementAssistance.whitelist.get(req, res);
});

//endpoint to get whitelist
router.get('/charger/assistance/configurationKeys', (req, res) => {
    chargersManagementAssistance.configurationKeys.getKeys(req, res);
});

//endpoint to get whitelist
router.get('/charger/assistance/configurationKeys/lists', (req, res) => {
    chargersManagementAssistance.configurationKeys.getLists(req, res);
});

//endpoint to get whitelist
router.patch('/charger/assistance/configurationKeys', (req, res) => {
    chargersManagementAssistance.configurationKeys.updateKeys(req, res);
});

//////////////////////////////////////////////////////////// 
///////////////////    MAINTENANCE    //////////////////////
////////////////////////////////////////////////////////////

//endpoint to upload file
router.post('/charger/maintenance/upload', (req, res) => {
    chargersManagementMaintenance.files.upload(req, res);
});

//endpoint to update file
router.put('/charger/maintenance/update', (req, res) => {
    chargersManagementMaintenance.files.update(req, res);
});

//endpoint to remove file
router.patch('/charger/maintenance/remove', (req, res) => {
    chargersManagementMaintenance.files.remove(req, res);
});

//////////////////////////////////////////////////////////// 
/////////////////////    ALARMS    /////////////////////////
////////////////////////////////////////////////////////////

//endpoint to get alarm logs
router.get('/charger/alarms/logs', (req, res) => {
    chargersManagementAlarms.logs.get(req, res);
});

//////////////////////////////////////////////////////////// 
//////////////////////    USAGE    /////////////////////////
////////////////////////////////////////////////////////////

//endpoint to get alarm logs
router.get('/charger/usage/chargingSessions', (req, res) => {
    chargersManagementUsage.chargingSessions.get(req, res);
});

//////////////////////////////////////////////////////////// 
////////////////////    SYSTEM LOG    //////////////////////
////////////////////////////////////////////////////////////

//endpoint to get alarm logs
router.get('/charger/systemLog/logs', (req, res) => {
    chargersManagementSystemLog.logs.get(req, res);
});

router.get('/charger/systemLog/filters', (req, res) => {
    chargersManagementSystemLog.logs.filters(req, res);
});


//////////////////////////////////////////////////////////// 
//////////////////    TARIFFS MODULE   /////////////////////
////////////////////////////////////////////////////////////

//endpoint to create cpo tariffs
router.post('/cpo/tariff', (req, res) => {
    cpoTariffs.tariff.create(req, res);
});

//endpoint to get cpo tariffs
router.get('/cpo/tariff', (req, res) => {
    cpoTariffs.tariff.read(req, res);
});

//endpoint to update cpo tariffs 
router.patch('/cpo/tariff', (req, res) => {
    cpoTariffs.tariff.update(req, res);
});

//endpoint to delete cpo tariffs
router.delete('/cpo/tariff', (req, res) => {
    cpoTariffs.tariff.delete(req, res);
});

//endpoint to send cpo tariffs to ocpi
router.put('/cpo/tariff/toOcpi', (req, res) => {
    cpoTariffs.tariff.toOcpi(req, res);
});

//endpoint to get chargers to apply tariffs
router.get('/cpo/tariff/apply', (req, res) => {
    cpoTariffs.tariff.getApply(req, res);
});

//endpoint apply tariffs to chargers
router.patch('/cpo/tariff/apply', (req, res) => {
    cpoTariffs.tariff.apply(req, res);
});

//////////////////////////////////////////////////////////// 
//////////   OCPI TECHINCAL MANAGEMENT MODULE   ////////////
////////////////////////////////////////////////////////////

//endpoint get platform info
router.get('/cpo/technical/info', (req, res) => {
    cpoTechnical.info.get(req, res);
});

//endpoint update credentials endpoint
router.patch('/cpo/technical/credentials/endpoint', (req, res) => {
    cpoTechnical.assistance.updateEndpoint(req, res);
});

//endpoint update credentials
router.patch('/cpo/technical/credentials', (req, res) => {
    cpoTechnical.assistance.updateCredentials(req, res);
});

//endpoint update credentials
router.delete('/cpo/technical/credentials', (req, res) => {
    cpoTechnical.assistance.deleteCredentials(req, res);
});


//////////////////////////////////////////////////////////// 
//////////////////   OCPI LOGS MODULE   ////////////////////
////////////////////////////////////////////////////////////

//endpoint get ocpi logs
router.get('/cpo/logs', (req, res) => {
    cpoLogs.log.get(req, res);
});


//////////////////////////////////////////////////////////// 
////////////////   OCPI REPORTS MODULE   ///////////////////
////////////////////////////////////////////////////////////

//endpoint get reports
router.get('/cpo/reports', (req, res) => {
    cpoReports.report.get(req, res);
});

//endpoint get cdrs from ocpi
router.post('/cpo/reports/ocpi', (req, res) => {
    cpoReports.report.fromOcpi(req, res);
});

router.get('/cpo/reports/email', (req, res) => {
    cpoReports.report.sendEmail(req, res);
});

router.get('/cpo/reports/email/startJob', (req, res) => {
    cpoReports.report.cemeReportJobStart(req, res);
});

router.get('/cpo/reports/email/stopJob', (req, res) => {
    cpoReports.report.cemeReportJobStop(req, res);
});

router.get('/cpo/reports/email/statusJob', (req, res) => {
    cpoReports.report.cemeReportJobStatus(req, res);
});

router.get('/cpo/reports/chargers', (req, res) => {
    cpoReports.report.getChargersReport(req, res);
});

router.get('/cpo/reports/chargers/jobStart', (req, res) => {
    cpoReports.report.chargersReportJobStart(req, res);
});

router.get('/cpo/reports/chargers/jobStop', (req, res) => {
    cpoReports.report.chargersReportJobStop(req, res);
});

router.get('/cpo/reports/chargers/jobStatus', (req, res) => {
    cpoReports.report.chargersReportJobStatus(req, res);
});

router.post('/cpo/reports/sftp/forceJobProcess/day', (req, res) => {
    cpoReports.report.sftpCdrsForceJobDay(req, res);
});

router.post('/cpo/reports/sftp/forceJobProcess/month', (req, res) => {
    cpoReports.report.sftpCdrsForceJobMonth(req, res);
});

router.post('/cpo/reports/sftp/forceJobProcess/year', (req, res) => {
    cpoReports.report.sftpCdrsForceJobYear(req, res);
});

router.patch('/cpo/reports/sftp/platformCredentials', (req, res) => {
    cpoReports.report.updatePlatform(req, res);
});


module.exports = router;