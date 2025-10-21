import Charger from '../../../models/charger';
import Infrastructure from '../../../models/infrastructure';
import {ChargersFilters, ChargersFiltersConditions, ChargersFiltersResponse} from "../interfaces";
import mongoose from "mongoose";
import DurationHelper from "./durationHelper";

class FilterHelper {

    private static _isAllSelected(selectedValues: string | string[], allValues: string[]): boolean {
        if(!selectedValues) return false;

        if (!Array.isArray(selectedValues)) {
            selectedValues = [selectedValues];
        }
        return selectedValues.length === allValues.length && selectedValues.every(val => allValues.includes(val));
    }

    public static async fetchDistinctValues(userId: string) {
        try {
            const distinctStates = ['Active', 'Inactive'];

            const [distinctAccessibilities, distinctStatuses, distinctPlugStatuses] = await Promise.all([
                Charger.distinct('accessType', { createUser: userId }),
                Charger.distinct('status', { createUser: userId }),
                Charger.distinct('plugs.status', { createUser: userId }),
            ]);

            const distinctLocations = await Infrastructure.find({ createUserId: userId }, 'name')
                .then(infras => infras.map(infra => infra.name).filter(name => name));

            return { distinctStates, distinctAccessibilities, distinctStatuses, distinctPlugStatuses, distinctLocations };
        }
        catch (error) {
            console.error('Error fetching distinct values:', error);
            throw new Error('Failed to fetch distinct values');
        }
    }

    public static async allFilters(filters: ChargersFilters, userId: string): Promise<ChargersFiltersResponse> {
        const { locations, chargers, state, accessibility, chargerStatus, connectorStatus } = filters;

        const filterConditions: ChargersFiltersConditions[] = [];

        const { distinctAccessibilities, distinctStatuses, distinctPlugStatuses } = await this.fetchDistinctValues(userId);

        if (locations) {
            const locationFilters = Array.isArray(locations) ? locations : [locations];

            const infrastructures = await Infrastructure.find({ name: { $in: locationFilters } });

            if (infrastructures.length > 0) {
                const infrastructureIds = infrastructures.map(infra => infra._id.toString());
                filterConditions.push({ infrastructure: { $in: infrastructureIds } } as ChargersFiltersConditions);
            }
        }

        if (chargers) {
            const chargerFilters = Array.isArray(chargers) ? chargers : [chargers];
            filterConditions.push({ chargerId: { $in: chargerFilters } });
        }

        if (state && !this._isAllSelected(state, ['Active', 'Inactive'])) {
            const stateFilters = Array.isArray(state) ? state : [state];
            stateFilters.forEach(val => {
                const activeValue = val === 'Active';
                filterConditions.push({ active: activeValue });
            });
        }

        if (accessibility && !this._isAllSelected(accessibility, distinctAccessibilities)) {
            const accessibilityFilters = Array.isArray(accessibility) ? accessibility : [accessibility];
            filterConditions.push({ accessType: { $in: accessibilityFilters } });
        }

        if (chargerStatus && !this._isAllSelected(chargerStatus, distinctStatuses)) {
            const chargerStatusFilters = Array.isArray(chargerStatus) ? chargerStatus : [chargerStatus];
            filterConditions.push({ status: { $in: chargerStatusFilters } });
        }

        if (connectorStatus && !this._isAllSelected(connectorStatus, distinctPlugStatuses)) {
            const connectorStatusFilters = Array.isArray(connectorStatus) ? connectorStatus : [connectorStatus];
            filterConditions.push({
                'plugs.status': { $in: connectorStatusFilters },
            });
        }

        return filterConditions.length > 0 ? { $and: filterConditions } : {};

    }

    //Filter charger - input Text
    public static inputTextChargersFilters(inputText: string): ChargersFiltersConditions[]{

        const filterConditions: ChargersFiltersConditions[] = [];
        if (inputText) {
            const regexFilter = { $regex: inputText, $options: 'i' };

            filterConditions.push(
                { hwId: regexFilter },
                { name: regexFilter },
                { 'plugs.qrCodeId': regexFilter },
                { cpe: regexFilter }
            );
        }

        return filterConditions.length > 0 ? filterConditions : [{}];
    }

