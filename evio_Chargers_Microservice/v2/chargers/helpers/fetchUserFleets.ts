import axios from 'axios';
import Constants from '../../../utils/constants'

export async function fetchUserFleets(userId: string) {
    const url = `${Constants.hosts.evs}/api/private/fleets`;
    const headers = { userid: userId };

    const result = await axios.get(url, { headers });
    return result.data;
}
