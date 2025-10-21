const AxiosHandler = require('../services/axios');
import { ISendMailOptions } from "../interfaces/utils/sendEmailOptions.interface";
import Constants from './constants';

const sendNotificationEmail = async (mailOptions: ISendMailOptions, clientName: string) => {
    try {
        const url = `${Constants.services.notifications}/api/private/sendEmail`;
        const headers = { clientname: clientName };
        await AxiosHandler.axiosPostBodyHeadersEmail(url, mailOptions ,  headers );
    } catch (error) {
        console.error('Error sending email: ', error);
        throw error;
    }
};

export {
    sendNotificationEmail
};