import axios from "axios";
import { captureException } from '@sentry/node';
import { ISendMailParams } from "../interfaces/utils/notifications.interface";
import Constants from './constants';


const sendEmail = async ({ mailOptions, clientName }: ISendMailParams): Promise<boolean> => {
    try {
        console.log(`[sendEmail][Start] mailOptions: ${JSON.stringify({ mailOptions, clientName })}`);
        
        const serviceUrl = `${Constants.services.notifications}/api/private/sendEmail`;
        const headers = { clientname: clientName };
        await axios.post(serviceUrl, { mailOptions }, { headers });
        return true;
    } catch (error) {
        console.error(`[sendEmail][Error] ${JSON.stringify(error)}`);
        captureException(error);
        return false;
    }
}

export {
    sendEmail
};