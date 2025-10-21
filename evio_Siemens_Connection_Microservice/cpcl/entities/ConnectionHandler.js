var cluster = require('cluster');
var moment = require('moment');

var xmlParser = require('../handlers/XMLHandler');

class ConnectionHandler {

    constructor() {
        this.hwId = null;
        this.workerConnectionHandler();
    }

    workerConnectionHandler() {
        console.log('Worker ' + cluster.worker.id + ' started');
        this.establishNewConnection(cluster.worker);

        cluster.worker.on('exit', (code, signal) => {
            if (signal) {
                console.log(`worker was killed by signal: ${signal}`);
            } else if (code !== 0) {
                console.log(`worker exited with error code: ${code}`);
            } else {
                console.log('worker success!');
            }
        })

    }

    establishNewConnection(worker) {
        process.on('message', (message, socket) => {

            if (message === 'socket') {

                console.log("Worker received socket");

                this.socket = socket;
                var cs_info = {
                    address: socket.remoteAddress,
                    port: socket.remotePort,
                    worker: worker,
                    worker_id: worker.id,
                    hwId: this.hwId
                }

                this.socket.on('data', (message) => {

                    console.log("Message bytes read: " + JSON.stringify(message).length + " B");
                    console.log("Total bytes read: " + socket.bytesRead + " B");

                    if (!this.flag) {
                        console.log('[' + moment().format('YYYY-MM-DD HH:mm:ss') + ']'
                            + '[Worker ' + worker.id + ']'
                            + '[Data received from the client]\r\n' + message.toString() + '\r\n');
                        xmlParser.requestHandler(this, message, cs_info, this.sessionConfig)
                            .then((response) => {
                                if (response) {
                                    socket.write(response + ' \0');
                                    console.log('[' + moment().format('YYYY-MM-DD HH:mm:ss') + ']'
                                        + '[Worker ' + worker.id + ']'
                                        + '[Data sent from the server]\r\n' + response.toString() + '\r\n');

                                    console.log("Message bytes sent: " + JSON.stringify(response).length + " B");
                                    console.log("Total bytes sent: " + socket.bytesWritten + " B");
                                }
                            })
                            .catch((error) => {
                                console.log(error);
                            });
                    } else {
                        console.log('[' + moment().format('YYYY-MM-DD HH:mm:ss') + ']'
                            + '[Worker ' + worker.id + ']'
                            + '[Data received from the client]\r\n' + message.toString() + '\r\n');
                        process.send({ response: message.toString() });
                        this.flag = false;
                    }
                });

                this.socket.on('end', function () {
                    console.log('Closing connection with the client');
                });

                this.socket.on('close', function () {
                    worker.kill();
                    console.log('Connection closed');
                });

                this.socket.on('error', function (err) {
                    console.log(err);
                });
            }

            if (message.command != undefined) {
                this.socket.write(message.command.toString() + ' \0');

                console.log("Message bytes sent: " + JSON.stringify(message.command.toString()).length + " B");
                console.log("Total bytes sent: " + this.socket.bytesWritten + " B");

                console.log('[' + moment().format('YYYY-MM-DD HH:mm:ss') + ']'
                    + '[Worker ' + worker.id + ']'
                    + '[Data sent from the server]\r\n' + message.command.toString() + '\r\n');
                this.flag = true;
            }

            if (message.statusC != undefined) {
                this.socket.write(message.statusC.toString() + ' \0');

                console.log("Message bytes sent: " + JSON.stringify(message.statusC.toString()).length + " B");
                console.log("Total bytes sent: " + this.socket.bytesWritten + " B");

                console.log('[' + moment().format('YYYY-MM-DD HH:mm:ss') + ']'
                    + '[Worker ' + worker.id + ']'
                    + '[Data sent from the server]\r\n' + message.statusC.toString() + '\r\n');
            }

            if (message.plugStatus != undefined) {
                this.socket.write(message.plugStatus.toString() + ' \0');

                console.log("Message bytes sent: " + JSON.stringify(message.plugStatus.toString()).length + " B");
                console.log("Total bytes sent: " + this.socket.bytesWritten + " B");

                console.log('[' + moment().format('YYYY-MM-DD HH:mm:ss') + ']'
                    + '[Worker ' + worker.id + ']'
                    + '[Data sent from the server]\r\n' + message.plugStatus.toString() + '\r\n');
            }

            if (message.hwId != undefined) {
                this.hwId = message.hwId;
                console.log("HWId: " + this.hwId);
            }

            if (message === 'shutdown') {
                worker.kill();
                console.log('Connection shutdown');
            }

        })
    }

}

module.exports = ConnectionHandler;
