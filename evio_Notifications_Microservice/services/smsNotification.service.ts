import libraryNotifications from 'evio-library-notifications';
import libraryLanguage from 'evio-library-language';
import libraryIdentity from 'evio-library-identity';
import axios from "axios";
import { IUser } from '../interfaces/sms.notifications';
import Constants from '../utils/constants';
import { ObjectId } from 'mongodb';


const { TWILIO } = libraryNotifications;
const { FileTransaction } = libraryLanguage;
const { findUsers } = libraryIdentity;

export class SmsNotificationsService {

    static async retriveUserLanguage (user: any, clientname: string){
        const context = '[Function retriveUserLanguage]';
        const userFound: any = await findUsers({mobile: user.mobile, internationalPrefix: user.internationalPrefix, clientName: clientname, status: Constants.REGISTERED}, ['language']);
        return userFound.length > 0 ? userFound[0].language : userFound.language
    }

    static async composeBody(language: string, code: string, data: any){
        const context = '[Function composeBody]';
        const messageFinal = (await FileTransaction.retrieveMessageTranslation({language}, code))
        .replace('<CODE>', data?.code)
        .replace('<NAME>', data?.name)
        .replace('<AndroidAppLink>', Constants.AndroidAppLink)
        .replace('<iOSAPPLink>', Constants.iOSAPPLink)
        .replace('<ENTITY>', data?.entity)
        .replace('<REFERENCE>', data?.reference)
        .replace('<AMOUNT>', data?.amount)
        .replace('<groupName>', data?.groupName)
        .replace('<RESULTCODE>', data?.resultCode);

        console.log(`${context} messageFinal: ${messageFinal}`);
        return messageFinal;
    }

    static async setMessage (headers: any, user: any, code: string, mobile: string, messageFinal: string, action: string, language: string){
        switch (headers.client) {
            case process.env.ClientIOS: 
                return await TWILIO.sendSMSWithResponseCallback(mobile, messageFinal, user.internationalPrefix);    
            case process.env.ClientAndroid:
                return await this.SMSAndroid(mobile, code, headers, user.internationalPrefix, action, language);    
            default:       
                return await TWILIO.sendSMSWithResponseCallback(mobile, messageFinal, user.internationalPrefix);;
        }
    }

    static async sendSmsActivation(body: any, clientName: string){
        const context = '[Function sendSmsActivation]';
        try {
            const {user, message, headers} = body;            
            TWILIO.setTwilioClientIfNeeded(clientName);
            const mobile = user.internationalPrefix + user.mobile;
            const language = await this.retriveUserLanguage(user, clientName);

            const finalBody = await this.composeBody(language, 'sms_activation_ios', {code: message});
            return await this.setMessage(headers, user, message, mobile, finalBody, "activation", language);
        } catch (error) {
            throw error;
        }       
    }

    static async sendSmsChangeNumber(body: any, clientName: string){
        const context = '[Function sendSmsChangeNumber]';
        try {
            const {user, message, headers} = body;       
            TWILIO.setTwilioClientIfNeeded(clientName);
            const mobile = user.internationalPrefix + user.mobile;
            const language = await this.retriveUserLanguage(user, clientName);

            const finalBody = await this.composeBody(language, 'sms_changeNumber_ios', {code: message});
            return await this.setMessage(headers, user, message, mobile, finalBody, "changeNumber", language);
        } catch (error) {
            throw error;
        }  
    }

    static async sendSmsRecoverPassword(body: any, clientName: string){
        const context = '[Function sendSmsRecoverPassword]';
        try {
            const {user, message, headers} = body;            
            TWILIO.setTwilioClientIfNeeded(clientName);
            const mobile = user.internationalPrefix + user.mobile;
            const language = await this.retriveUserLanguage(user, clientName);

            const finalBody = await this.composeBody(language, 'sms_recoverPassword_ios', {code: message});
            return await this.setMessage(headers, user, message, mobile, finalBody, "recoverPassword", language);
        } catch (error) {
            throw error;
        }  
    }

    static async sendSmsChangePassword(body: any, clientName: string){
        const context = '[Function sendSmsChangePassword]';
        try {
            const {user, message, headers} = body;            
            TWILIO.setTwilioClientIfNeeded(clientName);
            const mobile = user.internationalPrefix + user.mobile;
            const language = await this.retriveUserLanguage(user, clientName);

            const finalBody = await this.composeBody(language, 'sms_changePassword_ios', {code: message});
            console.log(`${context} messageFinal: ${finalBody}`);
            return await this.setMessage(headers, user, message, mobile, finalBody, "changePassword", language);
        } catch (error) {
            throw error;
        }  
    }

    static async sendDriverInvites (body: any) {
        const context = '[Function sendDriverInvites]';
        try {
            const {values, name, clientName} = body;   
            console.log(`[${context}] Sending SMS to ${values.length} users, name: ${name}`);
            const users: IUser[] = values;         
            TWILIO.setTwilioClientIfNeeded(clientName);

            for await (const user of users) {
                const mobile: string = user.internationalPrefix + user.mobile;
                const language = await this.retriveUserLanguage(user, clientName);

                const finalBody = await this.composeBody(language, 'sms_addDrivers', {name});
                await TWILIO.sendSMSWithResponseCallback(mobile, finalBody, user.internationalPrefix);
            }

            console.log('Messages sent!');
            return 'Messages sent!';
        } catch (err: any) {
            console.log(`[${context}] Error `, err.message);
            console.trace(err);
            return err;
        }
    };

