const Customization = require('../models/customization');
const ImageHandler = require('./imageHandler');
require("dotenv-safe").load();

module.exports = {
    addCustomization: function (req) {
        var context = "Function addCustomization";
        return new Promise((resolve, reject) => {

            let clientName = req.headers["clientname"];
            let customization = new Customization(req.body);
            customization.clientName;

            validateFields(customization)
                .then(() => {

                    //console.log("customization", customization);
                    saveImage(customization)
                        .then((newCustomization) => {

                            //console.log("newCustomization", newCustomization);

                            Customization.findOne({ brandName: newCustomization.brandName }, (err, result) => {
                                if (err) {
                                    console.error(`[${context}] Error `, err.message);
                                    reject(err);
                                };

                                if (result) {

                                    newCustomization = JSON.parse(JSON.stringify(newCustomization))
                                    //console.log("newCustomization", newCustomization);
                                    delete newCustomization._id;
                                    //console.log("newCustomization 1", newCustomization);

                                    Customization.updateCustomization({ brandName: newCustomization.brandName }, { $set: newCustomization }, (err, result) => {
                                        if (err) {
                                            console.error(`[${context}] Error `, err.message);
                                            reject(err);
                                        };
                                        resolve(result);
                                    })

                                } else {
                                    Customization.createCustomization(newCustomization, (err, result) => {
                                        if (err) {
                                            console.error(`[${context}] Error `, err.message);
                                            reject(err);
                                        };
                                        resolve(result);

                                    })
                                }
                            })



                        })
                        .catch((error) => {
                            console.error(`[${context}] Error `, error.message);
                            reject(error);
                        });

                })
                .catch((error) => {
                    reject(error);
                });

        });
    },
    editCustomization: function (req) {
        var context = "Function editCustomization";
        return new Promise((resolve, reject) => {

            //TODO

        });
    },
    getCustomization: function (clientname) {
        const context = "Function getCustomization";
        return new Promise((resolve, reject) => {

            let query = {
                brandName: clientname
            };

            Customization.findOne(query, async (err, customizationFound) => {
                if (err) {
                    console.error(`[${context}] Error `, err.message);
                    reject(err);
                };

                if (customizationFound) {
                    if (customizationFound.icons?.qrcodeIcon?.length > 0) {
                        try {
                            let qrcodeIcon = await ImageHandler.getQrcodeImage(customizationFound.icons.qrcodeIcon)
                            customizationFound.icons.qrcodeIcon = qrcodeIcon;

                            console.log(`[${context}] 0 customizationFound`, customizationFound);
                            resolve(customizationFound);

                        } catch (error) {
                            console.error(`[${context}] Error `, error.message);
                            reject(error);
                        };

                    } else {
                        console.log(`[${context}] customizationFound`, customizationFound);
                        resolve(customizationFound);
                    };

                }
                else
                    reject({ auth: false, code: 'server_customization_not_found', message: "Customization not found for given parameters" });

            });

        });
    },
    deleteCustomization: function (req) {
        var context = "Function deleteCustomization";
        return new Promise((resolve, reject) => {

            let clientName = req.body.brandName;

            let query = {
                brandName: clientName
            };

            Customization.removeCustomization(query, (err, customizationFound) => {
                if (err) {
                    console.error(`[${context}] Error `, err.message);
                    reject(err);
                };

                resolve({ auth: true, code: 'server_customization_removed', message: "Customization successfully removed" });

            });
        });
    }
}

//========== Function ==========
//Function to validate fields received 
function validateFields(customization) {
    return new Promise((resolve, reject) => {
        if (!customization)
            reject({ auth: false, code: 'server_customization_data_required', message: 'Customization data required' });

        else
            resolve(true);

    });
};

function saveImage(customization) {
    let context = "Function saveImage";
    return new Promise((resolve, reject) => {
        try {

            if (customization.icons) {

                ImageHandler.saveImageIcons(customization.icons, "icons/", customization.brandName)
                    .then(image => {
                        customization.icons = image;
                        resolve(customization);
                    });

            } else {

                resolve(customization);

            };

        } catch (error) {

            console.error(`[${context}][] Error `, error.message);
            resolve(customization);

        };

    });
};
/*
getSaveImage()

async function getSaveImage() {
    try {

        let qrcodeIcon = await ImageHandler.getQrcodeImage("http://85.88.143.237:5000/icons/EVIO_evio_o_faded.svg")
        console.log("qrcodeIcon", qrcodeIcon);

    } catch (error) {
        console.error(`[${context}] Error `, error.message);

    };
};
*/