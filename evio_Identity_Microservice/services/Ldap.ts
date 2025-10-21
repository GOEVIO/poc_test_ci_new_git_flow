/* eslint-disable no-underscore-dangle */
/* eslint-disable import/no-relative-packages */
import { captureException } from '@sentry/node';

//Controllers
import driversController from '../controllers/driver';
import groupCSUserController from '../controllers/groupCSUser';

// Services
import contractsServices from '../services/contracts';
import groupDriverServices from '../services/groupDriver';


const commonLog = '[Service Ldap';

function updateEmailAndName(user) {
    const context = `${commonLog} updateEmailAndName ]`;
    try{
        contractsServices.updateEmailContract(user);
        driversController.updateNameDrivers(user);
        groupDriverServices.updateNameGroupDrivers(user);
        groupCSUserController.updateNameGroupCSUsers(user);
        contractsServices.updateNameContract(user);
    } catch( error ){
        console.error(`${context} Error `, error.message);
        captureException(error)
    }
}

// Function to change email and name on Ldap
async function changeNameEmail(user) {
    const context = `${commonLog} changeNameEmail ]`;
    try {
        updateEmailAndName(user);
        return user;
    } catch (err) {
        console.error(`${context} Error `, err.message);
        throw err;
    }
}

export default {
    updateEmailAndName,
    changeNameEmail
};