    static async sendSmsMBReferenceSMS(body: any, clientName: string){
        const context = '[Function sendSmsMBReferenceSMS]';
        try {
            let {internationalPrefix, mobile, MBReference} = body; 

            MBReference = MBReference.split('\n');
            let entity = MBReference[0].split(': ');
            let reference = MBReference[1].split(': ');
            let amount = MBReference[2].split(': ');

            console.log(`${context} entity: ${entity}, reference: ${reference}, amount: ${amount}`);

            TWILIO.setTwilioClientIfNeeded(clientName);

            const mobileFinal: string = internationalPrefix + mobile;
            const language = await this.retriveUserLanguage({mobile, internationalPrefix}, clientName);

            const finalBody = await this.composeBody(language, 'sms_mbReferenceSMS', {entity: entity[1], reference: reference[1], amount: amount[1]});
            return await TWILIO.sendSMSWithResponseCallback(mobileFinal, finalBody, internationalPrefix);
        } catch (error) {
            throw error;
        }  
    }

    static async sendSMS(data: any){
        const context = '[Function sendSMS]';
        try {
            const {user: users, message: body} = data;  
            console.log(`[${context}] Sending SMS to ${users.length} users`);
            for await (const user of users) {
                const mobile = user.internationalPrefix + user.mobile;
                await TWILIO.sendSMSWithResponseCallback(mobile, body, user.internationalPrefix);
            };
            return true;
        } catch (error) {
            console.log(`[${context}] Error `, error);
            throw error;
        }
    }

    static async groupCSUsers(data: any){
        const context = '[Function groupCSUsers]';
        const { value: users, groupName, clientName } = data;
      
        try {
            TWILIO.setTwilioClientIfNeeded(clientName);
            let successCount = 0;
            const errors: Error[] = [];

            for (const user of users) {
                try {
                  const mobile = `${user.internationalPrefix}${user.mobile}`;   
                  const language = await this.retriveUserLanguage(user, clientName);      

                  const finalBody = await this.composeBody(language, 'sms_groupCSUsers', {groupName});        
                  await TWILIO.sendSMSWithResponseCallback(mobile, finalBody, user.internationalPrefix);
                  successCount++;
                } catch (error: any) {
                  console.log(`[${context}] Error for user ${user.mobile}: `, error.message);
                  errors.push(error);
                }
            }

            if (errors.length > 0) {
                console.log(`[${context}] Completed with ${successCount} successes and ${errors.length} failures`);
                return {
                    status: 207, 
                    body:{
                        message: `${successCount} messages sent successfully, ${errors.length} failed`,
                        successes: successCount,
                        failures: errors.length,
                        errors: errors.map(e => e.message)
                    }
                };
             }
        
            console.log('All messages sent successfully!');
            return {
                status: 200,
                body: `${successCount} messages sent successfully`
            };

        } catch (error) {
            console.log(`[${context}] Error `, error);
            throw error;
        }
    }

    static async groupDrivers(data: any){
        const context = '[Function groupDrivers]';
        const { value: users, groupName, clientName } = data;
        try {
            // Initialize Twilio client
            TWILIO.setTwilioClientIfNeeded(clientName);

            // Process messages in parallel
            const results = await Promise.all(
                users.map(async (user: { internationalPrefix: string; mobile: any; }) => {
                    const mobile = `${user.internationalPrefix}${user.mobile}`;
                    
                    try {
                        const language = await this.retriveUserLanguage(user, clientName);
                        const finalBody = await this.composeBody(language, 'sms_groupDrivers', {groupName});
                        await TWILIO.sendSMSWithResponseCallback(mobile, finalBody, user.internationalPrefix);
                        return { success: true, mobile };
                    } catch (error) {
                        console.error(`[${context}] Error sending to ${mobile}:`, error.message);
                        return { success: false, mobile, error: error.message };
                    }
                })
            );

            // Calculate results
            const successful = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;

            if (failed > 0) {
                console.warn(`[${context}] ${successful} succeeded, ${failed} failed`);
                return {
                    status: 207,
                    body: {
                        success: false,
                        message: 'Some messages failed to send',
                        details: {
                            sent: successful,
                            failed: failed,
                            total: users.length
                        }
                    }
                };
            }

            console.log(`[${context}] All ${successful} messages sent successfully`);
            return {
                status: 200,
                body: {
                    success: true,
                    message: 'All messages sent successfully',
                    details: {
                        sent: successful,
                        failed: 0,
                        total: users.length
                    }
                }
            };
              

        } catch (error) {
            console.log(`[${context}] Error `, error);
            throw error;            
        }
    }

    static async SMSAndroid(
        mobile: string,
        code: string,
        headers: any,
        internationalPrefix: string,
        action: string,
        language: string
    ): Promise<boolean> {
        const context = "[Function SMSAndroid]";
        console.info(`${context} Starting process`);

        try {
            const query = {
                version: headers.evioappversion
            };

            let body: string = "";

            const appVersionsFound = await axios.get(Constants.appVersionsProxy, { params: query });

            if (appVersionsFound.data && appVersionsFound.data.length > 0) {
                const result = appVersionsFound.data[0];

                switch (action) {
                    case 'activation':
                        body = await this.composeBody(language, 'sms_activation_android', { code, resultCode: result.code });
                        break;
                    case 'recoverPassword':
                        body = await this.composeBody(language, 'sms_recoverPassword_android', { code, resultCode: result.code });
                        break;
                    case 'changeNumber':
                        body = await this.composeBody(language, 'sms_changeNumber_android', { code, resultCode: result.code });
                        break;
                    case 'changePassword':
                        body = await this.composeBody(language, 'sms_changePassword_android', { code, resultCode: result.code });
                        break;
                    default:
                        console.warn(`${context} Unknown action: ${action}`);
                        return false;
                }

                const smsResult = await TWILIO.sendSMSWithResponseCallback(mobile, body, internationalPrefix);
                return smsResult;
            }

            return false;
        } catch (error) {
            console.error(`${context} Error:`, error);
            return false;
        }
    }

}