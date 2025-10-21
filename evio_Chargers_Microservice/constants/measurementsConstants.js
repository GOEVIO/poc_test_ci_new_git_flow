const GRID_MEASUREMENTS = {
    ERROR_COMMUNICATION: 'communicationFail',
    IMPORT_ENERGY_ACTIVE: 'importEnergy',
    EXPORT_ENERGY_ACTIVE: 'exportEnergy',
    EXPORT_POWER_ACTIVE: 'exportPower',
    IMPORT_POWER_ACTIVE: 'importPower',
    POWER_ACTIVE: 'importPower',
    VOLTAGE_L1: 'v1',
    VOLTAGE_L2: 'v2',
    VOLTAGE_L3: 'v3',
    CURRENT_L1: 'i1',
    CURRENT_L2: 'i2',
    CURRENT_L3: 'i3',
    MIN_SOLAR_CURRENT: 'minSolarCurrent',
    SHARING_MODE: 'sharingMode',
    CHARGING_MODE: 'chargingMode',
    CURRENT_LIMIT: 'currentLimit',
    OPERATIONAL_MARGIN: 'operationalMargin',
    CURRENT_DISTRIBUTED_EACH_VEHICLE: 'powerSetPointByEV',
    VOLTAGE: 'voltage',
    CIRCUIT_BREAKER: 'circuitBreaker',
    ACTIVE_SESSIONS: 'activeSessions',
    SW_CURRENT_LIMIT: 'maxAllowedCurrent',
}
const PV_MEASUREMENTS = {
    ERROR_COMMUNICATION: 'isOnline',
    POWER_ACTIVE: 'powerProduction',
    EXPORT_ENERGY_ACTIVE: 'exportEnergyActive',
    EXPORT_POWER_ACTIVE: 'exportPowerActive',
    IMPORT_POWER_ACTIVE: 'importPowerActive',
    CONTROL_TYPE: 'controlType',
}

const PLUG_MEASUREMENTS = {
    ERROR: 'isWithError',
    ERROR_COMMUNICATION: 'isOnline',
    CURRENT_L1: 'current1',
    CURRENT_L2: 'current2',
    CURRENT_L3: 'current3',
    PRIORITY: 'priority',
    VOLTAGE_L1: 'voltage1',
    VOLTAGE_L2: 'voltage2',
    VOLTAGE_L3: 'voltage3',
    VOLTAGE: 'voltage',
    POWER_ACTIVE: 'power',
    POWER_ACTIVE_MAX: 'powerMax',
    STATE_NAME: 'operationalState',
    CURRENT_LIMIT: 'currentLimit',
    TOTAL_CURRENT: 'totalCurrent',
    IMPORT_ENERGY_ACTIVE: 'importEnergyActive',
    ENERGY: 'energy',
    CONTROL_TYPE: 'controlType',
    POWER_ACTIVE_MIN: 'minActivePower',
    CURRENT_PHASE_SETPOINT: 'setCurrentLimit'
}

const PLUG_CONTROL_TYPES = [
    'AUTO',
    'MANUAL',
    'OFF',
    'BOOST'
]
module.exports = {
    PLUG_MEASUREMENTS,
    PV_MEASUREMENTS,
    GRID_MEASUREMENTS,
    PLUG_CONTROL_TYPES
}