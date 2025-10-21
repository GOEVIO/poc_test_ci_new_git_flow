const Ldap = require('./ldap');
var User = require('../../models/user');
const Validator = require('email-validator');
const validTokens = require('../authenticationTokens/validTokens')
const ValidToken = require('../../models/validTokens')

module.exports = {
    login: (req,res) => loginUser(req,res),
    logout: (req,res) => logoutUser(req,res),
}

async function loginUser(req, res) {
    let context = "POST /api/private/controlcenter/login Function loginUser";
    try {
        let {email , password} = req.body
        if (validateFields(email , password)) return res.status(400).send(validateFields(email , password))

        let userFound = await getUserByEmail(email)    
        if (userFound) {
            ldapAuthentication(req,res,userFound,password)
        }
        else {
            return res.status(400).send({ auth: false, code: 'server_users_not_found', message: "Users not found for given parameters" });
        };
        
    } catch (error) {
        console.log(`[${context}] Error`, error.message);
        return res.status(500).send(error.message);
    }
}

async function ldapAuthentication(req,res,userFound,password) {
    const context = "Function ldapAuthentication"
    try {
        const controller = Ldap();
        let email =  userFound.email + "_controlcenter"
        let encriptedPassword = User.getEncriptedPassword(password)
        controller.authenticate(email, encriptedPassword)
        .then((result) => {
            let permissionModules = userFound.permissionModules.toJSON()
            delete req.body.password;
            delete permissionModules._id 
            if (userFound.active) {
                req.body._id = userFound._id;
                req.body.language = userFound.language;
                req.body.name = userFound.name;
                req.body.active = userFound.active;
                req.body.clientType = userFound.clientType;
                req.body.imageContent = userFound.imageContent;
                req.body.permissionModules = buildPermissionModulesArray(permissionModules);
                validTokens.authenticate(req, res);
            }
            else {
                return res.status(400).send({ auth: false, code: 'server_user_not_active', message: "Activate your account using the activation code.", _id: userFound._id, active: false });
            };
        })
        .catch(error => {
            if (error.code == 49) {
                return res.status(400).send({ auth: false, code: 'server_invalid_credentials', message: error.message });
            }
            else {
                console.error(`[${context}][authenticate] Error `, error.message);
                return res.status(500).send(error.message);
            };
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

function validateFields(email , password) {
    const context = "Function validateFields"
    try {
        if (!email) {
            return { auth: false, code: 'server_email_not_valid', message: "Email not valid" }
        } else if (!password) {
            return { auth: false, code: 'server_invalid_password', message: 'Invalid password' }
        } else if (!Validator.validate(email)) {
            return { auth: false, code: 'server_email_not_valid', message: "Email not valid" }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { auth: false, code: '', message: error.message}
    }
};

async function getUserByEmail(email) {
    const context = "Function getUserByEmail"
    try {
        let query = {
            email: email,
            active: true,
            blocked : false
        };

        let fields = {
            email : 1,
            active: 1,
            name : 1,
            language : 1,
            _id : 1,
            permissionModules : 1,
            clientType : 1,
            imageContent : 1,
        };
        
        return await User.findOne(query, fields)
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    }
}

async function logoutUser(req,res) {
    var context = "POST /api/private/controlcenter/logout - Function logoutUser";
    try {

        let token = req.headers['token'];
        let refreshtoken = req.headers['refreshtoken'];

        let query = {
            "listOfTokens.token": token
            //"listOfTokens.refreshtoken": refreshtoken
        };

        let newValues = {
            $set: {
                "listOfTokens.$.active": false
            }
        };

        let updatedToken = await ValidToken.findOneAndUpdate(query,newValues)
        if (updatedToken) {
            return res.status(200).send({ auth: true, code: 'server_successful_logout', message: "Successful logout" });
        } else {
            return res.status(400).send({ auth: false, code: '', message: "Unsuccessful logout" });
        }
    } catch (error) {
        console.log(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    }; 
}

function buildPermissionModulesArray(permissionModulesObj) {
    const context = "Function buildPermissionModulesArray"
    try {
        return Object.keys(permissionModulesObj).map(key => buildPermissionModuleInfo(key , permissionModulesObj[key]))
    } catch (error) {
        return []
    }
}
function buildPermissionModuleInfo(moduleName , moduleValue) {

    return {
        permission : moduleValue.permission,
        title : `permissionModule_${moduleName}_title`,
        description : `permissionModule_${moduleName}_description`,
        path : moduleValue.modulePathName,
    }
}