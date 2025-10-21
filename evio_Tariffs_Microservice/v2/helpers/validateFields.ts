export function validateFields(salesTariff: any) {
    if (!salesTariff) throw new Error("SalesTariff data required");
    if (!salesTariff.tariffType) throw new Error("Tariff type required");
    if (!salesTariff.tariff) throw new Error("Tariff data required");
}
