import express from 'express';
const router = express.Router();
import Sentry from '@sentry/node';
import { SmsNotificationsService } from '../services/smsNotification.service';
import { StatusCodeHttp } from 'evio-library-commons';


router.post('/api/private/smsNotifications/activation', async (req, res, next) => {
    const context = "POST /api/private/smsNotifications/activation";
    try {
        const headers = req.body.headers;
        const clientName = headers.clientname; 

        const response = await SmsNotificationsService.sendSmsActivation(req.body, clientName);
        return res.send(response);
    } catch (error: any) {
        if(typeof error === 'boolean'){
            return res.send(error);
        }
        console.error(`[${context}] Error: ${typeof error === 'object' ? JSON.stringify(error) : error}`);
        
        if((error?.status || error?.statusCode) === StatusCodeHttp.INTERNAL_SERVER_ERROR) { Sentry.captureException(error); }
        return res.status(error.status || error.statusCode || StatusCodeHttp.INTERNAL_SERVER_ERROR).send({
            auth: error?.auth ?? error?.error?.auth ?? false,
            code: error?.code ?? error?.error?.code ?? 'server_error',
            message: error?.message ?? error?.error?.message ?? 'Server error'
        });
    }
    
});

router.post('/api/private/smsNotifications/changeNumber', async (req, res, next) => {
    const context = "POST /api/private/smsNotifications/changeNumber";
    try {
        const headers = req.body.headers;
        const clientName = headers.clientname; 
        
        const response = await SmsNotificationsService.sendSmsChangeNumber(req.body, clientName);
        return res.send(response);
    } catch (error: any) {
        if(typeof error === 'boolean'){
            return res.send(error);
        }
        console.error(`[${context}] Error: ${typeof error === 'object' ? JSON.stringify(error) : error}`);
        
        if((error?.status || error?.statusCode) === StatusCodeHttp.INTERNAL_SERVER_ERROR) { Sentry.captureException(error); }
        return res.status(error.status || error.statusCode || StatusCodeHttp.INTERNAL_SERVER_ERROR).send({
            auth: error?.auth ?? error?.error?.auth ?? false,
            code: error?.code ?? error?.error?.code ?? 'server_error',
            message: error?.message ?? error?.error?.message ?? 'Server error'
        });
    }
});

router.post('/api/private/smsNotifications/recoverPassword', async (req, res, next) => {
    const context = "POST /api/private/smsNotifications/recoverPassword";
    try {
        const headers = req.body.headers;
        const clientName = headers.clientname; 

        const response = await SmsNotificationsService.sendSmsRecoverPassword(req.body, clientName);
        return res.send(response);
    } catch (error: any) {
        if(typeof error === 'boolean'){
            return res.send(error);
        }
        console.error(`[${context}] Error: ${typeof error === 'object' ? JSON.stringify(error) : error}`);
        
        if((error?.status || error?.statusCode) === StatusCodeHttp.INTERNAL_SERVER_ERROR) { Sentry.captureException(error); }
        return res.status(error.status || error.statusCode || StatusCodeHttp.INTERNAL_SERVER_ERROR).send({
            auth: error?.auth ?? error?.error?.auth ?? false,
            code: error?.code ?? error?.error?.code ?? 'server_error',
            message: error?.message ?? error?.error?.message ?? 'Server error'
        });
    }
});

router.post('/api/private/smsNotifications/changePassword', async (req, res, next) => {
    const context = "POST /api/private/smsNotifications/changePassword";
    try {
        const headers = req.body.headers;
        const clientName = headers.clientname; 

        const response = await SmsNotificationsService.sendSmsChangePassword(req.body, clientName);
        return res.send(response);
    } catch (error: any) {
        if(typeof error === 'boolean'){
            return res.send(error);
        }
        console.error(`[${context}] Error: ${typeof error === 'object' ? JSON.stringify(error) : error}`);
        
        if((error?.status || error?.statusCode) === StatusCodeHttp.INTERNAL_SERVER_ERROR) { Sentry.captureException(error); }
        return res.status(error.status || error.statusCode || StatusCodeHttp.INTERNAL_SERVER_ERROR).send({
            auth: error?.auth ?? error?.error?.auth ?? false,
            code: error?.code ?? error?.error?.code ?? 'server_error',
            message: error?.message ?? error?.error?.message ?? 'Server error'
        });
    }
});


