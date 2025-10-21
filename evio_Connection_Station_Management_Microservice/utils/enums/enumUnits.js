const Units = Object.freeze({
    KWH: 'kWh',
    MIN: 'min',
    EURO: 'EUR',
});

const VoltageLevels = Object.freeze({
    BTN: {
        name: 'BTN',
        translationKey: 'voltageLevel_BTN',
    },
    BTE: {
        name: 'BTE',
        translationKey: 'voltageLevel_BTE',
    },
    MT: {
        name: 'MT',
        translationKey: 'voltageLevel_MT',
    },
    AT: {
        name: 'AT',
        translationKey: 'voltageLevel_AT',
    },
    MAT: {
        name: 'MAT',
        translationKey: 'voltageLevel_MAT',
    }
})

module.exports = { Units, VoltageLevels };
