import { ITariff, ICharger } from "../interfaces/changeTariff.interface"

export function changeTariff(charger: ICharger): Promise<ICharger> {
    return new Promise((resolve) => {
        Promise.all(
            charger.plugs.map((plug) => {
                plug.statusChangeDate = new Date();
                let tariff: ITariff[] = [];

                return new Promise<void>((resolvePlug) => {
                    const isRestrict = charger.accessType === process.env.ChargerAccessRestrict;
                    const isPublic = charger.accessType === process.env.ChargerAccessPublic;
                    const hasGroups = charger.listOfGroups.length > 0;
                    const hasFleets = charger.listOfFleets.length > 0;

                    const deduplicateTariff = (tariffs: ITariff[], key: 'groupId' | 'fleetId'): ITariff[] => {
                        const unique: ITariff[] = [];
                        for (const t of tariffs) {
                            if (!unique.some(u => u[key] === t[key])) {
                                unique.push(t);
                            }
                        }
                        return unique;
                    };

                    const processEntities = (entities: any[], isGroup: boolean): Promise<void[]> => {
                        return Promise.all(
                            entities.map(entity => new Promise<void>((resolveEntity) => {
                                const key = isGroup ? 'groupId' : 'fleetId';
                                const nameKey = isGroup ? 'groupName' : 'fleetName';
                                const foundIndex = plug.tariff.findIndex(t => t[key] === entity[key]);

                                const newTariff: ITariff = {
                                    [nameKey]: entity[nameKey],
                                    [key]: foundIndex > -1 ? plug.tariff[foundIndex][key] : entity[key],
                                    tariffId: foundIndex > -1 ? plug.tariff[foundIndex].tariffId : '',
                                    tariff: foundIndex > -1 ? plug.tariff[foundIndex].tariff : {},
                                    tariffType: foundIndex > -1 ? plug.tariff[foundIndex].tariffType : '',
                                    name: foundIndex > -1 ? plug.tariff[foundIndex].name : ''
                                };

                                tariff.push(newTariff);
                                resolveEntity();
                            }))
                        );
                    };

                    const applyTariffs = async () => {
                        if (isRestrict || isPublic) {
                            if (isPublic) {
                                const foundIndex = plug.tariff.findIndex(
                                    t => t.groupName === process.env.ChargerAccessPublic
                                );
                                tariff.push(foundIndex > -1
                                    ? {
                                        groupName: process.env.ChargerAccessPublic,
                                        groupId: plug.tariff[foundIndex].groupId,
                                        tariffId: plug.tariff[foundIndex].tariffId,
                                        tariff: plug.tariff[foundIndex].tariff,
                                        tariffType: plug.tariff[foundIndex].tariffType,
                                        name: plug.tariff[foundIndex].name
                                    }
                                    : {
                                        groupName: process.env.ChargerAccessPublic,
                                        groupId: '',
                                        tariffId: '',
                                        tariff: {},
                                        tariffType: '',
                                        name: ''
                                    });
                            }

                            if (hasGroups && !hasFleets) {
                                await processEntities(charger.listOfGroups, true);
                                plug.tariff = deduplicateTariff(tariff, 'groupId');
                            } else if (!hasGroups && hasFleets) {
                                await processEntities(charger.listOfFleets, false);
                                plug.tariff = deduplicateTariff(tariff, 'fleetId');
                            } else if (hasGroups && hasFleets) {
                                await processEntities(charger.listOfGroups, true);
                                await processEntities(charger.listOfFleets, false);
                                let deduped = deduplicateTariff(tariff, 'groupId');
                                plug.tariff = deduplicateTariff(deduped, 'fleetId');
                            } else {
                                plug.tariff = tariff;
                            }
                        } else {
                            plug.tariff = [];
                        }
                    };

                    applyTariffs().then(() => resolvePlug());
                });
            })
        ).then(() => resolve(charger));
    });
}
