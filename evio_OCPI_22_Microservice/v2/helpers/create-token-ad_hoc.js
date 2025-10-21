const mobiE_managementToken = require('./../../2.2/sender/tokens/managementToken');
const gireve_managementToken = require('./../../2.1.1/sender/tokens/managementToken');
const getRandomInt = require('./random-int');
const checkDigitMobility = require('../../digitCalculation/digitCalculation');
const fs = require("fs");
const rawdata = fs.readFileSync('./digitCalculation/lists.json');
const checkDigitLists = JSON.parse(rawdata);
const { energy } = require('../../utils/constants');

module.exports = {
    createAdHocToken: async (userId, evId, isMobiE = true) => {
        return new Promise(async (resolve, reject) => {
            let countryCode = "PT"
            let partyId = "EVI"
            let random8Int = getRandomInt(10000000, 99999999)
            let appUserUid = getRandomInt(100000000000, 999999999999)
            let checkDigit = checkDigitMobility(countryCode + partyId + "C" + random8Int, checkDigitLists)
            console.log(random8Int);
            console.log(appUserUid);
    
            let body = isMobiE ?  {
                "country_code": countryCode,
                "party_id": partyId,
                "uid": appUserUid,
                "type": "AD_HOC_USER",
                "contract_id": `${countryCode}-${partyId}-C${random8Int}-${checkDigit}`,
                "issuer": "EVIO - Electrical Mobility",
                "evId": evId,
                "valid": true,
                "last_updated": "",
                "source": "",
                "userId": userId,
                "whitelist": "ALWAYS",
                "energy_contract": {
                    "supplier_name": energy.supplierName,
                    "contract_id": energy.contracts.dailyBi
                },
            } : {
                "country_code": countryCode,
                "party_id": partyId,
                "uid": appUserUid,
                "type": "OTHER",
                "contract_id": `${countryCode}-${partyId}-C${random8Int}-${checkDigit}`,
                "issuer": "EVIO - Electrical Mobility",
                "evId": evId,
                "valid": true,
                "last_updated": "",
                "source": "",
                "userId": userId,
                "whitelist": "NEVER",
            }

            let managementToken = isMobiE ? mobiE_managementToken : gireve_managementToken;

            await managementToken.createTokenLocal(isMobiE ? process.env.MobiEPlatformCode : global.girevePlatformCode, body).then(result => {

                resolve(result);
                //return res.status(200).send(result);
    
            }).catch((e) => {
                //console.log("HERE 2 ", e);
                reject(e)
                //return res.status(400).send(e);
            });
    
        });
    },
}