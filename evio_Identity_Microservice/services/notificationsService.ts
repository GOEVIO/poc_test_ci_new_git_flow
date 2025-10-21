import axios from "axios";
import Constants from '../utils/constants';
import {
    IPhoneNumberActivation,
    IPhoneNumberUpdate,
    IUserEmailToSendCode,
    TEmailType
} from "../interfaces/users.interface";
import * as Sentry from '@sentry/node';

/**
 * Send SMS to user with the code to change the phone number
 * @param userData
 * @param code
 * @param client
 * @param appVersion
 */
export const sendChangeNumberSMS = async(userData: IPhoneNumberUpdate, code: string, client: string, appVersion: string, clientName: string | null): Promise<void> =>{
    const context = "sendChangeNumberSMS";

    try {
        const host = `${Constants.services.notification.host}${Constants.services.notification.pathNotificationsChangeNumber}`;
        const params = {
            user: userData,
            message: code,
            headers: {
                client,
                evioappversion: appVersion,
                clientname: clientName,
            },
        };

        const result = await axios.post(host, params);

        console.log(`[${context}] Received response ${result?.data} and status ${result?.status} from notifications service`)

        if(!result?.data){
            console.error(`[${context}] Error: 'Failed to send SMS!'`);
            throw new Error('Failed to send SMS');
        }

        console.log(`[${context}] SMS sent successfully to user: ${userData._id} with response from notifications service: ${result?.data}`);
        return;
    } catch (error) {
        Sentry.captureException(error);
        console.error(`[${context}] Error: ${error?.message}`);
        throw new Error('Failed to send SMS');
    }

}

/**
 * Send SMS to user with the code to activate account via phone number
 * @param userData
 * @param code
 * @param client (mobile platform)
 */
export const sendActivationSMS = async(
    userData: IPhoneNumberActivation, code: string, client: string, clientName: string | null
): Promise<void> => {
    const context = "sendActivationSMS";

    try {
        console.log(`[${context}] Sending SMS to user: ${userData._id} with code: ${code}`);

        const host = `${Constants.services.notification.host}${Constants.services.notification.pathNotificationsActivation}`;
        const params = {
            user: userData,
            message: code,
            headers: {
                client,
                clientname: userData.clientName,
            },
        };

        const result = await axios.post(host, params);

        console.log(`[${context}] Received response ${result?.data} and status ${result?.status} from notifications service`);

        if(!result?.data){
            console.error(`[${context}] Error: 'Failed to send SMS!'`);
            throw new Error('Failed to send SMS');
        }

        console.log(`[${context}] SMS sent successfully to user: ${userData._id} with response from notifications service: ${result?.data}`);
        return;
    } catch (error) {
        Sentry.captureException(error);
        console.error(`[${context}] Error: ${error?.message}`);
        throw new Error('Failed to send SMS');
    }

}


/**
 * Send email to user with the code to activate account via email
 * @param code
 * @param userData
 * @param client
 */
export const sendEmail = async(
    userData: IUserEmailToSendCode,
    code: string
): Promise<void> => {
    const context = "sendEmail";

    try {
        console.log(`[${context}] Sending email to user: ${userData._id} with code: ${code}`);

        const mailOptions = {
          to: userData.email,
          type: userData.type,
          message: {
              username: userData.userName,
              passwordCode: code,
          }
        };

        const headers = {
            clientname: userData.clientName,
        };

        const host = `${Constants.services.notification.host}${Constants.services.notification.pathNotificationsSendEmail}`;

        const result = await axios.post(host, { mailOptions }, { headers });

        console.log(`[${context}] Received response ${result?.data} and status ${result?.status} from notifications service`);

        if(!result?.data){
            console.error(`[${context}] Error: 'Failed to send email!'`);
            throw new Error('Failed to send email');
        }

        console.log(`[${context}] Email sent successfully to user: ${userData._id} with response from notifications service: ${result?.data}`);
        return;
    } catch (error) {
        Sentry.captureException(error);
        console.error(`[${context}] Error: ${error?.message}`);

        throw new Error('Failed to send email');
    }

}

export default {
    sendChangeNumberSMS,
    sendActivationSMS,
    sendEmail,
}