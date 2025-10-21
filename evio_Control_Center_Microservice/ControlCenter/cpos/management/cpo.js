var Versions = require('../../../models/ocpiCredentialsVersions');
var Details = require('../../../models/ocpiCredentialsDetails');
var Platforms = require('../../../models/platforms');
const Utils = require('../../../utils');

module.exports = {
    create: function (req, res) {

        var context = "POST /api/private/controlcenter/cpo";

        try {

            addOcpiCredentialsVersions(req, res).then((versionsEndpoint) => {

                addOcpiCredentialsDetails(req, res).then(() => {

                    addOcpiCredentialsPlatforms(req, res, versionsEndpoint).then((platform) => {

                        return res.status(200).send({ "Endpoint Versions Module": versionsEndpoint, "MOBI.E Code": req.body.cpoMobieCode, "OCPI Party ID": req.body.party_id.toUpperCase(), "CREDENTIALS_TOKEN_A": platform.cpoActiveCredentialsToken[0].token });

                    }).catch((error) => {
                        return res.status(400).send(error);
                    })

                }).catch((error) => {
                    return res.status(400).send(error);
                })

            }).catch((error) => {
                return res.status(400).send(error);
            })

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return res.status(500).send(error.message);
        };

    },
    delete: function (req, res) {

    },
    update: function (req, res) {

    }

}


const addOcpiCredentialsVersions = (req, res) => {

    //Check first if platformId and CPO partyId already exists
    return new Promise((resolve, reject) => {
        try {

            var cpo = req.body.party_id.toUpperCase();
            var platformId = req.body.platformId.toUpperCase();
            let query = { cpo: cpo, platformId: platformId };

            Versions.findOne(query, { _id: 0, cpo: 0, platformId: 0 }, (err, versions) => {
                if (versions) {
                    reject("CPO Versions already exists");
                }
                else {

                    const versions = new Versions();
                    versions.version = req.body.ocpiVersion;
                    versions.cpo = cpo;
                    versions.platformId = platformId;
                    versions.url = req.body.baseEndpoint + platformId + "/" + cpo + "/" + "details"

                    var versionsEndpoint = req.body.baseEndpoint + platformId + "/" + cpo + "/" + "versions"

                    Versions.create(versions, function (err, res) {
                        if (err) {
                            console.log(`[${context}][createVersions] Error `, err);
                            return reject(new Error(err));
                        }
                        else {
                            resolve(versionsEndpoint);
                        }

                    });

                }

            });

        } catch (error) {
            console.error(`[addOcpiCredentialsVersions] Error `, error.message);
            reject(error.message);
        };
    });
};

const addOcpiCredentialsDetails = (req, res) => {

    //Check first if platformId and CPO partyId already exists
    return new Promise((resolve, reject) => {
        try {

            var cpo = req.body.party_id.toUpperCase();
            var platformId = req.body.platformId.toUpperCase();
            let query = { cpo: cpo, platformId: platformId };

            Details.findOne(query, { _id: 0, cpo: 0, platformId: 0 }, (err, versions) => {
                if (versions) {
                    reject("CPO Details already exists");
                }
                else {

                    const details = new Details();
                    details.version = req.body.ocpiVersion;
                    details.cpo = cpo;
                    details.platformId = platformId;

                    if (details.platformId == "mob")
                        details.endpoints = getMobieDetails(req, cpo, platformId, details);
                    else
                        details.endpoints = getGireveDetails(req, cpo, platformId, details);

                    Details.create(details, function (err, res) {
                        if (err) {
                            console.log(`[${context}][createDetails] Error `, err);
                            return reject(new Error(err));
                        }
                        else {
                            resolve(true);
                        }

                    });

                }

            });

        } catch (error) {
            console.error(`[addOcpiCredentialsDetails] Error `, error.message);
            reject(error.message);
        };
    });
};

const addOcpiCredentialsPlatforms = (req, res, versionsEndpoint) => {
    //Check first if platformId and CPO partyId already exists
    return new Promise((resolve, reject) => {
        try {

            var cpo = req.body.party_id.toUpperCase();
            var platformId = req.body.platformId.toUpperCase();
            let query = { cpo: cpo, platformId: platformId };

            Platforms.findOne(query, { _id: 0 }, (err, platformRes) => {
                if (platformRes) {
                    reject("CPO Platform already exists");
                }
                else {

                    let platform = new Platforms();


                    if (platformId.toLowerCase() == "mob") {
                        platform = getPlatform(req, cpo, platformId, platform, versionsEndpoint,process.env.MobiePlatformCode,process.env.MobiePlatformCode,platformId.toUpperCase())

                    }
                    else {
                        platform = getPlatform(req, cpo, platformId, platform, versionsEndpoint,process.env.GirevePlatformCode,process.env.GirevePlatformCode,platformId.toUpperCase())
                        // platform.platformCode = 'Gireve'
                        // platform.platformName = 'Gireve'
                    }


                    Platforms.create(platform, function (err, res) {
                        if (err) {
                            console.log(`[addOcpiCredentialsPlatforms][createDetails] Error `, err);
                            return reject(new Error(err));
                        }
                        else {
                            resolve(platform);
                        }

                    });

                }

            });

        } catch (error) {
            console.error(`[addOcpiCredentialsDetails] Error `, error.message);
            reject(error.message);
        };
    });

};

