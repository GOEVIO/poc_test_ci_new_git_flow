var net = require('net');
var cluster = require('cluster');
var moment = require('moment');
var xmlParser = require('../handlers/XMLHandler');

var SessionConfig = require('../../models/SessionConfig');
const Utils = require('../entities/Utils');
const ChargingPointResponse = require('../entities/OperationCenterResponses');
const OperationCenterCommands = require('../entities/OperationCenterCommands');

let singleton;

var host = 'http://chargers:3002';
//var host = 'http://localhost:3002';

const chargerServiceProxy = `${host}/api/private/chargers/status`;
const chargerServiceStatusProxy = `${host}/api/private/chargers/chargerStatus`;

class OperationCenter {

    constructor(port) {
        this.port = port;
        this.socket = null;
        this.sessionConfig = new SessionConfig();
        this.callback = null;
        this.storedWorkers = [];
        this.TCPserver = null;
    }

    createTCPServer() {

        if (cluster.isMaster) {

            this.TCPserver = net.createServer();

            this.TCPserver.listen(this.port, function () {
                console.log('TCP Server listening for connection requests on port 8091');
            });

            this.TCPserver.on('connection', (socket) => {

                var clientAddress = `${socket.remoteAddress}:${socket.remotePort}`;
                console.log(`new connection established to: ${clientAddress}`);

                if (!this.validEndpoint(socket)) {
                    console.log('Invalid Endpoint');
                } else {

                    socket.on('data', function dataHandler(message) {

                        console.log("Message bytes read: " + JSON.stringify(message).length + " B");
                        console.log("Total bytes read: " + socket.bytesRead + " B");

                        var cs_info = {
                            address: socket.remoteAddress,
                            port: socket.remotePort,
                            endpoint: this.getEndpoint(clientAddress)
                        }

                        try {
                            console.log('[' + moment().format('YYYY-MM-DD HH:mm:ss') + ']'
                                + '[Data received from the client1]\r\n' + message.toString() + '\r\n');
                        } catch (error) {
                            console.log(error);
                        }

                        xmlParser.requestHandler(this, message, cs_info, this.sessionConfig)
                            .then((response) => {

                                if (response) {

                                    if (response.operation = 'LOGIN') {
                                        socket.write(response.command + ' \0');
                                        console.log('[' + moment().format('YYYY-MM-DD HH:mm:ss') + ']'
                                            + '[Data sent from the server]\r\n' + response.command.toString() + '\r\n');

                                        console.log("Message bytes sent: " + JSON.stringify(response.command).length + " B");
                                        console.log("Total bytes sent: " + socket.bytesWritten + " B");

                                        //Put Charger Online
                                        var params = {
                                            hwId: response.sn,
                                            status: process.env.ChargePointStatusEVIO
                                        }
                                        Utils.updateStatusCharger(chargerServiceProxy, chargerServiceStatusProxy, params);

                                        console.log('I am Master');
                                        const worker = cluster.fork().on('online', () => {
                                            worker.send({ hwId: response.sn });
                                            worker.send('socket', socket);
                                            socket.off('data', dataHandler);
                                        });
                                        console.log('Worker ' + worker.id + ' created');

                                        this.addNewConnection(response.sn, worker);

                                        this.setupStatusWorkerOn(worker);

                                        cluster.on('disconnect', (new_worker) => {
                                            if (new_worker.id === worker.id) {

                                                //console.log("WorkerID: " + new_worker.id);
                                                //console.log(this.storedWorkers);

                                                let connection = this.storedWorkers.find(element => element.worker_id == new_worker.id);

                                                if (connection != undefined) {
                                                    //Put Charger Offline
                                                    var params = {
                                                        hwId: connection.sn,
                                                        status: process.env.ChargePointStatusEVIOFaulted
                                                    }
                                                    Utils.updateStatusCharger(chargerServiceProxy, chargerServiceStatusProxy, params);

                                                    var index = this.storedWorkers.indexOf(connection);
                                                    //console.log("Index: " + index);

                                                    if (index > -1) {
                                                        this.storedWorkers.splice(index, 1);
                                                    }

                                                    console.log('The worker ' + new_worker.id + ' has disconnected');
                                                } else {
                                                    console.log('The worker ' + new_worker.id + ' could not find the connection');
                                                }

                                            }
                                        });

                                        cluster.on('exit', (new_worker, code, signal) => {
                                            if (new_worker.id === worker.id) {
                                                console.log('The worker ' + new_worker.id + ' died');
                                            }
                                        });

                                    }
                                }

                            })
                            .catch((error) => {
                                console.log(error);
                            });
                    }.bind(this));

                }
            })
        }
    }

