import { captureException } from '@sentry/node';
import ChargerLibrary from 'evio-library-chargers';
import IdentityLibrary from 'evio-library-identity';
import constants from './constants';
import axios from 'axios';
import toggle from 'evio-toggle'

const returnOperator = (companyName?: string, contact?: string, email?: string) => {
    return {
        operator: companyName || '',
        operatorContact: contact || '',
        operatorEmail: email || '',
    };
}

export const getOperators = async (charger) => {
    const context = "Function getOperators";
    const isFeatureFlagEnable = await toggle.isEnable('charger-98')
    if (!isFeatureFlagEnable) {
        return await getOperatorsViaHttp(charger);
    }

    try {
        if (charger?.partyId) {
            const operator = await ChargerLibrary.operatorService.findOperator(charger.partyId)
            return returnOperator(operator?.companyName, operator?.contact, operator.email);
        };
        if (charger?.createUser) {
            const user = await IdentityLibrary.findUserById(charger?.createUser)
            return returnOperator(user?.name, user?.mobile, user?.email);
        };
        return returnOperator();
    } catch (error) {
        console.error(`${context} [Error]: ${error}`);
        captureException(error)
        return returnOperator();
    }

};

const getOperatorsViaHttp = async (charger) => {
    const context = "Function getOperatorsViaHttp";
    if (!charger?.partyId) {
        return returnOperator();
    }
    try {
        const params = { partyId: charger.partyId };
        const host = constants.publicNetWorkEndPoints.HostPublicNetWork + constants.publicNetWorkEndPoints.PathGetOperator;
        const result = await axios.get(host, { params });
        if (!result?.data) return returnOperator();
        return returnOperator(result.data?.companyName || result.data?.entityName, result.data?.contact, result.data?.email)
    } catch (error) {
        console.error(`${context} [Error]: ${error}`);
        captureException(error)
        return returnOperator();;
    }

};