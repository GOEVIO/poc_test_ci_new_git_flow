var mongoose = require('mongoose');
var mongo = require('mongodb');
require("dotenv-safe").load();

const permissionsModules = mongoose.Schema({
    marketing: {
        permission: {
            type: Boolean,
            default: false
        },
        modulePathName: {
            type: String,
            default : "marketing"
        }
    },
    map: {
        permission: {
            type: Boolean,
            default: false
        },
        modulePathName: {
            type: String,
            default : "map"
        }
    },
    alarmistic: {
        permission: {
            type: Boolean,
            default: false
        },
        modulePathName: {
            type: String,
            default : "alarmistic"
        }
    },
    accountManagement: {
        permission: {
            type: Boolean,
            default: false
        },
        modulePathName: {
            type: String,
            default : "account-management"
        }
    },
    loadBalance: {
        permission: {
            type: Boolean,
            default: false
        },
        modulePathName: {
            type: String,
            default : "load-balance"
        }
    },
    complaints: {
        permission: {
            type: Boolean,
            default: false
        },
        modulePathName: {
            type: String,
            default : "complaints"
        }
    },
    maintenance: {
        permission: {
            type: Boolean,
            default: false
        },
        modulePathName: {
            type: String,
            default : "maintenance"
        }
    },
    monitoring: {
        permission: {
            type: Boolean,
            default: false
        },
        modulePathName: {
            type: String,
            default : "monitoring"
        }
    },
    insights: {
        permission: {
            type: Boolean,
            default: false
        },
        modulePathName: {
            type: String,
            default : "insights"
        }
    },
    ticketing: {
        permission: {
            type: Boolean,
            default: false
        },
        modulePathName: {
            type: String,
            default : "ticketing"
        }
    },
    cpoMobie: {
        permission: {
            type: Boolean,
            default: false
        },
        modulePathName: {
            type: String,
            default : "opc-mobie"
        }
    },
    cpoRoamingGireve: {
        permission: {
            type: Boolean,
            default: false
        },
        modulePathName: {
            type: String,
            default : "roaming-gireve"
        }
    },
    cpoRoamingHubject: {
        permission: {
            type: Boolean,
            default: false
        },
        modulePathName: {
            type: String,
            default : "roaming-hubject"
        }
    },
    interventions: {
        permission: {
            type: Boolean,
            default: false
        },
        modulePathName: {
            type: String,
            default : "interventions"
        }
    },
    csManagement: {
        permission: {
            type: Boolean,
            default: false
        },
        modulePathName: {
            type: String,
            default : "charging-station-management"
        }
    },
    events: {
        permission: {
            type: Boolean,
            default: false
        },
        modulePathName: {
            type: String,
            default : "events"
        }
    },
    cemeMobie: {
        permission: {
            type: Boolean,
            default: false
        },
        modulePathName: {
            type: String,
            default : "ceme-mobie"
        }
    },
    platformManagement: {
        permission: {
            type: Boolean,
            default: false
        },
        modulePathName: {
            type: String,
            default : "platform-management"
        }
    }
});

const cpoDetailsModel = mongoose.Schema({
    party_id: {
        type: String
    },
    country_code: {
        type: String
    },
    name: { type: String },
    network: { type: String },
    networkName: { type: String },
    certified: {
        type: Boolean,
        default: false
    },
    status : { type: String },
    certificationDate : { type: String },
    handshake: {
        type: Boolean,
        default: false
    },
});

const clientsSchema = mongoose.Schema({
    userId: {
        type: String
    },
    controlCenterUserId: {
        type: String
    },
});

// User Schema
var UserSchema = mongoose.Schema(
    {
        email: {
            type: String,
            require: true
        },
        name: {
            type: String,
            require: true
        },
        mobile: {
            type: String,
            require: true
        },
        internationalPrefix: {
            type: String,
            default: "+351"
        },
        password: {
            type: String,
            require: true
        },
        active: {
            type: Boolean,
            default: false
        },
        validated: {
            type: Boolean,
            default: false
        },
        imageContent: {
            type: String
        },
        country: {
            type: String,
            default: "Portugal"
        },
        language: {
            type: String,
            default: "en"
        },
        permissionModules: {
            type: permissionsModules
        },
        // mobieCPODetails: {
        //     type: cpoDetails,
        //     default: {}
        // },
        // gireveCPODetails: {
        //     type: cpoDetails,
        //     default: {}
        // },
        cpoDetails: [{ type: cpoDetailsModel }],
        clients : {
            type : [clientsSchema],
            default : []
        },
        clientType: {
            type: String,
            default: "b2b2c"
        },
        blocked: { 
            type: Boolean, 
            default: false 
        },
        changedEmail: { type: Boolean, default: false },
    },
    {
        timestamps: true
    }
);

var User = module.exports = mongoose.model('User', UserSchema);

UserSchema.index({ name: 1, mobile: 1, email: 1, _id: 1 });

var crypto = require('crypto'),
    algorithm = 'aes-256-cbc',
    password = 'lasersail2019!';

//User.ensureIndexes({ name: 1, mobile: 1, email: 1, _id: 1 }, (err) => {
// User.createIndexes({ name: 1, mobile: 1, email: 1, _id: 1 }, (err) => {
//     if (err)
//         console.error(err);
//     else
//         console.log('Create index successfully');
// });

module.exports.getEncriptedPassword = function (userPassword) {


    var cipher = crypto.createCipher(algorithm, password);
    var encriptedPassword = cipher.update(userPassword, 'utf8', 'hex');
    encriptedPassword += cipher.final('hex');

    // callback(null, encriptedPassword);
    return encriptedPassword
}

//For update a user
module.exports.updateUser = function (query, values, callback) {
    User.findOneAndUpdate(query, values, callback);
}

module.exports.updateUserFilter = function (query, values, filter, callback) {
    User.findOneAndUpdate(query, values, filter, callback);
}


module.exports.createUser = function (newUser, callback) {
    newUser.save(callback);
}

module.exports.deleteUserByEmail = function (email, callback) {
    User.findOneAndUpdate({ email: email }, { $set: { active: false } }, callback);
}

module.exports.getUserByEmail = function (email, callback) {
    var query = { email: email };
    User.findOne(query, callback);
}

module.exports.getUserByEmail = function (email, callback) {
    var query = { email: email };
    User.findOne(query, callback);
}

module.exports.getUserByMobile = function (mobile, internationalPrefix, callback) {
    var query = {
        mobile: mobile,
        internationalPrefix: internationalPrefix
    };
    User.findOne(query, callback);
}

module.exports.getUserById = function (id, callback) {
    User.findById(id, callback);
}

module.exports.blockUser = function (userId, callback) {
    var query = { _id: userId };
    var newvalues = { $set: { blocked: true } };
    User.findOneAndUpdate(query, newvalues, callback);
}

module.exports.unlockUser = function (userId, callback) {
    var query = { _id: userId };
    var newvalues = { $set: { blocked: false } };
    User.findOneAndUpdate(query, newvalues, callback);
}