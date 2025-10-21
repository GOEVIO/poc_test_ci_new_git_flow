import axios from 'axios';
import { IGroupCSUserUser } from '../interfaces/groupCSUsers.interface';
import Constants from '../../utils/constants'
import { ISMSNotificationParams } from "../interfaces/smsNotificationParams.interface";

export async function sendSMSNotification(
    value: Partial<IGroupCSUserUser>[],
    groupName: string,
    clientName: string | null
): Promise<void> {
    const context = 'Function sendSMSNotification';

    if (!value || value.length === 0) {
        console.log(`[${context}] There are no unregistered users`);
        return;
    }

    const params: ISMSNotificationParams = {
        value,
        groupName,
        clientName,
    };

    const host =
        Constants.services.notification.host + Constants.services.notification.pathGroupCSUsers;

    try {
        const response = await axios.post(host, params);
        console.log(`[${context}] SMS Send`, response.data);
    } catch (error: any) {
        console.error(`[${context}][axios.post] Error`, error.message);
    }
}
