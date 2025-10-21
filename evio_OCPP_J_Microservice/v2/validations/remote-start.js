const {DeviceTypes} = require('../configs/constants')
const validationFields = (req, reject) => {
    [
        {
            name: 'evId',
            code: 'server_ev_id_required',
            messageError: 'EV ID required',
            required: !req.body.freeStartTransaction && ![DeviceTypes.APT, DeviceTypes.QR_CODE].includes(req.body.clientType)
        },
        {
            name: 'plugId',
            code: 'server_plug_id_required',
            messageError: 'Plug ID required',
            required: true
        },
        {
            name: 'idTag',
            code: 'server_id_tag_required',
            messageError: 'IdTag required',
            required: true
        },
        {
            name: 'hwId',
            code: 'server_hw_required',
            messageError: 'HwId required',
            required: true
        },
        {
            name: 'tariffId',
            code: 'server_tariff_id_required',
            messageError: 'Tariff Id required',
            required: !req.body.freeStartTransaction
        },
        {
            name: 'userId',
            code: 'server_userId_required',
            messageError: 'UserId is required',
            required: req.body.freeStartTransaction
        }
    ].forEach(({code, messageError, name, required}) => {
        if (required && !req.body[name]) {
            reject.setField('code', code)
                .setField('internalLog', `${name} not found or invalid in request body`)
                .setField('message', messageError)

            throw new Error();
        }else if(!["tariffId", "idTag"].includes(name)){
            reject.setField(name, req.body[name])
        }
    });

    const chargingProfile = req.body.chargingProfile;

    if(chargingProfile){
        [
            "chargingProfileId", 
            "stackLevel", 
            "chargingProfilePurpose", 
            "chargingProfileKind", 
            "chargingSchedule"
        ].forEach(field => {
            if (!chargingProfile[field]) {
                reject.setField('code', `${field}_required`)
                    .setField('internalLog', `${field} not found or invalid in request body`)
                    .setField('message', `${field} is required in chargingProfile`)
                    .setField('auth', 'true');
                throw new Error();
            }
        });

        if (!Number.isInteger(chargingProfile.chargingProfileId)) {
            reject.setField('code', `invalid_chargingProfileId`)
                    .setField('message', 'chargingProfileId must be an integer')
                    .setField('auth', 'true');
            throw new Error();
        }

        if (chargingProfile.transactionId && !Number.isInteger(chargingProfile.transactionId)) {
            reject.setField('code', `invalid_transactionId`)
                .setField('message', 'TransactionId must be an integer');
            throw new Error();
        }

        if (!Number.isInteger(chargingProfile.stackLevel)) {
            reject.setField('code', `invalid_stackLevel`)
                .setField('message', 'stackLevel must be an integer');
            throw new Error();
        }

        if (!["ChargePointMaxProfile", "TxDefaultProfile", "TxProfile"].includes(chargingProfile.chargingProfilePurpose)) {
            reject.setField('code', `invalid_chargingProfilePurpose`)
                .setField('message', 'Invalid value for chargingProfilePurpose');
            throw new Error();
        }

        if (!["Absolute", "Recurring", "Relative"].includes(chargingProfile.chargingProfileKind)) {
            reject.setField('code', `invalid_chargingProfileKind`)
                .setField('message', 'Invalid value for chargingProfileKind');
            throw new Error();
        }

        if (chargingProfile.recurrencyKind && !["Daily", "Weekly"].includes(chargingProfile.recurrencyKind)) {
            reject.setField('code', `invalid_recurrencyKind`)
                .setField('message', 'Invalid value for recurrencyKind');
            throw new Error();
        }

        if (chargingProfile.validFrom && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(chargingProfile.validFrom)) {
            reject.setField('code', `invalid_validFrom`)
                .setField('message', 'Invalid format for validFrom');
            throw new Error();
        }

        if (chargingProfile.validTo && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(chargingProfile.validTo)) {
            reject.setField('code', `invalid_validTo`)
                .setField('message', 'Invalid format for validTo');
            throw new Error();
        }

        const chargingSchedule = chargingProfile.chargingSchedule;
        if (!chargingSchedule) {
            reject.setField('code', `chargingSchedule_required`)
                .setField('message', 'chargingSchedule is required in chargingProfile');
            throw new Error();
        }

        if (chargingSchedule.duration && !Number.isInteger(chargingSchedule.duration)) {
            reject.setField('code', `invalid_duration`)
                .setField('message', 'duration must be an integer');
            throw new Error();
        }

        if (chargingSchedule.startSchedule && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(chargingSchedule.startSchedule)) {
            reject.setField('code', `invalid_startSchedule`)
                .setField('message', 'Invalid format for startSchedule');
            throw new Error();
        }

        if (!["A", "W"].includes(chargingSchedule.chargingRateUnit)) {
            reject.setField('code', `invalid_chargingRateUnit`)
                .setField('message', 'Invalid value for chargingRateUnit');
            throw new Error();
        }

        const chargingSchedulePeriod = chargingSchedule.chargingSchedulePeriod;
        if (!chargingSchedulePeriod || !Array.isArray(chargingSchedulePeriod) || chargingSchedulePeriod.length === 0) {
            reject.setField('code', `invalid_chargingSchedulePeriod`)
                .setField('message', 'chargingSchedulePeriod is required and must be a non-empty array');
            throw new Error();
        }

        for (const period of chargingSchedulePeriod) {
            if (!Number.isInteger(period.startPeriod) || period.startPeriod < 0) {
                reject.setField('code', `invalid_startPeriod`)
                    .setField('message', 'startPeriod must be a non-negative integer')
                    .setField('auth', 'true');
                throw new Error();
            }

            if (typeof period.limit !== "number" || period.limit < 0 || !isValidDecimalNumber(period.limit.toString())) {
                reject.setField('code', `invalid_limit`)
                    .setField('message', 'Limit must be a non-negative decimal number')
                    .setField('auth', 'true');
                throw new Error();
            }

            if (period.numberPhases && !Number.isInteger(period.numberPhases) || period.numberPhases < 0) {
                reject.setField('code', `invalid_numberPhases`)
                    .setField('message', 'NumberPhases must be a non-negative integer')
                    .setField('auth', 'true');
                throw new Error();
            }
        }

        if (chargingProfile.minChargingRate && (typeof chargingProfile.minChargingRate !== "number" || !isValidDecimalNumber(chargingProfile.minChargingRate.toString()))) {
            reject.setField('code', `invalid_minChargingRate`)
                .setField('message', 'MinChargingRate must be a non-negative decimal number');
            throw new Error();
        }
    }
}

module.exports = {
    validationFields
};
