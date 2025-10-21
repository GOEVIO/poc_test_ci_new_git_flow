import TariffsLib from 'evio-library-tariffs';
import { get } from 'evio-library-commons/dist/src/util/function/objects';
import EvioCommons from 'evio-library-commons';

const BillingTypeForBilling = EvioCommons.Enums.SalesTariffs.BillingType.ForBilling.toString();

export type ProjectedSalesTariffType = {
    _id: string;
};

const projection = {
    _id: 1,
};

export async function getSalesTariffs(tariffsIds: string[]): Promise<Array<string>> {
    if (!tariffsIds.length) {
        return [];
    }

    const query = {
        _id: { $in: tariffsIds },
        billingType: String(process.env.BillingTypeForBilling),
    };
    const tariffs = await TariffsLib.findSalesTariffs(query, projection);
    return tariffs.map(get('_id'));
}
