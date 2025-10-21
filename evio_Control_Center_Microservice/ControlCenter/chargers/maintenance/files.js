const Utils = require('../../../utils')
const fs = require('fs');

module.exports = {
    upload: (req,res) => uploadFile(req,res),
    update: (req,res) => updateFile(req,res),
    remove: (req,res) => removeChargerFile(req,res),
};

async function uploadFile(req,res) {
    let context = "Function uploadFile";
    try {
        if (validateFields(req.body,req.headers['isadmin'])) return res.status(400).send(validateFields(req.body,req.headers['isadmin']))
        let cpoUserId = req.headers['isadmin'] ? req.body.ownerId : req.headers['userid']
        let created = await createFile(req.body , cpoUserId)
        if (created) {
            console.log(JSON.stringify(created))
            let host = process.env.HostChargers + process.env.PathUploadFile
            let response = await Utils.postRequest(host , created)
            if (response.success) {
                return res.status(200).send(response.data.files)
            } else {
                return res.status(500).send({ auth: true, code: '', message: response.error })
            }
        } else {
            return res.status(500).send({ auth: true, code: '', message: 'File not uploaded' })
        }

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

function validateFields(fileInfo , isAdmin) {
    const context = "Function validateFields"
    try {
        let validFields = [
            "fileExtension",
            "content",
            "name",
            "type",
            "ownerId",
            "chargerId",
        ]
        if (!fileInfo) {
            return { auth: false, code: 'server_fileInfo_required', message: 'fileInfo data is required' }
        } else if (!fileInfo.content) {
            return { auth: false, code: 'server_content_required', message: 'content is required' }
        } else if (!fileInfo.name) {
            return { auth: false, code: 'server_name_required', message: 'name is required' }
        } else if (!fileInfo.type) {
            return { auth: false, code: 'server_type_required', message: 'type is required' }
        } else if (!fileInfo.chargerId) {
            return { auth: false, code: 'server_chargerId_required', message: 'chargerId is required' }
        } else if (!fileInfo.fileExtension) {
            return { auth: false, code: 'server_fileExtension_required', message: 'fileExtension is required' }
        } else if (isAdmin && !fileInfo.ownerId) {
            return { auth: false, code: 'server_ownerId_required', message: 'ownerId is required' }
        } else {
            let notAllowedKey = Object.keys(fileInfo).find(key => !validFields.includes(key))
            if (notAllowedKey) {
                return { auth: false, code: `server_${notAllowedKey}_invalid`, message: `${notAllowedKey} can't be sent` }
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { auth: false, code: '', message: error.message}
    }
};

async function createFile(fileInfo , userId) {
    const context = "Function createFile"
    try {
        let splitString64 = fileInfo.content.split(';base64,')
        let base64Input = splitString64.pop()
        let base64InfoArray = splitString64[0].split('/')
        let extension = Utils.getBase64Extension(base64InfoArray[0] , base64InfoArray[1] , fileInfo.fileExtension)
        if (!extension) {
            return null
        } else {
            let name = `${fileInfo.name.replace(/\s+/g, '_')}${extension}`
            let dateNow = Date.now();

            let path = `/usr/src/app/controlcenter/files/${userId}_${dateNow}_${name}`;
            let pathFile = '';
            if (process.env.NODE_ENV === 'production') {
                pathFile = `${process.env.HostProd}/controlcenter/files/${userId}_${dateNow}_${name}`; // For PROD server
            }
            else if (process.env.NODE_ENV === 'pre-production') {
                pathFile = `${process.env.HostPreProd}/controlcenter/files/${userId}_${dateNow}_${name}`; // For Pre PROD server
            }
            else {
                // pathFile = `${process.env.HostLocal}/controlcenter/files/${userId}_${dateNow}_${name}`; // For local host
                pathFile = `${process.env.HostQA}/controlcenter/files/${userId}_${dateNow}_${name}`;// For QA server
            };


            fs.writeFileSync(path, base64Input, { encoding: 'base64' });
            fileInfo.content = pathFile
            return fileInfo
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    }
}

function validateFieldsUpdate(fileInfo , isAdmin) {
    const context = "Function validateFieldsUpdate"
    try {
        let validFields = [
            "fileExtension",
            "content",
            "name",
            "type",
            "ownerId",
            "chargerId",
            "fileId",
        ]
        if (!fileInfo) {
            return { auth: false, code: 'server_fileInfo_required', message: 'fileInfo data is required' }
        } else if (!fileInfo.content) {
            return { auth: false, code: 'server_content_required', message: 'content is required' }
        } else if (!fileInfo.name) {
            return { auth: false, code: 'server_name_required', message: 'name is required' }
        } else if (!fileInfo.type) {
            return { auth: false, code: 'server_type_required', message: 'type is required' }
        } else if (!fileInfo.chargerId) {
            return { auth: false, code: 'server_chargerId_required', message: 'chargerId is required' }
        } else if (!fileInfo.fileId) {
            return { auth: false, code: 'server_fileId_required', message: 'fileId is required' }
        } else if (!fileInfo.fileExtension) {
            return { auth: false, code: 'server_fileExtension_required', message: 'fileExtension is required' }
        } else if (isAdmin && !fileInfo.ownerId) {
            return { auth: false, code: 'server_ownerId_required', message: 'ownerId is required' }
        } else {
            let notAllowedKey = Object.keys(fileInfo).find(key => !validFields.includes(key))
            if (notAllowedKey) {
                return { auth: false, code: `server_${notAllowedKey}_invalid`, message: `${notAllowedKey} can't be sent` }
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { auth: false, code: '', message: error.message}
    }
};

async function updateFile(req,res) {
    let context = "Function updateFile";
    try {
        if (validateFieldsUpdate(req.body,req.headers['isadmin'])) return res.status(400).send(validateFieldsUpdate(req.body,req.headers['isadmin']))
        let cpoUserId = req.headers['isadmin'] ? req.body.ownerId : req.headers['userid']

        let foundCharger = await Utils.findChargerById(req.body.chargerId)
        if (foundCharger) {
            removeFile(foundCharger.files , req.body.fileId)
            let created = await createFile(req.body , cpoUserId)
            if (created) {
                let host = process.env.HostChargers + process.env.PathUploadFile
                let response = await Utils.putRequest(host , created)
                if (response.success) {
                    return res.status(200).send(response.data.files)
                } else {
                    return res.status(500).send({ auth: true, code: '', message: response.error })
                }
            } else {
                return res.status(500).send({ auth: true, code: '', message: 'File not uploaded' })
            }
        } else {
            return res.status(400).send({ auth: false, code: '', message: 'Charger does not exist' })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}


function removeFile(files , fileId) {
    var context = "Function removeFile";
    try {
        let file = files.find(file => file._id === fileId).content.split('/');
        const path = `/usr/src/app/controlcenter/files/${file[file.length - 1]}`;
        fs.unlinkSync(path)

    }
    catch (error) {
        console.error(`[${context}] Error `, error.message);
    };
};

function validateFieldsRemove(fileInfo) {
    const context = "Function validateFieldsRemove"
    try {
        let validFields = [
            "ownerId",
            "chargerId",
            "fileId",
        ]
        if (!fileInfo) {
            return { auth: false, code: 'server_fileInfo_required', message: 'fileInfo data is required' }
        } else if (!fileInfo.chargerId) {
            return { auth: false, code: 'server_chargerId_required', message: 'chargerId is required' }
        } else if (!fileInfo.fileId) {
            return { auth: false, code: 'server_fileId_required', message: 'fileId is required' }
        } else {
            let notAllowedKey = Object.keys(fileInfo).find(key => !validFields.includes(key))
            if (notAllowedKey) {
                return { auth: false, code: `server_${notAllowedKey}_invalid`, message: `${notAllowedKey} can't be sent` }
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { auth: false, code: '', message: error.message}
    }
};

async function removeChargerFile(req,res) {
    let context = "Function removeChargerFile";
    try {
        if (validateFieldsRemove(req.body)) return res.status(400).send(validateFieldsRemove(req.body))
        let foundCharger = await Utils.findChargerById(req.body.chargerId)
        if (foundCharger) {
            removeFile(foundCharger.files , req.body.fileId)
            let host = process.env.HostChargers + process.env.PathUploadFile
            let response = await Utils.patchRequest(host ,req.body )
            if (response.success) {
                return res.status(200).send(response.data.files)
            } else {
                return res.status(500).send({ auth: true, code: '', message: response.error })
            }
        } else {
            return res.status(400).send({ auth: false, code: '', message: 'Charger does not exist' })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}