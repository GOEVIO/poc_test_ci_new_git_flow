const TariffTypes = Object.freeze({
    ENERGY: 'ENERGY',
    TIME: 'TIME',
    FLAT: 'FLAT',
    PARKING_TIME: 'PARKING_TIME',
});
const PlugStatus = Object.freeze({
    AVAILABLE: '10',
    IN_USE: '20',
    BOOKED: '30',
    UNAVAILABLE: '40',
    OFFLINE: '50',
});
const PlanNames = Object.freeze( {
    WhiteLabelGoCharge: 'server_plan_EVIO_ad_hoc_goCharge',
    WhiteLabelHyundai: 'server_plan_EVIO_ad_hoc_hyundai',
    WhiteLabelKLC: 'server_plan_EVIO_ad_hoc_klc',
    WhiteLabelKinto: 'server_plan_EVIO_ad_hoc_kinto',
    default: 'server_plan_EVIO_ad_hoc',
});

const ConnectorFormats = Object.freeze({
    cable: {
        translationKey: 'general_cable',
        key: 'CABLE',
    },
    socket: {
        translationKey: 'general_socket',
        key: 'SOCKET',
    },
});

const ConnectorPowerTypes = Object.freeze({
    AC_1_PHASE: {
        translationKey: 'general_ac_1_phase',
        key: 'AC_1_PHASE',
    },
    AC_3_PHASE: {
        translationKey: 'general_ac_3_phase',
        key: 'AC_3_PHASE',
    },
    DC: {
        translationKey: 'general_dc',
        key: 'DC',
    },
});

const ChargerSubStatus = Object.freeze({
    AVAILABLE: 'AVAILABLE',
    UNKNOWN: 'UNKNOWN',
    CHARGING: 'CHARGING',
    OUTOFORDER: 'OUTOFORDER',
    BLOCKED: 'BLOCKED',
    PLANNED: 'PLANNED',
    REMOVED: 'REMOVED',
    RESERVED: 'RESERVED',
    INOPERATIVE: 'INOPERATIVE',
})

const plugCapabilities = Object.freeze({
    REMOTE_START_STOP_CAPABLE:"REMOTE_START_STOP_CAPABLE",
})

const FilterByEnum = Object.freeze({
    totalPrice: "totalPrice",
    distance: "distance",
    unitPrice: "unitPrice",
    energy: "energy",
});

module.exports = { TariffTypes, PlugStatus, PlanNames, ConnectorFormats, ConnectorPowerTypes, ChargerSubStatus, plugCapabilities, FilterByEnum };