    public static async resolveChargers(chargers: any[], chargersForTotals: any[], sort: string, order: string) {
        const resolveCharger = async (charger: any) => {
            let location = '';
            if (charger.infrastructure && mongoose.Types.ObjectId.isValid(charger.infrastructure)) {
                location = await Infrastructure.findById(charger.infrastructure).then(infra => infra?.name || '');
            }

            const chargerItem = {
                chargerId: charger.hwId || '',
                chargerName: charger.name,
                location,
                state: charger.active ? 'Active' : 'Inactive',
                accessibility: charger.accessType || '',
                status: charger.status || '',
            };

            let plugs = (charger.plugs || []).map((plug: any, plugIndex: number) => ({
                plugId: plug.plugId || '',
                plugNumber: plugIndex + 1,
                qrCode: plug.qrCodeId || '',
                status: plug.status || '',
                connectorStatus: plug.subStatus || '',
                duration: DurationHelper.formatDuration((Date.now() - new Date(plug.statusChangeDate).getTime()) / 1000),
            }));

            if (['plugId', 'qrCode'].includes(sort)) {
                plugs = plugs.sort((a, b) => order === 'asc' ? (a[sort] || '').localeCompare(b[sort] || '') : (b[sort] || '').localeCompare(a[sort] || ''));
            }

            return { chargerItem, plugs };
        };

        // Combine both chargers arrays into one array
        const allChargers = [...chargers, ...chargersForTotals];

        // Resolve all chargers in one Promise.all
        const resolvedChargers = await Promise.all(allChargers.map(resolveCharger));

        // Split the resolved chargers into their respective arrays
        const resolvedChargersForMain = resolvedChargers.slice(0, chargers.length);
        const resolvedChargersForTotals = resolvedChargers.slice(chargers.length);

        // Return the resolved data
        return [resolvedChargersForMain, resolvedChargersForTotals];
    }

    private static _overrideTotals(globalTotals: Record<string, number>, selected: string | string[] | undefined, allValues: string[]) {
        const newTotals: Record<string, number> = {};

        allValues.forEach((value) => {
            if (selected) {
                const selectedValues = Array.isArray(selected) ? selected : [selected];
                newTotals[value] = selectedValues.includes(value) ? (globalTotals[value] || 0) : 0;
            } else {
                newTotals[value] = globalTotals[value] || 0;
            }
        });

        return newTotals;
    }

    private static globalTotalForLocations(distinctValues: any, locationMap: Map<string, number>) {
        return distinctValues.distinctLocations.map(loc => ({
            name: loc,
            totalChargersPerLocation: locationMap.get(loc) || 0,
        }));
    }

    private static globalTotalForFilters(computedTotals: any, distinctValues: any) {
        return {
            state: this._overrideTotals(computedTotals.state, undefined, distinctValues.distinctStates),
            accessibility: this._overrideTotals(computedTotals.accessibility, undefined, distinctValues.distinctAccessibilities),
            chargerStatus: this._overrideTotals(computedTotals.chargerStatus, undefined, distinctValues.distinctStatuses),
            plugStatus: this._overrideTotals(computedTotals.plugStatus, undefined, distinctValues.distinctPlugStatuses),
        };
    }

    private static totalsForFiltersAndLocations(chargers: any[], distinctValues: any) {
        const totals = {
            state: {} as Record<string, number>,
            accessibility: {} as Record<string, number>,
            chargerStatus: {} as Record<string, number>,
            plugStatus: {} as Record<string, number>,
        };

        chargers.forEach((charger) => {
            const state = charger.active ? 'Active' : 'Inactive';
            if (state && distinctValues.distinctStates.includes(state)) {
                totals.state[state] = (totals.state[state] || 0) + 1;
            }

            const accessibility = charger.accessType;
            if (accessibility != null) {
                totals.accessibility[accessibility] = (totals.accessibility[accessibility] || 0) + 1;
            }

            const status = charger.status;
            if (status != null) {
                totals.chargerStatus[status] = (totals.chargerStatus[status] || 0) + 1;
            }

            const plugStatuses = charger.plugs;
            if (plugStatuses) {
                plugStatuses.forEach(plug => {
                    const plugStatus = plug.status;
                    if (plugStatus != null) {
                        totals.plugStatus[plugStatus] = (totals.plugStatus[plugStatus] || 0) + 1;
                    }
                });
            }
        });

        return totals;
    }

