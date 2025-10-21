import axios from 'axios';
// Utils
import constants from '../utils/constants';

async function isUserInDebt(userId: string): Promise<boolean> {
    try {
        const response = await axios({
            method: 'get',
            url: `${constants.externalEndpoints.Payment.Host}${constants.externalEndpoints.Payment.PathCheckUserDebt}`,
            headers: { userid: userId },
        });
        return response?.data;
    } catch (error) {
        console.error('Error ', error.message);
        return true;
    }
}

export default { isUserInDebt };