const getMobieDetails = (req, cpo, platformId, details) => {


    try {

        details.endpoints[0] = { identifier: "credentials", role: "RECEIVER", url: req.body.baseEndpoint + platformId + "/" + cpo + "/" + "credentials" }
        details.endpoints[1] = { identifier: "locations", role: "SENDER", url: req.body.baseEndpoint + platformId + "/" + cpo + "/" + "locations" }
        details.endpoints[2] = { identifier: "tariffs", role: "SENDER", url: req.body.baseEndpoint + platformId + "/" + cpo + "/" + "tariffs" }
        details.endpoints[3] = { identifier: "tokens", role: "RECEIVER", url: req.body.baseEndpoint + platformId + "/" + cpo + "/" + "tokens" }
        details.endpoints[4] = { identifier: "cdrs", role: "RECEIVER", url: req.body.baseEndpoint + platformId + "/" + cpo + "/" + "cdrs" }
        details.endpoints[5] = { identifier: "sessions", role: "SENDER", url: req.body.baseEndpoint + platformId + "/" + cpo + "/" + "sessions" }
        details.endpoints[6] = { identifier: "commands", role: "RECEIVER", url: req.body.baseEndpoint + platformId + "/" + cpo + "/" + "commands" }


        return details.endpoints;

    } catch (error) {
        console.error(`[getMobieDetails] Error `, error.message);

    };


};

//TODO Tiago
const getGireveDetails = (req, cpo, platformId, details) => {

    try {

        details.endpoints[0] = { identifier: "credentials", role: "RECEIVER", url: req.body.baseEndpoint + platformId + "/" + cpo + "/" + "credentials" }
        details.endpoints[1] = { identifier: "locations", role: "SENDER", url: req.body.baseEndpoint + platformId + "/" + cpo + "/" + "locations" }
        details.endpoints[2] = { identifier: "tariffs", role: "SENDER", url: req.body.baseEndpoint + platformId + "/" + cpo + "/" + "tariffs" }
        details.endpoints[3] = { identifier: "tokens", role: "RECEIVER", url: req.body.baseEndpoint + platformId + "/" + cpo + "/" + "tokens" }
        details.endpoints[4] = { identifier: "cdrs", role: "RECEIVER", url: req.body.baseEndpoint + platformId + "/" + cpo + "/" + "cdrs" }
        details.endpoints[5] = { identifier: "sessions", role: "SENDER", url: req.body.baseEndpoint + platformId + "/" + cpo + "/" + "sessions" }
        details.endpoints[6] = { identifier: "commands", role: "RECEIVER", url: req.body.baseEndpoint + platformId + "/" + cpo + "/" + "commands" }


        return details.endpoints;

    } catch (error) {
        console.error(`[getGireveDetails] Error `, error.message);

    };

};

const getPlatform = (req, cpo, platformId, platform, versionsEndpoint,platformCode,platformName,platformPartyId) => {


    try {

        var cpoRoles = {
            role: "CPO",
            party_id: cpo,
            country_code: req.body.country_code,
            business_details: {
                name: req.body.cpoName,
                logo: {
                    url: req.body.cpoLogoUrl,
                    thumbnail: req.body.cpoLogoThumbnail,
                    category: "NETWORK",
                    type: "jpeg",
                    width: 512,
                    height: 512
                },
                website: req.body.cpoWebSite
            }
        }

        var activeToken = Utils.generateToken(48);

        var cpoCredentialsHistory = [{ token: activeToken, createDate: new Date().toISOString(), version: req.body.ocpiVersion }];
        var cpoActiveCredentials = [{ token: activeToken, version: req.body.ocpiVersion }];

        platform.platformCode = platformCode
        platform.platformName = platformName
        platform.party_id = platformPartyId
        platform.platformId = platformId
        platform.cpo = cpo
        platform.cpoRoles = cpoRoles
        platform.cpoActiveCredentialsToken = cpoActiveCredentials
        platform.cpoTokensHistory = cpoCredentialsHistory
        platform.cpoURL = versionsEndpoint
        platform.source = platformCode

        return platform;

    } catch (error) {
        console.error(`[getPlatform] Error `, error.message);

    };


};
