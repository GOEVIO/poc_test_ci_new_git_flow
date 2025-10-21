const ValidToken = require('../../models/validTokens')
const jwt = require('jsonwebtoken');

module.exports = {
    authenticate: (req,res) => tokenAuthentication(req,res),
    checkAuthentication : (requestBody) => checkTokenAuthentication(requestBody),
    disableTokens : (userId) => disableUserTokens(userId),
}

async function tokenAuthentication(req,res) {
    let context = "Function tokenAuthentication";
    try {
        let {name , email , language , _id , permissionModules , clientType , imageContent} = req.body
        let authentication = authenticationConstructor(false, "", "", "", "", "" , "" , "" , "")
        if (email && language && _id) {
            const token = jwt.sign({ _id, email, language }, process.env.TOKEN_SECRET, { expiresIn: process.env.TOKEN_LIFE })
            const refreshToken = jwt.sign({ _id, email, language }, process.env.TOKEN_REFRESH_SECRET, { expiresIn: process.env.TOKEN_REFRESH_LIFE })
            authentication = authenticationConstructor(true, token, refreshToken, _id, "", name , permissionModules , clientType , imageContent);
        }
        saveNewValidToken(authentication, _id,res)
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);;
    }
}

function authenticationConstructor(auth, token, refreshtoken, id, message, name , permissionModules , clientType , imageContent) {
    return {
        auth,
        token,
        refreshtoken,
        message,
        name,
        id,
        permissionModules,
        clientType,
        imageContent,
    }
}



async function saveNewValidToken(authentication, userId , res) {
    var context = "Function saveNewValidToken";
    try {
        let query = {
            userId: userId,
            active: true
        };
    
        let newValues = {
            $push: {
                listOfTokens: {
                    token: authentication.token,
                    refreshtoken: authentication.refreshtoken,
                    active: true
                }
            }
        };
    
        let updatedToken = await ValidToken.findOneAndUpdate(query, newValues).lean()
        if (!updatedToken) {
            let validToken = new ValidToken({
                userId: userId,
                listOfTokens: {
                    token: authentication.token,
                    refreshtoken: authentication.refreshtoken,
                    active: true
                },
                active: true
            });
            await validToken.save()
        }
        return res.status(200).send(authentication);
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
};

async function checkTokenAuthentication(requestBody) {
    let context = "Function tokenAuthentication";
    return new Promise(async (resolve, reject) => {
        try {
            let { token , refreshtoken } = requestBody
            let query = {
                active : true,
                listOfTokens: {
                    $elemMatch: {
                        token: token,
                        active: true
                    }
                }
            };
            let foundToken = await ValidToken.findOne(query).lean()
            if (foundToken) {
                jwt.verify(token, process.env.TOKEN_SECRET, function (err, decoded) {
                    if (err) {
                        console.log(`[${context} jwt verify] Error `, err);
                        reject({ auth: false, token: "", refreshToken: "", message: 'Failed to authenticate token.' + err });
                    };
                    resolve({ auth: true, message: 'Authorized', id: decoded._id, language: decoded.language, email: decoded.email });
                });
            } else {
                reject({ auth: false, code: 'server_user_not_valid', message: "User is not valid" });
            }
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject({ auth: false, code: '', message: error.message });;
        }
    })
}

async function disableUserTokens(userId) {
    let context = "Function disableUserTokens";
        try {
            return await ValidToken.updateMany({userId}, { $set: { active: false } });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return null
        }
}