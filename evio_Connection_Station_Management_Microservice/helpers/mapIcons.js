const axios = require('axios');
const Constants = require("../utils/constants");
const { operatorService } = require('evio-library-chargers').default;

/**
 * Decide icon type for a station:
 * - offline: by status
 * - multiple: >1 connectors/evses/points
 * - single: default
 */
function inferIconType(station) {
    const status = (station.status || '').toUpperCase();
    if (['OUT_OF_SERVICE', 'INOPERATIVE', 'OFFLINE'].includes(status)) return 'offline';

    const points =
        Number(station.totalPoints ?? station.connectorsCount ?? station.evsesCount ?? 0) ||
        (Array.isArray(station.connectors) ? station.connectors.length : 0);

    return points > 1 ? 'multiple' : 'single';
}

/** Fetch icons for all partyIds once (bulk) */
async function fetchOperatorIconsBulk(partyIds) {
    if(partyIds.length === 0) return new Map();

    // ajusta a origem segundo o teu config. Exemplo:
    const base = Constants.services.publicNetworkHost;
    const url = `${base}/api/private/operators/icons/bulk`;

    const operatorIcons = await operatorService.listIconsByPartyIds(partyIds);
    // data: [{ partyId, icons: [{type,url}, ...] }]
    const map = new Map();
    for (const { icons, partyId } of operatorIcons || []) {
        const iconTypes = [];
        for (const { type, url } of icons || []) iconTypes.push({ type, url });
        map.set(partyId, iconTypes);
    }
    return map;
}

/** Attach { icons: {type,url} } to each station */
async function attachIconsToStations(stations) {
    stations.icons = []; // ensure icons field exists
    if (!Array.isArray(stations) || !stations.length) return stations;

    const partyIds = [...new Set(stations.map(s => s.partyId).filter(Boolean))];
    const iconsMap = await fetchOperatorIconsBulk(partyIds);

    if(iconsMap.size === 0) return stations;

    return stations.map(s => {
        const icons = iconsMap.get(s.partyId) || [];
        return icons.length ? { ...s, icons } : s;
    });
}

module.exports = {
    inferIconType,
    fetchOperatorIconsBulk,
    attachIconsToStations,
};
