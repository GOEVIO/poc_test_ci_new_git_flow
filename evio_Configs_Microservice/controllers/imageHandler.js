require("dotenv-safe").load();
const fs = require('fs');

module.exports = {

    saveImageIcons: function (image, folder, brandName) {
        var context = "Function saveImage";
        return new Promise(async (resolve, reject) => {

            //console.log("image", image);
            brandName = brandName.replaceAll(' ', '')
            let pathImage = '';
            if (process.env.NODE_ENV === 'production') {
                pathImage = `${process.env.HostProd}${folder}${brandName}`; // For PROD server
            }
            else if (process.env.NODE_ENV === 'pre-production') {
                pathImage = `${process.env.HostPreProd}${folder}${brandName}`; // For Pre PROD server
            }
            else {
                //pathImage = `${process.env.HostLocal}${folder}${brandName}/`; // For local host
                pathImage = `${process.env.HostQA}${folder}${brandName}`;// For QA server
            };

            let principalIcon = '';
            let favicon = '';
            let walletIcon = '';
            let logo = '';
            let mapIcons = {};
            let newMapIcons = {};
            let cards = {};
            let newCards = {};
            let qrcodeIcon = [];

            if (image.qrcodeIcon.length > 0) {

                image.qrcodeIcon.forEach((qrcode, index) => {
                    let path = `/usr/src/app/img/${folder}${brandName}qrcodeIcon_${index}.svg`;
                    qrcodeIcon[index] = `${pathImage}qrcodeIcon_${index}.svg`
                    let base64Image;

                    if (qrcode.includes("base64"))
                        base64Image = qrcode.split(';base64,').pop();
                    else
                        base64Image = qrcode;

                    //console.log("path qrcodeIcon", path);

                    fs.writeFile(path, base64Image, { encoding: 'base64' }, function (err, result) {
                        if (err) {
                            console.error(`[${context}] Error `, err.message);
                        }
                    });
                })

                /*let path = `/usr/src/app/img/${folder}${brandName}qrcodeIcon.svg`;
                qrcodeIcon = pathImage + 'qrcodeIcon.svg'
                let base64Image;

                if (image.qrcodeIcon.includes("base64"))
                    base64Image = image.qrcodeIcon.split(';base64,').pop();
                else
                    base64Image = image.qrcodeIcon;

                //console.log("path qrcodeIcon", path);

                fs.writeFile(path, base64Image, { encoding: 'base64' }, function (err, result) {
                    if (err) {
                        console.error(`[${context}] Error `, err.message);
                    }
                });*/

            };

            if (image.mapIcons) {
                //console.log("1");
                if (Object.keys(image.mapIcons).length > 0) {
                    //console.log("2");

                    async function* asyncMapIcons() {

                        let keyNames = Object.keys(image.mapIcons);
                        let objectLength = Object.keys(image.mapIcons).length;

                        for (let i = 0; i < objectLength; yield i++) {

                            let path = `/usr/src/app/img/${folder}${brandName}_${keyNames[i]}.svg`;
                            let mapIcon = pathImage + '_' + keyNames[i] + '.svg';
                            let base64Image;
                            newMapIcons[keyNames[i]] = mapIcon

                            //console.log("newMapIcons", newMapIcons);

                            if (image.mapIcons[keyNames[i]].includes("base64"))
                                base64Image = image.mapIcons[keyNames[i]].split(';base64,').pop();
                            else
                                base64Image = image.mapIcons[keyNames[i]];

                            fs.writeFile(path, base64Image, { encoding: 'base64' }, function (err, result) {
                                if (err) {
                                    console.error(`[${context}] Error `, err.message);
                                }
                                //console.log("i", i);
                            });

                        };
                    }

                    for await (const num of asyncMapIcons()) {
                        //console.log("num", num);
                        //console.log("mapIcon", newMapIcons);
                        mapIcons = newMapIcons;

                        //console.log("mapIcons", mapIcons);
                    }
                };
            };

            if (image.cards) {
                if (Object.keys(image.cards).length > 0) {

                    async function* asyncCards() {

                        let keyNames = Object.keys(image.cards);
                        let objectLength = Object.keys(image.cards).length;

                        for (let i = 0; i < objectLength; yield i++) {

                            let path = `/usr/src/app/img/${folder}${brandName}_${keyNames[i]}.svg`;
                            let card = pathImage + '_' + keyNames[i] + '.svg';

                            let base64Image;
                            newCards[keyNames[i]] = card
                            //console.log("cards", newCards);
                            if (image.cards[keyNames[i]].includes("base64"))
                                base64Image = image.cards[keyNames[i]].split(';base64,').pop();
                            else
                                base64Image = image.cards[keyNames[i]];

                            fs.writeFile(path, base64Image, { encoding: 'base64' }, function (err, result) {
                                if (err) {
                                    console.error(`[${context}] Error `, err.message);
                                }
                                //console.log("i", i);
                            });

                        };

                    };

                    for await (const num of asyncCards()) {
                        //console.log("num", num);
                        //console.log("mapIcon", newMapIcons);
                        cards = newCards;

                        //console.log("mapIcons", mapIcons);
                    }

                };
            };

            if (image.principalIcon) {

                let path = `/usr/src/app/img/${folder}${brandName}_principalIcon.svg`;
                principalIcon = pathImage + '_principalIcon.svg'
                let base64Image;

                if (image.principalIcon.includes("base64"))
                    base64Image = image.principalIcon.split(';base64,').pop();
                else
                    base64Image = image.principalIcon;

                //console.log("path principalIcon", path);

                fs.writeFile(path, base64Image, { encoding: 'base64' }, function (err, result) {
                    if (err) {
                        console.error(`[${context}] Error `, err.message);
                    }
                });

            };

            if (image.favicon) {

                let path = `/usr/src/app/img/${folder}${brandName}_favicon.png`;
                favicon = pathImage + '_favicon.png'
                let base64Image;

                if (image.favicon.includes("base64"))
                    base64Image = image.favicon.split(';base64,').pop();
                else
                    base64Image = image.favicon;

                //console.log("path favicon", path);

                fs.writeFile(path, base64Image, { encoding: 'base64' }, function (err, result) {
                    if (err) {
                        console.error(`[${context}] Error `, err.message);
                    }
                });

            };

            if (image.walletIcon) {

                let path = `/usr/src/app/img/${folder}${brandName}_walletIcon.svg`;
                walletIcon = pathImage + '_walletIcon.svg'
                let base64Image;

                if (image.walletIcon.includes("base64"))
                    base64Image = image.walletIcon.split(';base64,').pop();
                else
                    base64Image = image.walletIcon;

                //console.log("path walletIcon", path);

                fs.writeFile(path, base64Image, { encoding: 'base64' }, function (err, result) {
                    if (err) {
                        console.error(`[${context}] Error `, err.message);
                    }
                });

            };

            if (image.logo) {

                let path = `/usr/src/app/img/${folder}${brandName}_logo.svg`;
                logo = pathImage + '_logo.svg'
                let base64Image;

                if (image.logo.includes("base64"))
                    base64Image = image.logo.split(';base64,').pop();
                else
                    base64Image = image.logo;

                //console.log("path logo", path);

                fs.writeFile(path, base64Image, { encoding: 'base64' }, function (err, result) {
                    if (err) {
                        console.error(`[${context}] Error `, err.message);
                    }
                });

            };

            resolve({
                principalIcon: principalIcon,
                favicon: favicon,
                walletIcon: walletIcon,
                logo: logo,
                mapIcons: mapIcons,
                cards: cards,
                qrcodeIcon: qrcodeIcon
            });

        });
    },
    getQrcodeImage: function (qrcodeIcon) {
        const context = "Function getQrcodeImage";
        return new Promise(async (resolve, reject) => {

            let response = []

            console.log("qrcodeIcon", qrcodeIcon);
            Promise.all(
                qrcodeIcon.map((qrcode, index) => {
                    return new Promise((resolve, reject) => {

                        let image = qrcode.split('/');

                        let path = `/usr/src/app/img/${image[3]}/${image[4]}`;
                        console.log("path", path);

                        fs.readFile(path, 'base64', (err, result) => {
                            if (err) {
                                console.error(`[${context}] Error `, err.message);
                                reject(err);
                            }
                            response.push(result)
                            resolve()
                        });
                    });
                })
            ).then(() => {
                resolve(response);
            }).catch((error) => {
                console.error(`[${context}] Error `, error.message);
                reject(error);
            })

            /*let image = qrcodeIcon.split('/');

            let path = `/usr/src/app/img/${image[3]}/${image[4]}`;
            console.log("path", path);

            fs.readFile(path, 'base64', (err, result) => {
                if (err) {
                    console.error(`[${context}] Error `, err.message);
                    reject(err);
                }

                resolve(result)
            });*/
        });
    }
}