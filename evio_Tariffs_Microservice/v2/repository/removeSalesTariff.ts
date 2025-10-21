import Constants from "../../utils/constants";
import axios from 'axios';

export async function removeSalesTariff(data: { userId: string, tariffId: string }) {
    const host = Constants.chargers.host + Constants.chargers.paths.removeTariff;

    await axios.patch(host, data).catch((err) => {
        console.error(`[removeSalesTariff] Error`, err.message);
    });
}