router.post('/api/private/smsNotifications/drivers', async (req, res, next) => {
    const context = "/api/private/smsNotifications/drivers";
    try {
        const response = await SmsNotificationsService.sendDriverInvites(req.body);
        return res.send(response);
    } catch (error: any) {
        if(typeof error === 'boolean'){
            return res.send(error);
        }
        console.error(`[${context}] Error: ${typeof error === 'object' ? JSON.stringify(error) : error}`);
        
        if((error?.status || error?.statusCode) === StatusCodeHttp.INTERNAL_SERVER_ERROR) { Sentry.captureException(error); }
        return res.status(error.status || error.statusCode || StatusCodeHttp.INTERNAL_SERVER_ERROR).send({
            auth: error?.auth ?? error?.error?.auth ?? false,
            code: error?.code ?? error?.error?.code ?? 'server_error',
            message: error?.message ?? error?.error?.message ?? 'Server error'
        });
    }
});

router.post('/api/private/smsNotifications/MBReferenceSMS', async (req, res, next) => {
    const context = "/api/private/smsNotifications/MBReferenceSMS";
    try {
        const { clientname } = req.headers;

        const response = await SmsNotificationsService.sendSmsMBReferenceSMS(req.body, clientname as string);
        return res.send(response);
    } catch (error: any) {
        if(typeof error === 'boolean'){
            return res.send(error);
        }
        console.error(`[${context}] Error: ${typeof error === 'object' ? JSON.stringify(error) : error}`);
        
        if((error?.status || error?.statusCode) === StatusCodeHttp.INTERNAL_SERVER_ERROR) { Sentry.captureException(error); }
        return res.status(error.status || error.statusCode || StatusCodeHttp.INTERNAL_SERVER_ERROR).send({
            auth: error?.auth ?? error?.error?.auth ?? false,
            code: error?.code ?? error?.error?.code ?? 'server_error',
            message: error?.message ?? error?.error?.message ?? 'Server error'
        });
    }

});

router.post('/api/public/smsNotifications/sendSMS', async (req, res, next) => {
    const context = "/api/public/smsNotifications/sendSMS";
    try {
        const response = await SmsNotificationsService.sendSMS(req.body);
        return res.status(200).send(response);
    } catch (error: any) {
        if(typeof error === 'boolean'){
            return res.send(error);
        }
        console.error(`[${context}] Error: ${typeof error === 'object' ? JSON.stringify(error) : error}`);
        
        if((error?.status || error?.statusCode) === StatusCodeHttp.INTERNAL_SERVER_ERROR) { Sentry.captureException(error); }
        return res.status(error.status || error.statusCode || StatusCodeHttp.INTERNAL_SERVER_ERROR).send({
            auth: error?.auth ?? error?.error?.auth ?? false,
            code: error?.code ?? error?.error?.code ?? 'server_error',
            message: error?.message ?? error?.error?.message ?? 'Server error'
        });
    }

});

router.post('/api/private/smsNotifications/groupCSUsers', async (req, res, next) => {
    const context = "/api/private/smsNotifications/groupCSUsers";
    try {
        const response = await SmsNotificationsService.groupCSUsers(req.body);
        return res.status(response.status).send(response.body);
    } catch (error: any) {
        if(typeof error === 'boolean'){
            return res.send(error);
        }
        console.error(`[${context}] Error: ${typeof error === 'object' ? JSON.stringify(error) : error}`);
        
        if((error?.status || error?.statusCode) === StatusCodeHttp.INTERNAL_SERVER_ERROR) { Sentry.captureException(error); }
        return res.status(error.status || error.statusCode || StatusCodeHttp.INTERNAL_SERVER_ERROR).send({
            auth: error?.auth ?? error?.error?.auth ?? false,
            code: error?.code ?? error?.error?.code ?? 'server_error',
            message: error?.message ?? error?.error?.message ?? 'Server error'
        });
    }
  
});

router.post('/api/private/smsNotifications/groupDrivers', async (req, res, next) => {
    const context = "/api/private/smsNotifications/groupDrivers";
    try {
        const response = await SmsNotificationsService.groupDrivers(req.body);
        return res.status(response.status).send(response.body);
    } catch (error: any) {
        if(typeof error === 'boolean'){
            return res.send(error);
        }
        console.error(`[${context}] Error: ${typeof error === 'object' ? JSON.stringify(error) : error}`);
        
        if((error?.status || error?.statusCode) === StatusCodeHttp.INTERNAL_SERVER_ERROR) { Sentry.captureException(error); }
        return res.status(error.status || error.statusCode || StatusCodeHttp.INTERNAL_SERVER_ERROR).send({
            auth: error?.auth ?? error?.error?.auth ?? false,
            code: error?.code ?? error?.error?.code ?? 'server_error',
            message: error?.message ?? error?.error?.message ?? 'Server error'
        });
    }
});

export default router;


