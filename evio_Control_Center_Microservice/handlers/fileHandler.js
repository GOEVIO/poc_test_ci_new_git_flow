require("dotenv-safe").load();
const fs = require('fs');
const path = require('path');
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

let task;

module.exports = {

    fileHandler: async function (req, res) {
        var context = "Function fileHandler";
        fileHandlerNGNIX()
    },
    startTask : function() {
        var context = "Function startTask";

        var timer = "38 2 * * *";
    
        try {
    
            initJobReadNewFiles(timer).then(() => {
    
                console.log("Read new files NGINX Job Started")
    
                task.start();
                return 'Read new files NGINX Job Started';
            });
        }
        catch (error) {
            console.error(`[${context}] Error `, error);
        };
    },
    statusTask : function() {
        var context = "Function statusTask";

        try {
            var status = "Stopped";
            if (task != undefined) {
                status = task.status;
            }
    
            return { "Read new files NGINX Job Status": status };
        }
        catch (error) {
            console.error(`[${context}] Error `, error);
        };
    },
    stopTask : function() {
        var context = "Function stopTask";

        try {
            task.stop();
            console.log("Read new files NGINX Job Stopped")
            return 'Read new files NGINX Job Stopped';
        }
        catch (error) {
            console.error(`[${context}] Error `, error);
        };
    }
}

async function getFileIndex(fileName, directoryPathPremanentFiles) {
    var context = "Function getFileIndex";
    try {
        return new Promise(async (resolve, reject) => {
            let fileIndex = 1;

            fs.readdir(directoryPathPremanentFiles, async function (err, files) {
                if (err) {
                    reject()
                }
                files.forEach(function (file) {
                    if (file.includes(fileName)) {
                        fileIndex = fileIndex + 1;
                    }
                });
                resolve(fileIndex)
            });
        });
    }
    catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

function initJobReadNewFiles(timer) {
    var context = "Function initJobReadNewFiles";
    return new Promise((resolve, reject) => {

        task = cron.schedule(timer, () => {

            console.log('Running Job read new files NGINX');


            fileHandlerNGNIX()
        }, {
            scheduled: false
        });

        resolve();

    });
};

function fileHandlerNGNIX() {
    return new Promise((resolve, reject) => {
        try {
            let directoryPathPremanentFiles = path.join(__dirname, process.env.finalFilesPath);
            let directoryPath = path.join(__dirname, process.env.tempFilesPath);

            //let finalFileName = req.params.fileName

            //passsing directoryPath and callback function
            fs.readdir(directoryPath, function (err, files) {
                //handling error
                if (err) {
                    console.log(`[${context}] Error ` + err);
                    reject(err)
                }

                //listing all files using forEach
                files.forEach(function (file) {

                    //fs.chmod(file, 0o777, () => {
                    fs.readFile(directoryPath + "/" + file, 'utf8', async (err, data) => {
                        if (err) {
                            console.log(err);
                        }
                        else {
                            let fileNameStart = 'filename="'

                            let trueIndex = data.match(fileNameStart).index + fileNameStart.length

                            let fileName = "";
                            for (let i = trueIndex; data[i] != '"'; i++) {
                                fileName += data[i]
                            }

                            //if (fileName == finalFileName) {
                                //Give the correct index to the file (repeated files are saved with a increace in index)
                                let fileIndex = await getFileIndex(fileName, directoryPathPremanentFiles);

                                //Parse Data to only include the file
                                let partsOfData = data.split("Content-Type: application/octet-stream")

                                let ParsedData = partsOfData[partsOfData.length - 1].split("----------------------------")

                                //Write the file 
                                fs.writeFile(directoryPathPremanentFiles + "/" + fileName + "_" + fileIndex, ParsedData[0], (err) => {
                                    if (err)
                                        throw err;
                                    else {
                                        console.log("Final File: " + fileName + "_" + fileIndex)

                                        fs.unlink(directoryPath + "/" + file, (err) => {
                                            if (err)
                                                throw err;
                                        });

                                        resolve()
                                    }
                                });
                            //}
                        }
                    });
                    //});
                });
            });

            resolve()
        }
        catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error)
        }
    });
}