import Constants from '../../utils/constants';
import axios from 'axios';

export async function updateTariffOnCharger(tariff: any) {
    const host = Constants.chargers.host + Constants.chargers.paths.editTariff;

    await axios.patch(host, tariff).catch((err) => {
        console.error(`[updateTariffOnCharger] Error`, err.message);
    });
}
