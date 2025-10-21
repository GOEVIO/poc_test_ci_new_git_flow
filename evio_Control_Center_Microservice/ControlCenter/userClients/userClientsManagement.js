const { Services } = require('evio-library-commons').default;
var User = require('../../models/user');
var usersManagement = require('../users/usersManagement');
const axios = require('axios');
const Ldap = require('../users/ldap');
const MongoDb = require('../users/mongo');
const fs = require('fs');
const Utils = require('../../utils');
const tariffCeme = require('../tariffs/cemeTarrifs')
const toggle = require('evio-toggle').default;
const { Enums } = require('evio-library-commons').default; 

module.exports = {
    create: (req, res) => createUserClients(req, res),
    get: (req, res) => getUserClients(req, res),
    delete: (req, res) => deleteUserClients(req, res),
    updateUser: (req, res) => updateUserClients(req, res),
    updateUserBillingProfile: (req, res) => updateUserClientsBillingProfile(req, res),
    blockUser: (req, res) => blockUserClients(req, res),
    unlockUser: (req, res) => unlockUserClients(req, res),
    getTINClassification: (req, res) => getTINClassification(req, res),
}


async function createUserClients(req, res) {
    const context = "POST /api/private/controlcenter/usersClients - Function createUserClients"
    try {
        let userClient = req.body
        let isAdmin = req.headers['isadmin']
        if (await validateFields(userClient, req.headers['clienttype'], isAdmin)) return res.status(400).send(await validateFields(userClient, req.headers['clienttype'], isAdmin))
        let cpoUserId = isAdmin ? userClient.ownerId : req.headers['userid']
        defineUserClientObject(userClient, cpoUserId)
        createUser(cpoUserId, userClient, res)
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

async function validateFields(userClient, clientType, isAdmin) {
    const context = "Function validateFields"
    const tinRegex = /^(?![-])(?!.*[-]$)(?!.*[-]{2})[0-9-]{9}$/g
    
    const featureFlagEnabledTIN = await toggle.isEnable('bp-287-removing-tin-validation');
    
    try {
        let regexPasswordValidation = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@_$!%*?&])[A-Za-z\d@_$!%*?&]{8,}$/
        if (!userClient) {
            return { auth: false, code: 'server_user_required', message: 'User data is required' }
        } else if (!userClient.email) {
            return { auth: false, code: 'server_email_required', message: 'Email is required' }
        } else if (!userClient.name) {
            return { auth: false, code: 'server_name_required', message: 'Name is required' }
        } else if (!userClient.password) {
            return { auth: false, code: 'server_password_required', message: 'Password is required' }
        } else if (!(regexPasswordValidation.test(userClient.password))) {
            return { auth: false, code: 'server_invalid_password', message: "Password is invalid" }
        } else if (!userClient.mobile) {
            return { auth: false, code: 'server_mobile_required', message: 'Mobile phone is required' }
        } else if (!userClient.internationalPrefix) {
            return { auth: false, code: 'server_international_prefix_required', message: 'International mobile prefix is required' }
        } else if (!userClient.country) {
            return { auth: false, code: 'server_country_required', message: 'Country is required' }
        } else if (!userClient.imageContent) {
            return { auth: false, code: 'server_imageContent_required', message: 'imageContent is required' }
        } else if (!userClient.paymentPeriod || !Object.values(Enums.PaymentType).includes(userClient.paymentPeriod)) {
            return { auth: false, code: 'server_paymentPeriod_required', message: 'paymentPeriod is required' }
        } else if (!userClient.language) {
            return { auth: false, code: 'server_language_required', message: 'language is required' }
        } else if (!userClient.billingName) {
            return { auth: false, code: 'server_billingName_required', message: 'billingName is required' }
        } else if (!userClient.billingEmail) {
            return { auth: false, code: 'server_billingEmail_required', message: 'billingEmail is required' }
        } else if (!userClient.billingPeriod || !Object.values(Enums.BillingPeriods).includes(userClient.billingPeriod)) {
            return { auth: false, code: 'server_billingPeriod_required', message: 'billingPeriod is required' }
        } else if (!userClient.billingAddress) {
            return { auth: false, code: 'server_billingAddress_required', message: 'billingAddress is required' }
        } else if (!userClient.billingAddress.city) {
            return { auth: false, code: 'server_billingAddress_city_required', message: 'city is required' }
        } else if (!userClient.billingAddress.zipCode) {
            return { auth: false, code: 'server_billingAddress_zipCode_required', message: 'zipCode is required' }
        } else if (!userClient.billingAddress.country) {
            return { auth: false, code: 'server_billingAddress_country_required', message: 'country is required' }
        } else if (!userClient.billingAddress.addressLineBilling) {
            return { auth: false, code: 'server_billingAddress_street_required', message: 'street is required' }
        } else if (!userClient.nif) {
            return { auth: false, code: 'server_nif_required', message: 'nif is required' }
        } else if (!featureFlagEnabledTIN && String(userClient.billingAddress.countryCode).toUpperCase() !== 'ES' && !tinRegex.test(userClient.nif)) { // FIXME we're skipping spain because of current business needs, please fix this
            return { auth: false, code: 'wrong_server_nif', message: 'nif is expected to have only numbers (0-9), hyphens (-) and be exactly 9 digits long.' }
        } else if (clientType === process.env.ClientTypeB2B) {
            return { auth: false, code: '', message: 'User b2b can not create users' }
        } else if (isAdmin && !userClient.ownerId) {
            return { auth: false, code: 'server_ownerId_required', message: 'ownerId is required' }
        }

        if(userClient.bankTransferEnabled === null || typeof userClient.bankTransferEnabled === 'undefined') {
            return { auth: false, code: 'server_bankTransferEnabled_required', message: 'Bank transfer option is required' }
        }
        if(!userClient.cemeTariffOption) {
            return { auth: false, code: 'server_cemeTariffId_required', message: 'Ceme tariff is required' }
        }
        if(!userClient.headquartersAddress) {
            return { auth: false, code: 'server_headquartersAddress_required', message: 'Headquarters addtress is required' }
        }

        const missingHeadquartersField = [
            'headquartersAddressBillingCountry',
            'headquartersCity',
            'headquartersCoords',
            'headquartersZipCode',
            'addressLineHeadquarters',
            'headquartersState',
        ].find((field) => !userClient.headquartersAddress[field])

        if(missingHeadquartersField) {
            return { auth: false, code: `server_${missingHeadquartersField}_required`, message: `${missingHeadquartersField} is required` }
        }

        let userFound = await User.findOne({ email: userClient.email }, { email: 1 }).lean()
        if (userFound) {
            return { auth: false, code: 'server_email_exists', message: 'Email already exists' }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { auth: false, code: '', message: error.message }
    }
};

function defineUserClientObject(userClient, cpoUserId) {
    const context = "Function defineUserClientObject"
    try {
        //Add default keys to a user client creation
        userClient.username = userClient.mobile
        userClient.needChangePassword = false
        userClient.isMBRefEnabled = false
        userClient.operatorId = cpoUserId
        userClient.isBankTransferEnabled = userClient.bankTransferEnabled

        delete userClient.bankTransferEnabled
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

async function defineUserControlCenterObject(userClient) {
    const context = "Function defineUserControlCenterObject"

    //Add default keys to a user client control center creation
    let userControlCenter = {
        _id: userClient._id,
        email: userClient.email,
        password: userClient.password,
        name: userClient.name,
        internationalPrefix: userClient.internationalPrefix,
        mobile: userClient.mobile,
        permissionModules: {},
        clientType: process.env.ClientTypeB2B,
        country: userClient.country,
        imageContent: userClient.imageContent,
        active: true,
        cpoDetails: Utils.defaultCpoDetails()
    }
    try {
        userControlCenter = new User(userControlCenter);
        if (userClient.imageContent !== undefined && userClient.imageContent !== null) {
            return await saveImageContent(userControlCenter)
        } else {
            userControlCenter.imageContent = "";
            return userControlCenter
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return new User(userControlCenter)
    }
}

async function createUser(cpoUserId, data, res) {
    const context = "Function createUser";
    try {
        let billingProfile = buildBillingProfileObject(data)
        console.log(`[${context}] billingProfile: ${JSON.stringify(billingProfile)}`)

        removeBillingProfileInfo(data)
        const cemeTariffOption = data.cemeTariffOption
        buildReferencePlaces(data)

        let resp = await createUserCompany(data)
        console.log(`[${context}] createUserCompany ${JSON.stringify({ success: resp?.success, error: resp?.error, code: resp?.code })}}`)

        if (resp.success) {

            let userBillingProfile = await getBillingProfile({ userId: resp.data._id })
            if (userBillingProfile == null){
                console.log(`Missing billing profile for user ${resp.data._id}`,userBillingProfile);
                return res.status(400).send({ auth: false, code: 'server_error', message: 'Missing billing profile' })
            }
            delete userBillingProfile.invoiceWithoutPayment
            delete userBillingProfile?.email

            await updateBillingProfile({ ...userBillingProfile, ...billingProfile })
            let userControlCenter = await defineUserControlCenterObject({ ...data, _id: resp.data._id })
            await addUser(userControlCenter)
            await addUserClientToList(cpoUserId, resp.data._id, userControlCenter._id)
            await tariffCeme.patchUser(cemeTariffOption, resp.data._id)
            return res.status(200).send(resp.data)
        } else {
            return res.status(400).send({ auth: false, code: resp.code, message: resp.error })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

async function addUserClientToList(cpoUserId, userClientId, userControlCenterId) {
    const context = "Function addUserClientToList"
    try {
        await User.findOneAndUpdate({ _id: cpoUserId }, { $push: { clients: { userId: userClientId, controlCenterUserId: userControlCenterId } } }).lean()
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}


async function getUserClients(req, res) {
    const context = "GET /api/private/controlcenter/usersClients - Function getUserClients"
    try {
        let cpoUserId = req.headers['userid']
        let ownerId = req.query.ownerId
        // let {clientsList , owner } = await getUserClientsList(cpoUserId)
        let userClientsListArray = await getUserClientsList(cpoUserId, req.headers['isadmin'], ownerId)
        // getUsers(clientsList , owner , res)
        getUsers(userClientsListArray, res)
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

async function getUserClientsList(cpoUserId, isAdmin, ownerId) {
    const context = "Function getUserClientsList"
    try {
        let usersFound = await User.find(!isAdmin ? { _id: cpoUserId, active: true } : (ownerId ? { _id: ownerId, active: true } : { active: true }), { _id: 1, "clients": 1, name: 1 }).lean()
        return usersFound.map(user => cpoClients(user))
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { clientsList: [], owner: "", _id: "" }
    }
}

async function getUsers(userClientsListArray, res) {
    const context = "Function getUsers";
    try {
        let host = process.env.HostUser + process.env.PathGetControlCenterClients
        let data = {
            _id: { $in: userClientsListArray.map(user => user.clientsList).flat(1) },
            active: true,
        }
        let resp = await axios.get(host, { data })
        if (resp.data) {
            return res.status(200).send(resp.data.map(client => { return { ...client, owner: getCpoObject(userClientsListArray, client).owner, ownerId: getCpoObject(userClientsListArray, client)._id } }))
        } else {
            return res.status(200).send([])
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

const addUser = async (user) => {
    var context = "Function addUser";
    const mongocontroller = MongoDb();
    await mongocontroller.addmongoUser(user)
        .then((result) => {
            const controller = Ldap();
            controller.addldapUser(result)
                .then((user) => {

                    console.log(`User client ${user._id} created on control center`)
                })
                .catch(error => {

                    mongocontroller.deletemongoUser(user);
                    console.log(`User client ${user._id} failed to create on control center`)
                    console.error(`[${context}] Error `, error.message);

                });
        })
        .catch(error => {
            if (error.auth != undefined) {
                console.error(`[${context}] Error `, error);
            }
            else {
                console.error(`[${context}] Error `, error.message);
            };
        });
};

function saveImageContent(user) {
    var context = "Function saveImageContent";
    return new Promise((resolve, reject) => {
        try {

            var dateNow = Date.now();
            var path = `/usr/src/app/img/users/${user._id}_controlcenter_${dateNow}.jpg`;
            var pathImage = '';
            var base64Image = user.imageContent.split(';base64,').pop();
            if (process.env.NODE_ENV === 'production') {
                pathImage = `${process.env.HostProd}/users/${user._id}_controlcenter_${dateNow}.jpg`; // For PROD server
            }
            else if (process.env.NODE_ENV === 'pre-production') {
                pathImage = `${process.env.HostPreProd}/users/${user._id}_controlcenter_${dateNow}.jpg`; // For Pre PROD server
            }
            else {
                //pathImage = `${process.env.HostLocal}${user._id}_controlcenter_${dateNow}.jpg`; // For local host
                pathImage = `${process.env.HostQA}/users/${user._id}_controlcenter_${dateNow}.jpg`;// For QA server
            };
            fs.writeFile(path, base64Image, { encoding: 'base64' }, function (err, result) {
                if (err) {
                    console.error(`[${context}] Error `, err.message);
                    reject(err)
                }
                else {
                    user.imageContent = pathImage;
                    resolve(user);
                };
            });
        }
        catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function buildBillingProfileObject(userClient) {
    const context = "Function buildBillingProfileObject";
    try {
        if (userClient.billingAddress?.addressLineBilling) {
            const {addressLineBilling, ...billingAddress} = userClient.billingAddress
            const [street, number, floor] = addressLineBilling.split(',')
            userClient.billingAddress = { 
                ...billingAddress, 
                street: street?.trim(), 
                number: number?.trim(), 
                floor: floor?.trim() 
            }
        }

        return {
            billingAddress: userClient.billingAddress,
            email: userClient.billingEmail,
            billingName: userClient.billingName,
            invoiceWithoutPayment: userClient.isBankTransferEnabled,
            nif: userClient.nif,
            viesVAT: userClient.viesVAT ,
            billingPeriod: userClient.billingPeriod,
            purchaseOrder: userClient.purchaseOrder,
            companyTaxIdNumber: userClient?.companyTaxIdNumber ?? userClient.nif ?? null,
            publicEntity: userClient?.publicEntity ?? false
        }   
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return {}
    }
}

function buildReferencePlaces(userClient) {
    const context = "Function buildReferencePlaces";
    try {
        if (userClient.headquartersAddress?.addressLineHeadquarters) {
            const {addressLineHeadquarters, ...headquartersAddress} = userClient.headquartersAddress
            const [street, number, floor] = addressLineHeadquarters.split(',')
            userClient.headquartersAddress = { 
                ...headquartersAddress, 
                headquartersStreet: street?.trim(), 
                headquartersDoorNumber: number?.trim(), 
                headquartersFloor: floor?.trim() 
            }
        }

        userClient.referencePlaces = [{

            geometry: {
                type: "Point",
                coordinates: userClient.headquartersAddress.headquartersCoords
            },
            address: {
                city: userClient.headquartersAddress.headquartersCity,
                country: userClient.headquartersAddress.headquartersAddressBillingCountry,
                countryCode: userClient.headquartersAddress.headquartersBillingCountry,
                floor: userClient.headquartersAddress.headquartersFloor,
                number: userClient.headquartersAddress.headquartersDoorNumber,
                state: userClient.headquartersAddress.headquartersState,
                street: userClient.headquartersAddress.headquartersStreet,
                zipCode: userClient.headquartersAddress.headquartersZipCode
            },
            name: process.env.referencePlacesName,
            type: process.env.referencePlacesType
        }]


        delete userClient.headquartersAddress
        delete userClient.cemeTariffOption
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return {}
    }
}

function removeBillingProfileInfo(userClient) {
    delete userClient.billingAddress
    delete userClient.billingEmail
    delete userClient.billingName
    delete userClient.nif
    delete userClient.billingPeriod
    delete userClient.purchaseOrder,
    delete userClient.publicEntity,
    delete userClient.companyTaxIdNumber
}

async function updateBillingProfile(data) {
    const context = "Function updateBillingProfile";
    try {

        console.log("Function updateBillingProfile data:")
        console.log(data)

        let host = process.env.HostUser + process.env.PathBillingProfileUpdate
        let resp = await axios.patch(host, data, { headers: { 'userid': data.userId } })
        if (resp.data) {
            return resp.data
        } else {
            return null
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null;
    }
}

async function getBillingProfile(params) {
    const context = "Function getBillingProfile";
    try {
        let host = process.env.HostUser + process.env.PathBillingProfile
        let resp = await axios.get(host, { params })
        if (resp.data) {
            return resp.data
        } else {
            return null
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null;
    }
}

async function updateUserClients(req, res) {
    const context = "Function updateUserClients"
    try {
        let user = req.body
        if (validateUpdateFields(user)) return res.status(400).send(validateUpdateFields(user))
        let userId = req.body.userId
        let clientName = req.body.clientName
        delete user.userId
        delete user.clientName
        updateUserInfo(user, userId, clientName, res)
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

async function updateUserInfo(data, userId, clientName, res) {
    const context = "Function updateUserInfo";
    try {
        let host = process.env.HostUser + process.env.PathUpdateUser
        let resp = await axios.patch(host, data, { headers: { 'userid': userId, 'clientname': clientName, 'controlCenter': true } })
        if (resp.data) {
            return res.status(200).send(resp.data)
        } else {
            return res.status(400).send({})
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

function validateUpdateFields(userClient) {
    const context = "Function validateUpdateFields"
    try {
        let validFields = [
            "name",
            "country",
            "imageContent",
            "clientName",
            "userId",
            "paymentPeriod",
            "language",
        ]
        if (!userClient) {
            return { auth: false, code: 'server_user_required', message: 'User data is required' }
        } else if (!userClient.userId) {
            return { auth: false, code: 'server_userId_required', message: 'userId is required' }
        } else if (!userClient.clientName) {
            return { auth: false, code: 'server_clientName_required', message: 'clientName is required' }
        } else {
            let notAllowedKey = Object.keys(userClient).find(key => !validFields.includes(key))
            if (notAllowedKey) {
                return { auth: false, code: `server_${notAllowedKey}_invalid`, message: `${notAllowedKey} can't be updated` }
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { auth: false, code: '', message: error.message }
    }
};

async function updateUserClientsBillingProfile(req, res) {
    const context = "Function updateUserClientsBillingProfile"
    try {
        let billingProfileData = req.body
        if (validateUpdateBillingProfileFields(billingProfileData)) return res.status(400).send(validateUpdateBillingProfileFields(billingProfileData))
        let updatedBillingProfile = await updateBillingProfile({ ...billingProfileData, _id: billingProfileData.billingProfileId, email: billingProfileData.billingEmail })
        if (updatedBillingProfile) {
            return res.status(200).send(updatedBillingProfile);
        } else {
            return res.status(500).send({});
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

function validateUpdateBillingProfileFields(userClient) {
    const context = "Function validateUpdateBillingProfileFields"
    try {
        let validFields = [
            "userId",
            "billingName",
            "nif",
            "billingProfileId",
            "billingAddress",
            "billingEmail",
            "billingPeriod",
            "purchaseOrder",
            "viesVAT",
        ]
        if (!userClient) {
            return { auth: false, code: 'server_user_required', message: 'User data is required' }
        } else if (!userClient.billingProfileId) {
            return { auth: false, code: 'server_billingProfileId_required', message: 'billingProfileId is required' }
        } else if (!userClient.nif) {
            return { auth: false, code: 'server_nif_required', message: 'nif is required' }
        } else if (!userClient.billingAddress) {
            return { auth: false, code: 'server_billingAddress_required', message: 'billingAddress is required' }
        } else if (!userClient.billingName) {
            return { auth: false, code: 'server_billingName_required', message: 'billingName is required' }
        } else if (!userClient.userId) {
            return { auth: false, code: 'server_userId_required', message: 'userId is required' }
        } else if (!userClient.billingEmail) {
            return { auth: false, code: 'server_billingEmail_required', message: 'billingEmail is required' }
        } else if (!userClient.billingPeriod) {
            return { auth: false, code: 'server_billingPeriod_required', message: 'billingPeriod is required' }
        } else {
            let notAllowedKey = Object.keys(userClient).find(key => !validFields.includes(key))
            if (notAllowedKey) {
                return { auth: false, code: `server_${notAllowedKey}_invalid`, message: `${notAllowedKey} can't be updated` }
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { auth: false, code: '', message: error.message }
    }
};

async function deleteUserClients(req, res) {
    const context = "Function deleteUserClients";
    try {
        if (validateFieldsDelete(req.body)) return res.status(400).send(validateFieldsDelete(req.body))
        let deletedUser = await deleteUserInfo(req.body)
        if (deletedUser) {
            deleteUserInfoControlCenter(req.body.userId, res)
        } else {
            return res.status(400).send({ auth: false, code: '', message: 'User not deleted' })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

async function deleteUserInfo(data) {
    const context = "Function deleteUserInfo";
    try {
        let host = process.env.HostUser + process.env.PathDeleteUser
        let resp = await axios.delete(host, { data })
        if (resp.data) {
            return resp.data
        } else {
            return null
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    }
}

async function deleteUserInfoControlCenter(userId, res) {
    const context = "Function deleteUserInfoControlCenter";
    try {
        usersManagement.delete({ headers: { 'userid': userId } }, res)
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

function validateFieldsDelete(userClient) {
    const context = "Function validateFieldsDelete"
    try {
        if (!userClient) {
            return { auth: false, code: 'server_user_required', message: 'User data is required' }
        } else if (!userClient.userId) {
            return { auth: false, code: 'server_userId_required', message: 'userId is required' }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { auth: false, code: '', message: error.message }
    }
};

async function blockUserClients(req, res) {
    const context = "Function blockUserClients"
    try {
        if (validateFieldsDelete(req.body)) return res.status(400).send(validateFieldsDelete(req.body))
        let userId = req.body.userId
        let blockedUser = await blockUserRequest(userId)
        if (blockedUser) {
            await blockUserControlCenter(userId, true)
            return res.status(200).send({ auth: false, code: '', message: 'User blocked' })
        } else {
            return res.status(400).send({ auth: false, code: '', message: 'User not blocked' })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

async function blockUserRequest(userId) {
    const context = "Function blockUserRequest";
    try {
        let host = process.env.HostUser + process.env.PathBlockUser
        let data = {
            key: process.env.StatusMessageInactivate,
            bypassNotification: true
        }
        let resp = await axios.patch(host, data, { headers: { 'userid': userId } })
        if (resp.data) {
            return resp.data
        } else {
            return null
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    }
}

async function blockUserControlCenter(userId, block) {
    const context = "Function blockUserControlCenter";
    try {
        await User.findOneAndUpdate({ _id: userId }, { $set: { blocked: block /*, active : !block */ } }).lean()
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

async function unlockUserClients(req, res) {
    const context = "Function unlockUserClients"
    try {
        if (validateFieldsDelete(req.body)) return res.status(400).send(validateFieldsDelete(req.body))
        let userId = req.body.userId
        let unlockedUser = await unlockUserRequest(userId)
        if (unlockedUser) {
            await blockUserControlCenter(userId, false)
            return res.status(200).send({ auth: false, code: '', message: 'User unlocked' })
        } else {
            return res.status(400).send({ auth: false, code: '', message: 'User not unlocked' })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

async function unlockUserRequest(userId) {
    const context = "Function unlockUserRequest";
    try {
        let host = process.env.HostUser + process.env.PathUnblockUser
        let data = {
            bypassNotification: true
        }
        let resp = await axios.patch(host, data, { headers: { 'userid': userId } })
        if (resp.data) {
            return resp.data
        } else {
            return null
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    }
}

function cpoClients(user) {
    const context = "Function cpoClients"
    try {
        return { clientsList: user.clients.map(client => client.userId), owner: user.name, _id: user._id }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { clientsList: [], owner: user.name, _id: user._id }
    }
}

function getCpoObject(userClientsListArray, client) {
    const context = "Function getCpoObject"
    try {
        return userClientsListArray.find(user => user.clientsList.find(userId => userId === client.userId))
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return {}
    }
}

async function createUserCompany(data) {
    const context = "Function createUserCompany"
    let response = { success: true, data: {}, error: "", code: "" }
    try {
        let host = process.env.HostUser + process.env.PathCreateUserCompany
        let resp = await axios.post(host, data, { headers: { 'clientname': "EVIO" } })
        if (resp.data) {
            return { ...response, data: resp.data.user }
        } else {
            return { ...response, success: false, error: 'User not created' }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        if (error.response) {
            if (error.response.data) {
                return { ...response, success: false, error: error.response.data.message, code: error.response.data.code }
            }
            return { ...response, success: false, error: error.message }
        }
        return { ...response, success: false, error: error.message }

    }
}

async function getTINClassification (req, res) {
    const { countryCode, tin } = req.query;
    const result = await Services.TINValidator.getClassification(countryCode, tin);

    if ('error' in result) {
        return res.status(result.statusCode ?? 500).send(result.error);
    }

    return res.status(200).send(result);
}
