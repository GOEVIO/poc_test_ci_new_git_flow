function validateAndRemoveNegativeFieldsReports(session) {
    if (!session) return session;

        if (session.totals) {
            if ('totalPower' in session.totals) session.totals.totalPower = session.totals.totalPower <= 0 ? 0 : session.totals.totalPower;
            if ('timeCharged' in session.totals) session.totals.timeCharged = session.totals.timeCharged <= 0 ? 0 : session.totals.timeCharged;
            if ('totalPriceInclVat' in session.totals) session.totals.totalPriceInclVat = session.totals.totalPriceInclVat <= 0 ? 0 : session.totals.totalPriceInclVat;
            if ('totalPriceExclVat' in session.totals) session.totals.totalPriceExclVat = session.totals.totalPriceExclVat <= 0 ? 0 : session.totals.totalPriceExclVat;
            if ('purchaseTariffDetailsExclVat' in session.totals) session.totals.purchaseTariffDetailsExclVat = session.totals.purchaseTariffDetailsExclVat <= 0 ? 0 : session.totals.purchaseTariffDetailsExclVat;
            if ('purchaseTariffDetailsInclVat' in session.totals) session.totals.purchaseTariffDetailsInclVat = session.totals.purchaseTariffDetailsInclVat <= 0 ? 0 : session.totals.purchaseTariffDetailsInclVat;
        }

        if (session.totalsGroupBy && Array.isArray(session.totalsGroupBy)) {
            session.totalsGroupBy = session.totalsGroupBy.map(group => {
                if ('totalPower' in group) group.totalPower = group.totalPower <= 0 ? 0 : group.totalPower;
                if ('timeCharged' in group) group.timeCharged = group.timeCharged <= 0 ? 0 : group.timeCharged;
                if ('totalPriceInclVat' in group) group.totalPriceInclVat = group.totalPriceInclVat <= 0 ? 0 : group.totalPriceInclVat;
                if ('totalPriceExclVat' in group) group.totalPriceExclVat = group.totalPriceExclVat <= 0 ? 0 : group.totalPriceExclVat;
                if ('purchaseTariffDetailsExclVat' in group) group.purchaseTariffDetailsExclVat = group.purchaseTariffDetailsExclVat <= 0 ? 0 : group.purchaseTariffDetailsExclVat;
                if ('purchaseTariffDetailsInclVat' in group) group.purchaseTariffDetailsInclVat = group.purchaseTariffDetailsInclVat <= 0 ? 0 : group.purchaseTariffDetailsInclVat;

                if (group.list && Array.isArray(group.list)) {
                    group.list = group.list.map(item => {
                        if ('totalPower' in item) item.totalPower = item.totalPower <= 0 ? 0 : item.totalPower;
                        if ('timeCharged' in item) item.timeCharged = item.timeCharged <= 0 ? 0 : item.timeCharged;

                        if (item.totalPrice) {
                            if ('excl_vat' in item.totalPrice) item.totalPrice.excl_vat = item.totalPrice.excl_vat <= 0 ? 0 : item.totalPrice.excl_vat;
                            if ('incl_vat' in item.totalPrice) item.totalPrice.incl_vat = item.totalPrice.incl_vat <= 0 ? 0 : item.totalPrice.incl_vat;
                        }
                        if (item.purchaseTariffDetails) {
                            if ('excl_vat' in item.purchaseTariffDetails) item.purchaseTariffDetails.excl_vat = item.purchaseTariffDetails.excl_vat <= 0 ? 0 : item.purchaseTariffDetails.excl_vat;
                            if ('incl_vat' in item.purchaseTariffDetails) item.purchaseTariffDetails.incl_vat = item.purchaseTariffDetails.incl_vat <= 0 ? 0 : item.purchaseTariffDetails.incl_vat;

                            if (item.purchaseTariffDetails.kwhListAverage && Array.isArray(item.purchaseTariffDetails.kwhListAverage)) {
                                item.purchaseTariffDetails.kwhListAverage = item.purchaseTariffDetails.kwhListAverage.map(value => value <= 0 ? 0 : value);
                            }
                        }
                        return item;
                    });
                }
                return group;
            });
        }

    return session;
}

module.exports = validateAndRemoveNegativeFieldsReports;
