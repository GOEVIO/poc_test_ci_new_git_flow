var moment = require('moment');
xml2js = require('xml2js');

const handlers = require('../handlers');

const requestHandler = (oc, message, cs_info, sessionConfig) => {
    return new Promise(function (resolve, reject) {

        var parser = new xml2js.Parser();

        parser.parseStringPromise(message)
            .then((result) => {

                let operation = null;

                if (result == undefined) {
                    operation = 'default';
                } else {
                    if (Object.keys(result).includes("commandAck")) {
                        if (result['commandAck'] != undefined) {
                            handlers.CommandAck.handle(result).then(function (data) {
                                //console.log("[CommandAck] result: " + data);
                                resolve(data);
                            });
                        } else {
                            operation = 'default';
                        }
                    }

                    if (Object.keys(result).includes("command")) {

                        if (result['command'] != undefined) {

                            if (result["command"]["CLIENT_COMMAND"] != undefined) {
                                operation = Object.keys(result["command"]["CLIENT_COMMAND"]["0"]).toString();
                            }

                            if (result["command"]["STATES"] != undefined) {
                                //if (result["command"]["STATES"]["0"]["Section_State"] != undefined) {
                                console.log("Section_State");
                                operation = "Section_State";
                                //}
                            }

                            if (result["command"]["PARAMETER"] != undefined) {
                                operation = "Configuration";
                            }

                        } else {
                            operation = 'default';
                        }

                        switch (operation) {
                            case 'LOGIN':
                                handlers.Login.handle(oc, result, cs_info).then(function (data) {
                                    //console.log("[LOGIN] result: " + data);
                                    resolve(data);
                                });
                                break;

                            case 'AUTHENTICATE':
                                handlers.Authenticate.handle(result).then(function (data) {
                                    //console.log("[AUTHENTICATE] result: " + data);
                                    resolve(data);
                                });
                                break;

                            case 'CHARGE_SECTION_START':
                                handlers.Charge_Section_Start.handle(result).then(function (data) {
                                    //console.log("[CHARGE_SECTION_START] result: " + data);
                                    resolve(data);
                                });
                                break;

                            case 'CHARGE_SECTION_REPORT':
                                handlers.Charge_Section_Report.handle(result).then(function (data) {
                                    //console.log("[CHARGE_SECTION_REPORT] result: " + data);
                                    resolve(data);
                                });
                                break;

                            case 'CHARGE_SECTION_END':
                                handlers.Charge_Section_End.handle(result).then(function (data) {
                                    //console.log("[CHARGE_SECTION_END] result: " + data);
                                    resolve(data);
                                });
                                break;

                            case 'CHARGE_SECTION_INFO':
                                handlers.Charge_Section_Info.handle(result, sessionConfig).then(function (data) {
                                    //console.log("[CHARGE_SECTION_INFO] result: " + data);
                                    resolve(data);
                                });
                                break;

                            case 'SYSTEM_FAULT':
                                handlers.System_Fault.handle(result, sessionConfig).then(function (data) {
                                    //console.log("[SYSTEM_FAULT] result: " + data);
                                    resolve(data);
                                });
                                break;

                            case 'MESSAGE':
                                handlers.Message.handle(result, sessionConfig).then(function (data) {
                                    //console.log("[MESSAGE] result: " + data);
                                    resolve(data);
                                });
                                break;

                            case 'KEEPALIVE':
                                handlers.KeepAlive.handle(result, cs_info).then(function (data) {
                                    //console.log("[KEEPALIVE] result: " + data);
                                    resolve(data);
                                });
                                break;

                            case 'FW_UPDATE_STATUS':
                                handlers.FW_UPDATE_STATUS.handle(result).then(function (data) {
                                    //console.log("[FW_UPDATE_STATUS] result: " + data);
                                    resolve(data);
                                });
                                break;

                            case 'GET_FW_UPDATE_STATUS':
                                handlers.GET_FW_UPDATE_STATUS.handle(result).then(function (data) {
                                    //console.log("[GET_FW_UPDATE_STATUS] result: " + data);
                                    resolve(data);
                                });
                                break;

                            case 'Section_State':
                                handlers.Charge_Section_Status.handle(result).then(function (data) {
                                    if (data) {
                                        resolve(data);
                                    } else {
                                        console.log("Stopped checking section status");
                                        resolve(false);
                                    }
                                });
                                break;

                            case 'Configuration':
                                handlers.Configuration.handle(result).then(function (data) {
                                    if (data) {
                                        resolve(data);
                                    } else {
                                        console.log("Configuration");
                                        resolve(false);
                                    }
                                });
                                break;

                            default:
                                console.log(JSON.stringify("[Charging Station] Unknown Operation"));
                        }
                    }
                }

            })
            .catch((err) => {
                console.log("Invalid message");
                console.log(err);
                resolve(false);
            });

    })
}

module.exports.requestHandler = requestHandler;