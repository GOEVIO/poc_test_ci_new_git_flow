const ConnectorTypesEnum = {
    CCS1: {
        mainConnectorType: 'CCS 1',
    },
    CCS2: {
        mainConnectorType: 'CCS 2',
        secondaryConnectorType: ["CCS Supercharger", "CCS", "CCS SUPERCHARGER", "Supercharger"]
    },
    CHADEMO: {
        mainConnectorType: 'CHADEMO',
        secondaryConnectorType: ["CHAdeMO"]
    },
    TYPE2: {
        mainConnectorType: 'TYPE 2',
        secondaryConnectorType: [ "Type 2", "TESLA", "TESLA R", "Mennekes"]
    },
    J1772: {
        mainConnectorType: 'J1772',
        secondaryConnectorType: ['Type 1', 'TYPE 1']
    },
    NEMA_515: {
        mainConnectorType: 'NEMA 5-15',
    },
    SCHUKO_EU: {
        mainConnectorType: 'SCHUKO EU',
    },
    TYPE3A: {
        mainConnectorType: 'TYPE 3A',
    },
    TYPE3C: {
        mainConnectorType: 'TYPE 3C',
    },
};

module.exports = {
    ConnectorTypesEnum
}