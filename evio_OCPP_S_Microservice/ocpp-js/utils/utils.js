const externalip = require('externalip');
const ip = require('ip');
const IPv6 = require('ip-address').Address6;
const axios = require("axios");
var he = require('he');
const global = require('../../global');
const moment = require('moment');

var Utils = {
    /**
     *  Log function
     *  @param {String} message to display
     *  @param
     */
    log: function (msg, type) {
        var d = new Date(),
            log = Utils.dateToString(d) + " ";

        if (type != undefined) {
            if (type == "cs")
                log += "cs: ";
            else if (type == "cp")
                log += "cp: ";
            else
                log += "cp#" + type + ": ";
        }

        console.log(log + msg);
    },

    getExternalIP: function (callback) {
        externalip(callback);
    },

    getRemoteAddress: function (address) {
        if (ip.isV6Format(address)) {
            var IPv6Address = new IPv6(address);
            var teredo = IPv6Address.inspectTeredo();
            return teredo.client4;
        } else {
            return address;
        }
    },

    /**
     *  Convert a Date to String
     *  Format: [YY-mm-dd hh:mm:ss]
     *  @param {Date}
     *  @param {String}
     */
    dateToString: function (date) {
        var year = Utils.addZeroPadding(date.getFullYear()),
            month = Utils.addZeroPadding(date.getMonth() + 1),
            day = Utils.addZeroPadding(date.getDate()),
            hours = Utils.addZeroPadding(date.getHours()),
            minutes = Utils.addZeroPadding(date.getMinutes()),
            seconds = Utils.addZeroPadding(date.getSeconds());

        return "[" + year + "-" + month + "-" + day + " " + hours + ":" + minutes + ":" +
            seconds + "]";
    },

    /**
     *  Add zero-padding if needed
     *  @param {Number} Number of the day/month
     *  @param {String}
     */
    addZeroPadding: function (n) {
        return n < 10 ? '0' + n : '' + n;
    },

    /**
     *  Generate a random ID
     *  @return String
     */
    makeId: function () {
        var text = "",
            possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

        for (var i = 0; i < 32; i++)
            text += possible.charAt(Math.floor(Math.random() * possible.length));

        return text;
    },

    /**
     * Retrieve OCPP version from string
     */
    retrieveVersion: function (str) {
        // if array, last occurence
        if (str instanceof Array) {
            str = str[str.length - 1];
        }

        var v = [];
        for (var i in str) {
            if (str[i] >= 0 && str[i] < 10) {
                v.push(str[i]);
            }
        }

        return v.join('.');
    },

    isEmpty: function (obj) {
        for (var i in obj) {
            return false;
        }
        return true;
    },

    capitaliseFirstLetter: function (string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    },

    lowerFirstLetter: function (string) {
        return string.charAt(0).toLowerCase() + string.slice(1);
    },

    getDateISOFormat: function () {
        return new Date().toISOString().split('.')[0] + 'Z';
    },

    validURL: function (str) {
        var re = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;-]*)/ig;

        return re.test(str);
    },

    clone: function (obj) {
        if (null == obj || "object" != typeof obj) return obj;
        var copy = obj.constructor();
        for (var attr in obj) {
            if (obj.hasOwnProperty(attr))
                if (typeof obj[attr] == "object")
                    copy[attr] = Utils.clone(obj[attr]);
                else
                    copy[attr] = obj[attr];
        }

        return copy;
    },

    // Get network interface IPs, from:
    // http://stackoverflow.com/questions/3653065/get-local-ip-address-in-node-js
    getNetworkIPs: function () {
        var ignoreRE = /^(127\.0\.0\.1|::1|fe80(:1)?::1(%.*)?)$/i;

        var exec = require('child_process').exec;
        var cached;
        var command;
        var filterRE;

        switch (process.platform) {
            case 'win32':
                //case 'win64': // TODO: test
                command = 'ipconfig';
                filterRE = /\bIPv[46][^:\r\n]+:\s*([^\s]+)/g;
                break;
            case 'darwin':
                command = 'ifconfig';
                filterRE = /\binet\s+([^\s]+)/g;
                // filterRE = /\binet6\s+([^\s]+)/g; // IPv6
                break;
            default:
                command = 'ifconfig';
                filterRE = /\binet\b[^:]+:\s*([^\s]+)/g;
                // filterRE = /\binet6[^:]+:\s*([^\s]+)/g; // IPv6
                break;
        }

        return function (callback, bypassCache) {
            if (cached && !bypassCache) {
                callback(null, cached);
                return;
            }
            // system call
            exec(command, function (error, stdout, sterr) {
                cached = [];
                var ip;
                var matches = stdout.match(filterRE) || [];
                //if (!error) {
                for (var i = 0; i < matches.length; i++) {
                    ip = matches[i].replace(filterRE, '$1')
                    if (!ignoreRE.test(ip)) {
                        cached.push(ip);
                    }
                }
                //}
                callback(error, cached);
            });
        };
    },

    logSoap: function (xml, direction) {
        // @scope: soap server
        var direction = direction || 'in',
            prefix = direction == 'in' ? '<<' : '>>',
            rawContent = xml,
            content = this.wsdl.xmlToObject(xml),
            from = null,
            action = null;

        // if no content then do nothing
        if (!content) {
            if (direction == 'in')
                Utils.log('<<cp#? Error, message not well-formed:\n' +
                    xml, "cs");
            return;
        }

        if (content.Header && content.Header.chargeBoxIdentity) {
            from = content.Header.chargeBoxIdentity;
            action = content.Header.Action;
        }

        // get message content
        for (var c in content.Body) {
            content = content.Body[c];
            break;
        };
        const Transport = require('../transport');
        content = Transport.PRINT_XML ? rawContent : JSON.stringify(content);
        Utils.log(prefix + 'cp#' + from + ' ' + action + ' ' + content,
            "cs");
    },


    generateTransactionId: function () {
        return Math.floor(Math.random() * 10);
    },

    toTitleCase: function (str) {
        return str.replace(/\w\S*/g, function (txt) { return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(); });
    },


    isPortUsed: function (port, fn) {
        var net = require('net')
        var tester = net.createServer().once('error', function (err) {
            if (err.code != 'EADDRINUSE') return fn(err)
            fn(null, true);
        }).once('listening', function () {
            tester.once('close', function () { fn(null, false) })
                .close();
        }).listen(port);
    },

    getPort: function (url) {
        url = url.match(/^(([a-z]+:)?(\/\/)?[^\/]+).*$/)[1] || url;
        var parts = url.split(':'),
            port = parseInt(parts[parts.length - 1], 10);
        if (parts[0] === 'http' && (isNaN(port) || parts.length < 3)) {
            return 80;
        }
        if (parts[0] === 'https' && (isNaN(port) || parts.length < 3)) {
            return 443;
        }
        if (parts.length === 1 || isNaN(port)) return 80;
        return port;
    },

    getEndpoint: function (uri, ip) {
        var port = this.getPort(uri);
        if (ip.substr(0, 7) == "::ffff:") {
            ip = ip.substr(7)
        }
        //uri = uri.replace('http://', '');
        return ip + ':' + port + uri.substring(uri.indexOf('/'), uri.length);
    },

    getEndpointIp: function (uri, ip) {

        return uri;
    },
    chekIfChargerExists: function (ServiceProxy, params) {

        return new Promise((resolve, reject) => {
            axios.get(ServiceProxy, { params })
                .then(function (response) {

                    var charger = response.data.charger[0];

                    if (typeof charger === 'undefined') {
                        resolve(false);
                    }
                    else {
                        resolve(response);
                    }

                }).catch(function (error) {
                    console.log("error" + error);
                    console.log(error.response.data.message);
                    resolve(false);
                });
        });
    },
    getSession: function (ServiceProxy, params) {

        return new Promise((resolve, reject) => {
            axios.get(ServiceProxy, { params })
                .then(function (response) {

                    if (typeof response.data !== 'undefined') {
                        var session = response.data.chargingSession[0];

                        if (typeof session === 'undefined') {
                            resolve(false);
                        }
                        else {
                            resolve(session);
                        }
                    }
                    else {

                        resolve(false);
                    }

                }).catch(function (error) {
                    console.log("error" + error);
                    console.log(error.response.data.message);
                    resolve(false);
                });
        });
    },
    checkIfHasChargingSession: function (ServiceProxy, params) {
        console.log(ServiceProxy, params)
        return new Promise((resolve, reject) => {
            axios.get(ServiceProxy, { params })
                .then(function (response) {

                    var session = response.data.chargingSession[0];

                    if (typeof session === 'undefined') {
                        resolve(false);
                    }
                    else {
                        resolve(session);
                    }

                }).catch(function (error) {
                    console.log("error" + error);
                    console.log(error.response.data.message);
                    resolve(false);
                });
        });
    },
    checkIdTagValidity: function (ServiceProxy, params) {

        return new Promise((resolve, reject) => {
            axios.get(ServiceProxy, { params })
                .then(function (response) {

                    if (typeof response.data !== 'undefined') {
                        var contract = response.data.contract;

                        if (typeof contract === 'undefined') {
                            resolve(false);
                        }
                        else {
                            resolve(contract);
                        }
                    }
                    else
                        resolve(false);
                }).catch(function (error) {
                    console.log("error" + error);
                    console.log(error.response.data.message);
                    resolve(false);
                });
        });
    },
    getClient: function (context, charger, CentralSystemServer) {

        return new Promise((resolve, reject) => {

            CentralSystemServer._getClientByEndpoint(charger.endpoint).then((client) => {

                if (client) {
                    //console.log(`${context} Client found: ${client.endpoint} , chargeBoxId: ${client.chargeBoxIdentity}\n`);
                    resolve(true);
                }
                else {
                    //console.log(`${context} Creating client: ${charger.hwId},  ${charger.endpoint}\n`);

                    //Create client if does not exists
                    CentralSystemServer.createChargeBoxClient(charger, function () {
                        resolve(true);
                    });
                }
            });

        });
    },

    updateChargingSession: function (ServiceProxy, status, internalSessionId, meterStart) {


        var body = {
            _id: internalSessionId,
            status: status,
            meterStart: meterStart
        }

        axios.patch(ServiceProxy, { body })
            .then(function (response) {
                // console.log("Success");
            })
            .catch(function (error) {
                console.log('[Utils - updateChargingSession] error, ', error);

            });


    },
    updateChargingSession2: function (ServiceProxy, status, internalSessionId, meterStop, totalPowerConsumed, timeChargedinSeconds) {

        var dateNow = moment();

        var body = {
            _id: internalSessionId,
            status: status,
            meterStop: meterStop,
            totalPower: totalPowerConsumed,
            timeCharged: timeChargedinSeconds,
            stopDate: dateNow
        }

        axios.patch(ServiceProxy, { body })
            .then(function (response) {
                // console.log("Success");
            })
            .catch(function (error) {
                console.log('[Utils - updateChargingSession2] error, ', error);

            });


    },
    updateChargingSessionMeterValues: function (ServiceProxy, body) {

        axios.patch(ServiceProxy, { body })
            .then(function (response) {
                // console.log("Success");
            })
            .catch(function (error) {
                console.log('[Utils - updateChargingSessionMeterValues] error, ', error);

            });


    },
    getEvioChargePointStatus: function (ocppStatus) {

        return new Promise((resolve, reject) => {

            var status = global.chargePointStatusEVIOUnavailable;

            if (ocppStatus == global.chargePointStatusOCPPAvailable)
                status = global.chargePointStatusEVIOAvailable;
            else if (ocppStatus == global.chargePointStatusOCPPUnavailable)
                status = global.chargePointStatusEVIOUnavailable
            else if (ocppStatus == global.chargePointStatusOCPPFaulted)
                status = global.chargePointStatusEVIOUnavailable
            else if (ocppStatus == global.chargePointStatusOCPPOccupied)
                status = global.chargePointStatusEVIOInUse
            else if (ocppStatus == global.chargePointStatusOCPPReserved)
                status = global.chargePointStatusEVIOBooked

            resolve(status);

        });
    },
    getChargingTime: function (chargingSession) {

        var dateNow = moment();
        //console.log(dateNow)

        // Fucking bug of dates....moment(chargingSession.startDate, "YYYY-MM-DD'T'HH:mm:ss");
        var startDate = chargingSession.startDate;

        var duration = moment.duration(dateNow.diff(startDate));
        var timeChargedinSeconds = duration.asSeconds();
        return timeChargedinSeconds;

    },
    getEstimatedPrice: function (chargingSession) {

        var dateNow = moment();
        //var startDate = moment(chargingSession.startDate, "YYYY-MM-DD'T'HH:mm:ss");
        var startDate = chargingSession.startDate;
        var duration = moment.duration(dateNow.diff(startDate));
        var hours = duration.asHours();
        var estimatedPrice = hours * chargingSession.sessionPrice;
        return estimatedPrice;

    },
    saveHeartBeat: function (ServiceProxy, body) {

        axios.patch(ServiceProxy, body)
            .then(function (response) {

            })
            .catch(function (error) {
                console.log("error", error);

            });

    },
    getParserOptions: function () {
        var options = {
            attributeNamePrefix: "@_",
            attrNodeName: "attr", //default is 'false'
            textNodeName: "#text",
            ignoreAttributes: true,
            ignoreNameSpace: true,
            allowBooleanAttributes: false,
            parseNodeValue: true,
            parseAttributeValue: false,
            trimValues: true,
            cdataTagName: "__cdata", //default is 'false'
            cdataPositionChar: "\\c",
            parseTrueNumberOnly: false,
            arrayMode: false, //"strict"
            attrValueProcessor: (val, attrName) => he.decode(val, { isAttributeValue: true }),//default is a=>a
            tagValueProcessor: (val, tagName) => he.decode(val), //default is a=>a
            stopNodes: ["parse-me-as-string"]
        };

        return options;
    }
};

module.exports = Utils;
