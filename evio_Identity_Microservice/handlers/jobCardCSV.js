// Disable node-cron by mocking for an easy turn-back 
// const cron = require('node-cron'); 
const cron = {
    schedule: ()=>({
     start: ()=>{},
     stop: ()=>{},   
     validate: ()=>{},
     status: '',
    })
};
const csvWriter = require('csv-writer').createObjectCsvWriter
const Path = require('path')
const Nodemailer = require('nodemailer')
const fs = require("fs");

// bd 
const Job = require('../models/jobs')
const Cards = require('../models/cards')

function getSantogalCards() {
    const context = "[ jobCardCSV getSantogalCards ]"
    return new Promise((resolve, reject) => {
        try {
            let query = {
                cardNumber: { $regex: '^'.concat(String(process.env.SantogalCardsBegin)) }
            }
            Cards.find(query, { cardNumber: 1, activationDate: 1, inUse: 1, _id: 0 }).then(function (listCards) {
                resolve(listCards)

            }).catch(function (error) {
                console.log(`${context} Error : `, error);
                reject(error.message);
            })
        } catch (error) {
            console.log(`${context} Error : `, error);
            reject(error.message);
        }
    })
}

function appendLeadingZeroes(number) {
    const context = "[ jobCardCSV appendLeadingZeroes ]"
    try {
        if (number <= 9) {
            return "0" + number;
        }
        return number
    } catch (error) {
        console.log(`${context} Error : `, error);
        return number
    }

}

function getFormatedDate(date) {
    const context = "[ jobCardCSV getFormatedDate ]"
    try {
        if (date.getMonth === 'function') {
            console.log(`${context} Error : input value must be Date`);
            return null
        }
        return String(appendLeadingZeroes(date.getDate()) + "-" + appendLeadingZeroes(date.getMonth() + 1) + "-" + date.getFullYear())
    } catch (error) {
        console.log(`${context} Error : `, error);
        return null
    }
}

function createCSVFile(arrayCards) {
    const context = "[ jobCardCSV createCSVFile ]"
    return new Promise((resolve, reject) => {
        try {
            if (!arrayCards || !Array.isArray(arrayCards)) {
                console.log(`${context} Error - Missing/Wrong Input data`, arrayCards)
                return reject("Missing/Wrong Input data")
            }
            let date = new Date()
            let csvFileName = '/cards_santogal_'.concat(date.toISOString().split('T')[0]).concat('.csv')
            // create the headers of the file

            let path = Path.join(__dirname, '..', 'csv')
            const csvFile = csvWriter({
                path: String(path).concat(csvFileName),
                encoding: 'ascii',
                fieldDelimiter: ';',
                header: [
                    { id: 'cardNumber', title: 'Nº do Cartão​' },
                    { id: 'activationDate', title: 'Data de ativação' }
                ]
            })
            // format the data 
            let data = []
            for (let cards of arrayCards) {

                let dateActivation = ''
                if (cards.activationDate) {
                    // format the date to the desire format
                    let cardDate = getFormatedDate(new Date(cards.activationDate))
                    if (!cardDate) {
                        console.log(`${context} Error - Getting the date for a card`);
                        return reject('Error Getting the date for a card');
                    }
                    dateActivation = cardDate
                } else if (cards.inUse && !cards.activationDate) {
                    // just in case of some mistake
                    dateActivation = '(cartão ativo mas sem data de ativação)'
                }
                data.push({
                    cardNumber: cards.cardNumber,
                    activationDate: dateActivation
                })
            }
            csvFile.writeRecords(data).then(function (fileWriten) {
                console.log('New csv created for cards Santogal ...');
                resolve({ filePath: String(path).concat(csvFileName), status: true })
            }).catch(function (error) {
                console.log(`${context} Error : `, error);
                reject(error.message);
            })

        } catch (error) {
            console.log(`${context} Error : `, error);
            reject(error.message);
        }
    })
}

function sendSantogalCSV(filePath) {
    const context = "[ jobCardCSV sendSantogalCSV ]"
    return new Promise((resolve, reject) => {
        if (!filePath) {
            console.log(`${context} Error - Missing/Wrong Input data`, arrayCards)
            return reject("Missing/Wrong Input data")
        }
        if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === 'pre-production' ) return resolve(true)

        let date = getFormatedDate(new Date())
        if (!date) {
            console.log(`${context} Error - Getting the date for a email`);
            return reject('Error Getting the date for email');
        }
        let email = process.env.NODE_ENV === "production" ? process.env.SantogalEmailClient : process.env.EMAIL5
        let bodytext = '<p> Em anexo encontra-se um ficheiro com os estados dos cartões à data deste email </p>'

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
        let subject = "Lista de cartões Santogal a ".concat(date)
        let mailOptions = {
            source: '"evio Support" <support@go-evio.com>',
            from: '"evio Support" <support@go-evio.com>', // sender address
            to: email,
            cc: process.env.NODE_ENV === "production" ? process.env.SantogalEmailCCList : '',
            subject: subject,
            text: '', // plaintext body
            html: bodytext,
            attachments: [{ path: filePath }]
        };
        transporter.sendMail(mailOptions, function (error, info) {
            if (error) console.error(`${context} Error `, error.message);
            else console.error(`${context} Email sent: `, info.response);

            transporter.close()
        });
        resolve(true)
    })
}