    private static async getLocationChargersCount(userId: string): Promise<Map<string, number>> {
        const globalChargers = await Charger.find({ createUser: userId });
        const locationCountMap = new Map<string, number>();

        for (const charger of globalChargers) {
            if (charger.infrastructure && mongoose.Types.ObjectId.isValid(charger.infrastructure)) {
                const locationName = await Infrastructure.findById(charger.infrastructure)
                    .then(infra => infra?.name || '')
                    .catch(err => {
                        console.error('Error fetching infrastructure:', err);
                        return '';
                    });
                if (locationName) {
                    locationCountMap.set(locationName, (locationCountMap.get(locationName) || 0) + 1);
                }
            }
        }

        return locationCountMap;
    }

    public static async calculateFinalTotals(filters: any, computedTotals: any, distinctValues: any, locationMap: Map<string, number>, userId: string) {
        let finalTotals = {
            state: {},
            accessibility: {},
            chargerStatus: {},
            plugStatus: {},
        };

        let finalLocationTotals: { name: string; totalChargersPerLocation: number }[] = [];

        const locationCountMap = filters.locations || filters.filters ? await this.getLocationChargersCount(userId) : locationMap;

        if (filters.inputText && filters.inputText.trim() !== '') {
            finalTotals = this.globalTotalForFilters(computedTotals, distinctValues);
            finalLocationTotals = this.globalTotalForLocations(distinctValues, locationMap);
        }
        else if (filters.locations) {
            finalTotals = this.globalTotalForFilters(computedTotals, distinctValues);
            finalLocationTotals = this.globalTotalForLocations(distinctValues, locationCountMap);
        }
        else if (filters.filters && !filters.locations) {
            finalTotals = this.globalTotalForFilters(computedTotals, distinctValues);
            finalLocationTotals = this.globalTotalForLocations(distinctValues, locationMap);
        }
        else if (filters.locations && filters.filters) {
            finalTotals = this.globalTotalForFilters(computedTotals, distinctValues);
            finalLocationTotals = this.globalTotalForLocations(distinctValues, locationCountMap);
        }
        else {
            const chargers = await Charger.find({ createUser: userId });
            finalTotals = this.totalsForFiltersAndLocations(chargers, distinctValues);
            finalLocationTotals = this.globalTotalForLocations(distinctValues, locationMap);
        }

        return { finalTotals, finalLocationTotals };
    }

    public static initializeComputedTotals() {
        return {
            state: {} as Record<string, number>,
            accessibility: {} as Record<string, number>,
            chargerStatus: {} as Record<string, number>,
            plugStatus: {} as Record<string, number>,
        };
    }

    public static updateComputedTotals(computedTotals: any, chargerItem: any, plugs: any) {
        computedTotals.state[chargerItem.state] = (computedTotals.state[chargerItem.state] || 0) + 1;
        computedTotals.accessibility[chargerItem.accessibility] =
            (computedTotals.accessibility[chargerItem.accessibility] || 0) + 1;
        computedTotals.chargerStatus[chargerItem.status] =
            (computedTotals.chargerStatus[chargerItem.status] || 0) + 1;

        plugs.forEach((plug) => {
            computedTotals.plugStatus[plug.status] = (computedTotals.plugStatus[plug.status] || 0) + 1;
        });
    }

    public static updateLocationMap(locationMap: Map<string, number>, chargerItem: any) {
        const loc = chargerItem.location;
        if (loc) {
            locationMap.set(loc, (locationMap.get(loc) || 0) + 1);
        }
    }
}

export default FilterHelper;