    //statusHandler
    setupStatusWorkerOn(worker) {
        worker.on('message', (message) => {

            //charging station status
            if (message.status != undefined) {

                let status = message.status;
                let charger = message.charger;

                let context = "getChargingStationStatus";

                this.getClientConnection(context, charger)
                    .then((client) => {
                        if (client !== null) {
                            client.send({ statusC: status });
                        } else {
                            console.log("No client");
                        }
                    })
            }

            if (message.plug != undefined) {

                let plug = message.plug;
                let charger = message.charger;

                let context = "getChargingStationStatus";

                this.getClientConnection(context, charger)
                    .then((client) => {
                        if (client !== null) {
                            client.send({ plugStatus: plug });
                        } else {
                            console.log("No client");
                        }
                    })
            }

        })
    }

    startTransaction = (message, worker) => {
        return new Promise((resolve, reject) => {
            console.log("StartTransaction");
            if (worker === null) {
                let error = { code: 'charge_station_not_found', message: 'Charging Station not found' };
                reject(error);
            } else {
                worker.on('message', function messageHandler(message) {
                    if (message.response != undefined) {
                        xmlParser.requestHandler(null, message.response, null, null)
                            .then((response) => {
                                if (response) {
                                    worker.off('message', messageHandler);
                                    resolve(response);
                                }
                            })
                    }
                });
                worker.send({ command: message });
            }
        })
    }

    checkPlugUsed = (charger) => {
        return new Promise((resolve, reject) => {

            let newId = moment().format('YYYY-MM-DDTHH:mm:ss');
            let plug = OperationCenterCommands.chargingStationIECPlugStatus(newId);

            let context = "getPlugStatus";

            this.getClientConnection(context, charger)
                .then((client) => {
                    if (client !== null) {
                        console.log("Status Plug");
                        client.send({ plugStatus: plug });
                        resolve(true);
                    } else {
                        let error = { code: 'charge_station_not_found', message: 'Charging Station not found' };
                        reject(error);
                    }
                })
                .catch((error) => {
                    console.log(error);
                    resolve(false);
                })

        })
    }

    addNewConnection(sn, worker) {
        const connection = this.storedWorkers.find(element => element.sn == sn);
        if (connection == undefined) {
            var worker_info = {
                sn: sn,
                worker_id: worker.id,
                worker: worker
            };
            this.storedWorkers.push(worker_info);
        } else {
            connection.worker = worker;
        }
    }

    removeConnection(sn) {

        let connection = this.storedWorkers.find(element => element.sn == sn);

        if (connection != undefined) {
            //Put Charger Offline
            var params = {
                hwId: connection.sn,
                status: process.env.ChargePointStatusEVIOFaulted
            }
            Utils.updateStatusCharger(chargerServiceProxy, chargerServiceStatusProxy, params);

            var index = this.storedWorkers.indexOf(connection);
            var worker = connection.worker;
            //console.log("Index: " + index);

            if (index > -1) {
                this.storedWorkers.splice(index, 1);
            }

            worker.send('shutdown');
            console.log('The worker has disconnected');
        } else {
            console.log('The worker could not find the connection');
        }

    }

    validEndpoint(socket) {
        var address = socket._peername.address;
        var array = address.toString().split(':');
        if (array[3] === '192.168.103.13' || array[3] === '192.168.103.16') {
            return false;
        }
        return true;
    }

    getEndpoint(address) {
        var array = address.toString().split(':');
        if (array.length == 5) {
            return 'http://' + array[3] + ':' + array[4];
        } else {
            if (array.length == 2) {
                return 'http://' + array[0] + ':' + array[1];
            }
        }
        return 'Not determinated';
    }

    checkServerIsRunning() {
        if (this.TCPserver !== null) {
            return true;
        }
        return false;
    }

    getWorkerFromCSId(sn) {
        console.log("Sn: " + sn);
        const found = this.storedWorkers.find(element => element.sn == sn);
        if (found != undefined) {
            return found.worker;
        }
        return null;
    }

    closeTCPServer() {
        for (let i = 0; i < this.storedWorkers.length; i++) {
            const worker = this.storedWorkers[i];
            worker.send('shutdown');
        }
        this.TCPserver.close();

        if (!this.checkServerIsRunning()) {
            this.TCPserver = undefined;
            return true;
        }
        return false;
    }

    getClientConnection(context, charger) {
        return new Promise((resolve, reject) => {
            const connection = this.storedWorkers.find(element => element.sn == charger.hwId);
            if (connection) {
                console.log(`${context} Client found`);
                resolve(connection.worker);
            } else {
                console.log(`${context} Client not found: ${charger.hwId}`);
                reject(false);
            }
        })
    }

    getList() {
        return this.storedWorkers;
    }

}

let OC = function (port) {
    if (singleton) {
        return singleton;
    } else {
        singleton = new OperationCenter(port);
    }
}

module.exports = OC;