function getJobListCSV() {
    const context = "[ jobCardCSV getJobListCSV]"
    return new Promise((resolve, reject) => {
        try {
            let query = {
                name: process.env.CSVJOBNAME
            }
            Job.findOne(query).then(function (job) {
                resolve(job)

            }).catch(function (error) {
                console.log(`${context} Error : `, error);
                reject(error.message);
            })
        } catch (error) {
            console.log(`${context} Error : `, error);
            reject(error.message);
        }
    })
}

async function createCSVForSantogal() {
    const context = "[ jobCardCSV createCSVForSantogal]"
    return new Promise((resolve, reject) => {
        try {

            getSantogalCards().then(function (listCards) {
                if (!listCards || !Array.isArray(listCards)) {
                    console.log(`${context} Error : listCards is not an array `, listCards);
                    reject('listCards is not an array');
                }

                createCSVFile(listCards).then(function (fileCreated) {
                    if (!fileCreated?.status || !fileCreated?.filePath) {
                        console.log(`${context} Error : createCSVFile return null `, fileCreated);
                        reject('createCSVFile return null');
                    }

                    resolve(fileCreated)

                }).catch(function (error) {
                    console.log(`${context} Error : `, error);
                    reject(error.message ? error.message : error);
                })

            }).catch(function (error) {
                console.log(`${context} Error : `, error);
                reject(error.message ? error.message : error);
            })

        } catch (error) {
            console.log(`${context} Error : `, error);
            reject(error.message);
        }
    })
}

function deleteOldCSVFilesSantogal() {
    const context = "[ jobCardCSV deleteOldCSVFilesSantogal ]"
    return new Promise((resolve, reject) => {
        try {
            const directory = Path.join(__dirname, '..', 'csv')
            // checks if folder exists 
            if (!fs.existsSync(directory)) {
                fs.mkdirSync(directory)
                // since folder didn't exist we don't need to delete anything
                return resolve(true)
            }

            fs.readdir(directory, (err, files) => {
                if (err) throw err;

                let regex = new RegExp('^cards_santogal*')
                for (let file of files) {
                    if (regex.test(file)) {
                        fs.unlink(Path.join(directory, file), (err) => {
                            if (err) throw err;
                        })
                    }
                }
                resolve(true)
            })
        } catch (error) {
            console.log(`${context} Error : `, error);
            reject(error.message)
        }
    })
}


function updateJobCardSantogal() {
    const context = "[ jobCardCSV updateJobCardSantogal]"
    return new Promise((resolve, reject) => {
        try {

            Job.findOneAndUpdate({ name: process.env.CSVJOBNAME }, { $set: { lastRun: new Date() } }).then(function (updated) {
                if (updated) resolve(true)
                else reject('Fail to update Job Card Santogal')

            }).catch(function (error) {
                console.log(`${context} Error : `, error);
                reject(error.message);
            })
        } catch (error) {
            console.log(`${context} Error : `, error);
            reject(error.message ? error.message : error);
        }
    })

}

module.exports = {
    startCardsJob: function () {
        const context = "[ jobCardCSV startCardsJob]"
        return new Promise((resolve, reject) => {
            try {
                getJobListCSV().then(function (job) {
                    if (!job) {
                        // first Run
                        job = {
                            name: process.env.CSVJOBNAME,
                            jobTimer: '0 3 * * *'
                        }
                        Job.create(job).then(function (newJob) {
                            if (!newJob) {
                                console.log(`${context} - Error updating Jobs: `, err)
                                reject(false)
                            }
                            console.log(`New Job ${process.env.CSVJOBNAME} was created ...`)
                        }).catch(function (error) {
                            console.log(`${context} Error : `, error);
                            reject(error.message ? error.message : error);
                        })
                    }
                    if (!job.jobTimer) {
                        console.log(`${context} Error : No jobTimer`)
                        reject("No jobTimer")
                    }

                    let cardCronTask = cron.schedule(job.jobTimer, () => {
                        console.log("Starting Card Santogal Job ...")
                        deleteOldCSVFilesSantogal().then(function (isAllDeleted) {
                            if (!isAllDeleted) {
                                console.error(`${context} - Error not all filles where deleted`)
                            }

                            createCSVForSantogal().then(function (file) {
                                if (!file?.filePath || !file?.status) {
                                    console.log(`${context} Error : No file was generated !!`, file);
                                    return reject(false)
                                }

                                // send the file by email 
                                sendSantogalCSV(file.filePath).then(function (sendedEmail) {
                                    if (!sendedEmail) {
                                        console.log(`${context} Error : It was not sent the email !!!`, sendedEmail)
                                        return reject('It was not sent the email')
                                    }

                                    updateJobCardSantogal().then(function (updated) {
                                        if (!updated) console.log(`${context} Error - Fail to update Card Santogal job`)
                                        else console.log(`${context} - Card Santogal job updated successfully`)

                                        console.log("Finishing Card Santogal Job ...")
                                    })

                                }).catch(function (error) {
                                    console.log(`${context} Error : `, error);
                                    reject(error.message ? error.message : error);
                                })

                            }).catch(function (error) {
                                console.log(`${context} Error : `, error);
                                reject(error.message ? error.message : error);
                            })
                        }).catch(function (error) {
                            console.log(`${context} Error : `, error);
                            reject(error.message ? error.message : error);
                        })

                    }, {
                        scheduled: false
                    });

                    cardCronTask.start()
                    resolve(true)
                }).catch(function (error) {
                    console.log(`${context} Error : `, error);
                    reject(error.message ? error.message : error);
                })
                // check if is first run 


            } catch (error) {
                console.log(`${context} Error : `, error);
                reject(error.message);
            }
        })
    }
}