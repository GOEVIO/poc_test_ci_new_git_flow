const Token = require('../../models/tokens') 
const Utils = require('../../utils')
const Token211 = require('../../2.1.1/sender/tokens/managementToken')
const Token22 = require('../../2.2/sender/tokens/managementToken')

module.exports = {
    get: function (req, res) {
        return new Promise((resolve, reject) => {
            let context = "GET /api/private/tokens/";
    
            try {
                let params = req.query
                let query = {
                    source : params.source,
                    type : params.tokenType,
                    uid : params.uid
                }

                Token.findOne(query, (err, foundToken) => {
                    if (err) {
                        console.error(`[${context}][find] Error `, err);
                        reject(err);
                    }
                    else {
                        if (foundToken) {
                            resolve(foundToken);
                        } else {
                            resolve({})
                        }
                        
                    };
                });

            } catch (error) {
                console.error(`[${context}] Error `, error);
                reject(error.message);
            };
        
        })
    },
    createMultipleToken: async function (req, res) {
        try {
            let cards = req.body.cardsBodys

            let tokenResult = [];

            for (let i = 0; i != cards.length; i++) {

                let userId = cards[i].userId;

                let calls = cards[i].bodyToSendToOCPI

                tokenResult.push({
                    userId: userId,
                    contractId: cards[i].contractId,
                    cardId: cards[i].cardId,
                    result: []
                })

                for (let j = 0; j != calls.length; j++) {

                    let data = calls[j];

                    let ocpiVersion = data.OCPIVersion;

                    delete data.OCPIVersion;

                    let platformCode = data.platformCode;

                    delete data.platformCode;

                    let result = []
                    
                    if(ocpiVersion == process.env.ocpiVersion22)
                    result = await Token22.createTokenSendMultiple(platformCode, data, userId, ocpiVersion)
                    else if(ocpiVersion == process.env.ocpiVersion211)
                    result = await Token211.createTokenSendMultiple(platformCode, data, userId, ocpiVersion)

                    console.log(result)

                    tokenResult[i].result.push(result);
                }
            }

            return tokenResult

        }
        catch(err) {
            console.log(err)
            return {}
        }
    }
}

