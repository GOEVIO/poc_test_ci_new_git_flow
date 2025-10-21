const express = require('express');
const router = express.Router();
require("dotenv-safe").load();
const ImagesDependencies = require('../models/ImagesDependencies');
const fs = require('fs');
const Charger = require('../models/charger');
const { Certificate } = require('crypto');
const Nodemailer = require('nodemailer');
const { getCode, getName } = require('country-list');

//========== POST ==========
//Create new image for approval
router.post('/api/private/imagesDependencies', (req, res, next) => {
    var context = "POST /api/private/imagesDependencies";
    try {

        let imagesDependencies = new ImagesDependencies(req.body);
        let userId = req.headers['userid'];

        if (!userId)
            return res.status(400).send({ auth: false, code: 'server_user_id_required', message: 'User id is required' });

        imagesDependencies.userId = userId;

        validateFields(imagesDependencies)
            .then(() => {
                saveImageContent(imagesDependencies)
                    .then((imagesDependencies) => {

                        ImagesDependencies.createImagesDependencies(imagesDependencies, (err, result) => {
                            if (err) {
                                console.error(`[${context}][createImagesDependencies] Error `, err.message);
                                return res.status(500).send(err.message);
                            }
                            else {
                                sendEmailNotification(result);
                                return res.status(200).send(result);
                            };
                        });

                    })
                    .catch((error) => {
                        console.error(`[${context}][saveImageContent] Error `, error.message);
                        return res.status(500).send(error.message);
                    });

            })
            .catch((error) => {
                return res.status(400).send(error);
            });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.post('/api/private/imagesDependencies/runFirstTime', async (req, res, next) => {
    var context = "POST /api/private/imagesDependencies/runFirstTime";
    try {

        updateAddressModel();

        return res.status(200).send("OK");

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== PATCH ==========

//========== PUT ==========
//Edit save or refuse image
router.put('/api/private/imagesDependencies', (req, res, next) => {
    var context = "PUT /api/private/imagesDependencies";
    try {

        let imagesDependencies = req.body;
        validateFieldsEdit(imagesDependencies)
            .then(() => {
                switch (imagesDependencies.status) {

                    case process.env.ImagesDependenciesAccepted:


                        getImage(imagesDependencies)
                            .then((imageBase64) => {

                                Charger.findOne({ _id: imagesDependencies.chargerId }, { imageContent: 1 }, (err, chargerFound) => {
                                    if (err) {
                                        console.log(`[${context}][Charger.findOne] Error `, err.message);
                                        return res.status(500).send(err.message);
                                    }
                                    else {

                                        chargerFound.imageContent.push(imageBase64);

                                        Promise.all(
                                            chargerFound.imageContent.map((image, index) => {
                                                return new Promise((resolve, reject) => {
                                                    if (image.includes('base64')) {

                                                        var path = '/usr/src/app/img/chargersPublic/' + imagesDependencies.hwId + '_' + index + '.jpg';
                                                        var pathImage = '';
                                                        var base64Image = image.split(';base64,').pop();
                                                        if (process.env.NODE_ENV === 'production') {
                                                            pathImage = process.env.HostProd + 'chargersPublic/' + imagesDependencies.hwId + '_' + index + '.jpg'; // For PROD server
                                                        }
                                                        else if (process.env.NODE_ENV === 'pre-production') {
                                                            pathImage = process.env.HostPreProd + 'chargersPublic/' + imagesDependencies.hwId + '_' + index + '.jpg'; // For Pred PROD server
                                                        }
                                                        else {
                                                            //pathImage = process.env.HostLocal  + 'chargersPublic/' + imagesDependencies.hwId + '_' + index + '.jpg';
                                                            pathImage = process.env.HostQA + 'chargersPublic/' + imagesDependencies.hwId + '_' + index + '.jpg'; // For QA server
                                                        };

                                                        //console.log("base64Image", base64Image)
                                                        fs.writeFile(path, base64Image, { encoding: 'base64' }, function (err, result) {
                                                            if (err) {
                                                                console.error(`[${context}] Error `, err.message);;
                                                                reject(err);
                                                            }
                                                            else {

                                                                chargerFound.imageContent[index] = pathImage;
                                                                resolve(true);
                                                            };
                                                        });

                                                    }
                                                    else {
                                                        resolve(true);
                                                    }
                                                });
                                            })
                                        ).then(() => {

                                            //console.log("chargerFound", chargerFound);
                                            if (chargerFound.imageContent.length === 1) {
                                                chargerFound.defaultImage = chargerFound.imageContent[0];
                                            };

                                            Charger.updateCharger({ _id: imagesDependencies.chargerId }, { $set: chargerFound }, (err, result) => {
                                                if (err) {
                                                    console.log(`[${context}][Charger.updateCharger] Error `, err.message);
                                                    return res.status(500).send(err.message);
                                                }
                                                else {

                                                    ImagesDependencies.updateImagesDependencies({ _id: imagesDependencies._id }, { $set: { status: process.env.ImagesDependenciesAccepted } }, (err, result) => {
                                                        if (err) {
                                                            console.error(`[${context}][createImagesDependencies] Error `, err.message);
                                                            return res.status(500).send(err.message);
                                                        }
                                                        else {

                                                            ImagesDependencies.find({ status: process.env.ImagesDependenciesOpen }, (err, imagesDependenciesFound) => {

                                                                if (err) {

                                                                    console.log(`[${context}] Error `, err.message);
                                                                    return res.status(500).send(err.message);

                                                                }
                                                                else {

                                                                    return res.status(200).send(imagesDependenciesFound);

                                                                };

                                                            });

                                                        };
                                                    });

                                                };
                                            });

                                        }).catch((error) => {
                                            console.log(`[${context}][chargerFound.imageContent.map] Error `, error.message);
                                            return res.status(500).send(error.message);
                                        });

                                    };
                                });

                            })
                            .catch((error) => {
                                console.log(`[${context}][getImage] Error `, error.message);
                                return res.status(500).send(error.message);
                            });

                        break;

                    case process.env.ImagesDependenciesRefused:

                        unlinkImage(imagesDependencies)
                            .then((result) => {

                                let query = { _id: imagesDependencies._id };

                                ImagesDependencies.updateImagesDependencies(query, { $set: { status: process.env.ImagesDependenciesRefused } }, (err, result) => {
                                    if (err) {
                                        console.error(`[${context}][createImagesDependencies] Error `, err.message);
                                        return res.status(500).send(err.message);
                                    }
                                    else {

                                        ImagesDependencies.find({ status: process.env.ImagesDependenciesOpen }, (err, imagesDependenciesFound) => {

                                            if (err) {

                                                console.log(`[${context}] Error `, err.message);
                                                return res.status(500).send(err.message);

                                            }
                                            else {

                                                return res.status(200).send(imagesDependenciesFound);

                                            };

                                        });

                                    };
                                });

                            })
                            .catch((error) => {
                                console.log(`[${context}][unlinkImage] Error `, error.message);
                                return res.status(500).send(error.message);
                            });

                        break;

                    default:

                        return res.status(400).send({ auth: false, code: 'server_status_diferente_required', message: 'Status need to be Accepted or Refused' });

                };
            })
            .catch((error) => {
                return res.status(400).send(error);
            });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== GET ==========
//Endpoint to get all images dependencies in open
router.get('/api/private/imagesDependencies', (req, res, next) => {
    var context = "GET /api/private/imagesDependencies";
    try {

        let query = {
            status: process.env.ImagesDependenciesOpen
        };

        ImagesDependencies.find(query, (err, imagesDependenciesFound) => {

            if (err) {

                console.log(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);

            }
            else {

                return res.status(200).send(imagesDependenciesFound);

            };

        });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== DELETE ==========

//========== FUNCTIONS ==========
function validateFields(imagesDependencies) {
    return new Promise((resolve, reject) => {

        if (!imagesDependencies)
            reject({ auth: false, code: 'server_imagesDependencies_required', message: 'Image data is required' });

        if (!imagesDependencies.chargerId)
            reject({ auth: false, code: 'server_charger_id_required', message: 'Charger id is required' });

        if (!imagesDependencies.hwId)
            reject({ auth: false, code: 'server_hwId_required', message: 'Hardware Id is required!' });

        if (!imagesDependencies.imageContent)
            reject({ auth: false, code: 'server_imageContent_required', message: 'Image content is required' });

        if (!imagesDependencies.createdBy)
            reject({ auth: false, code: 'server_createdBy_required', message: 'Name of the user is required' });

        if (!imagesDependencies.geometry)
            reject({ auth: false, code: 'server_geometry_required', message: 'Coordinates is required' });

        if (!imagesDependencies.address)
            reject({ auth: false, code: 'server_address_required', message: 'Address is required' });

        if (!imagesDependencies.chargerType)
            reject({ auth: false, code: 'server_chargerType_required', message: 'Charger type is required' });

        else
            resolve(true);

    });
};

function validateFieldsEdit(imagesDependencies) {
    return new Promise((resolve, reject) => {

        if (!imagesDependencies)
            reject({ auth: false, code: 'server_imagesDependencies_required', message: 'Image data is required' });

        if (!imagesDependencies.chargerId)
            reject({ auth: false, code: 'server_charger_id_required', message: 'Charger id is required' });

        if (!imagesDependencies.hwId)
            reject({ auth: false, code: 'server_hwId_required', message: 'Hardware Id is required!' });

        if (!imagesDependencies.imageContent)
            reject({ auth: false, code: 'server_imageContent_required', message: 'Image content is required' });

        if (!imagesDependencies.createdBy)
            reject({ auth: false, code: 'server_createdBy_required', message: 'Name of the user is required' });

        if (!imagesDependencies.geometry)
            reject({ auth: false, code: 'server_geometry_required', message: 'Coordinates is required' });

        if (!imagesDependencies.address)
            reject({ auth: false, code: 'server_address_required', message: 'Address is required' });

        if (!imagesDependencies.status)
            reject({ auth: false, code: 'server_status_required', message: 'Status is required' });

        if (imagesDependencies.status != process.env.ImagesDependenciesAccepted && imagesDependencies.status != process.env.ImagesDependenciesRefused)
            reject({ auth: false, code: 'server_status_diferente_required', message: 'Status need to be Accepted or Refused' });

        if (!imagesDependencies.chargerType)
            reject({ auth: false, code: 'server_chargerType_required', message: 'Charger type is required' });

        else
            resolve(true);

    });
};

function saveImageContent(imagesDependencies) {
    var context = "Function saveImageContent";
    return new Promise((resolve, reject) => {

        let dateNow = Date.now();
        var path = `/usr/src/app/img/temp/${imagesDependencies.hwId}_${imagesDependencies.userId}_${dateNow}.jpg`;
        var pathImage = '';
        var base64Image = imagesDependencies.imageContent.split(';base64,').pop();
        if (process.env.NODE_ENV === 'production') {
            pathImage = process.env.HostProd + `temp/${imagesDependencies.hwId}_${imagesDependencies.userId}_${dateNow}.jpg`; // For PROD server
        }
        else if (process.env.NODE_ENV === 'pre-production') {
            pathImage = process.env.HostPreProd + `temp/${imagesDependencies.hwId}_${imagesDependencies.userId}_${dateNow}.jpg`; // For PROD server
        }
        else {
            //pathImage = process.env.HostLocal +`temp/${imagesDependencies.hwId}_${imagesDependencies.userId}_${dateNow}.jpg`;// For local host
            pathImage = process.env.HostQA + `temp/${imagesDependencies.hwId}_${imagesDependencies.userId}_${dateNow}.jpg`; // For QA server
        };

        fs.writeFile(path, base64Image, { encoding: 'base64' }, function (err, result) {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err)
            }
            else {
                imagesDependencies.imageContent = pathImage;
                resolve(imagesDependencies);
            };
        });
    });
};

function unlinkImage(imagesDependencies) {
    var context = "Function unlinkImage";
    return new Promise((resolve, reject) => {

        let imagePath = imagesDependencies.imageContent.split('/');
        var path = `/usr/src/app/img/temp/${imagePath[imagePath.length - 1]}`;
        fs.unlink(path, (err, result) => {
            if (err) {
                console.error(`[${context}] [fs.unlink]Error `, err.message);
                resolve();
                //reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

function getImage(imagesDependencies) {
    var context = "Function moveImage";
    return new Promise((resolve, reject) => {

        let imagePath = imagesDependencies.imageContent.split('/');
        var path = `/usr/src/app/img/temp/${imagePath[imagePath.length - 1]}`;

        fs.readFile(path, 'base64', (err, imageBase64) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err)
            }
            else {

                unlinkImage(imagesDependencies)
                    .then((result) => {
                        resolve(`data:image/jpg;base64,${imageBase64}`);
                    })
                    .catch((error) => {
                        console.error(`[${context}][unlinkImage] Error`, error.message);
                        reject(error);
                    });

            };
        });



    });
};

/*sendEmailNotification(
    {
        hwId: "11556674sdgds",
        address: {
            street: "Rua de avilhoso",
            number: "64",
            zipCode: "4455-066",
            city: "Lavra"
        }
    }
)*/

function sendEmailNotification(imageInfo) {
    let context = "Function sendEmailNotification";

    //let host = process.env.HostNotifications + process.env.PathSendEmail

    let email;

    if (process.env.NODE_ENV === "production") {
        email = process.env.emailSupport
    } else {
        email = process.env.emailTest
    };

    const transporter = Nodemailer.createTransport({
        maxConnections: 2,
        maxMessages: 1,
        pool: true,
        host: 'smtp.office365.com',
        port: 587,
        auth: {
            user: process.env.EVIOMAIL,
            pass: process.env.EVIOPASSWORD
        }
    });

    let mailOptions = {
        source: '"evio Support" <support@go-evio.com>',
        from: '"evio Support" <support@go-evio.com>', // sender address
        to: email,
        subject: `Sugestão de imagem para o carregador ${imageInfo.hwId}`,
        text: 'Validate Email', // plaintext body
        html: `<h2>Sugestão de imagem para o carregador  ${imageInfo.hwId}</h2>` +
            `<p>Foi sugerida uma iamgem para o carregador com o HwID ${imageInfo.hwId}, que se situa na ${imageInfo.address.street} nº ${imageInfo.address.number}, ${imageInfo.address.zipCode}, ${imageInfo.address.city}. </p>` +
            `<p>A imagem está a espera de aprovação por parte da EVIO</p>`
    };

    transporter.sendMail(mailOptions, function (error, info) {
        if (error)
            console.error(`[${context}] Error `, error.message);
        else
            console.error(`[${context}] Email sent: `, info.response);
    });

};

async function updateAddressModel() {
    const context = "Function updateAddressModel"
    try {

        await ImagesDependencies.updateMany({ 'address.address': { '$exists': true } }, [{ $set: { 'address.street': "$address.address" } }], (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
            }
            else {
                console.log("result address.address to address.street: ", result);
            };
        })

        await ImagesDependencies.updateMany({ 'address.postCode': { '$exists': true } }, [{ $set: { 'address.zipCode': "$address.postCode" } }], (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
            }
            else {
                console.log("result address.postCode to address.zipCode: ", result);
            };
        })

        let imagesDependencies = await ImagesDependencies.find({ 'address.country': { '$exists': true } })

        let unicCountries = []

        for (let i = 0; i != imagesDependencies.length; i++) {
            if (imagesDependencies[i].address)
                if (imagesDependencies[i].address.country)
                    if (unicCountries.indexOf(imagesDependencies[i].address.country) == -1) {
                        unicCountries.push(imagesDependencies[i].address.country)
                    }
        }

        let coutryCodes = []

        for (let i = 0; i != unicCountries.length; i++) {
            coutryCodes.push(getCode(unicCountries[i]))
        }

        console.log("coutryCodes")
        console.log(coutryCodes)

        console.log("unicCountries")
        console.log(unicCountries)

        for (let i = 0; i != coutryCodes.length; i++) {
            if (coutryCodes[i] != undefined) {
                await ImagesDependencies.updateMany({ 'address.country': unicCountries[i] }, [{ $set: { 'address.countryCode': coutryCodes[i] } }], (err, result) => {
                    if (err) {
                        console.error(`[${context}] Error `, err.message);
                    }
                    else {
                        console.log("result " + unicCountries[i] + " to " + coutryCodes[i] + ": ", result);
                    };
                })
            }
            else {
                console.log("WRONG Country found: " + unicCountries[i])
            }
        }


    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return error
    }
}

module.exports = router;