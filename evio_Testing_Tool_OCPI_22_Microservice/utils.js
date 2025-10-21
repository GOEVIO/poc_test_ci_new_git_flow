
var Utils = {
    generateToken: function (length) {
        var uid = require('rand-token').uid;
        var token = uid(length);

        return token;
    },
    response: function (data, statusCode, statusMessage) {
        var message = {};

        if (data !== null)
            message = { data: data, status_code: statusCode, status_message: statusMessage, timestamp: new Date().toISOString(), }
        else
            message = { status_code: statusCode, status_message: statusMessage, timestamp: new Date().toISOString(), }

        return message;
    },
    isEmptyObject: function (obj) {
        for (var key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                return false;
            }
        }
        return true;
    }
}
module.exports = Utils;
