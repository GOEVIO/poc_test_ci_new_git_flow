const handlers = require('../handlers');
const Utils = require('./utils');

var CentralSystemService = {
    CentralSystemService: {

        CentralSystemServiceSoap12: {

            Authorize: function (args, callback, headers, req) {
                console.log('\n[Authorize]: Headers ' + JSON.stringify(headers) + '\n');
                console.log('\n[Authorize]: Data ' + JSON.stringify(args) + '\n');

                args.chargeBoxIdentity = headers.chargeBoxIdentity;
                args.endpoint = Utils.getEndpoint(headers.From.Address, req.connection.remoteAddress);
                handlers.Authorize.handle(args).then(function (data) {
                    console.log('\n[Authorize]: Response ' + JSON.stringify(data) + '\n');
                    callback(null, data);
                });
            },
            BootNotification: function (args, callback, headers, req) {
                console.log('\n[BootNotification]: Headers ' + JSON.stringify(headers) + '\n');
                console.log('\n[BootNotification]: Data ' + JSON.stringify(args) + '\n');

                args.chargeBoxIdentity = headers.chargeBoxIdentity;

                args.endpoint = Utils.getEndpointIp(headers.From.Address, req.connection.remoteAddress);

                //console.log('[BootNotification] endpoint: ' + args.endpoint + '\n');
                handlers.BootNotification.handle(args).then(function (data) {
                    console.log('[BootNotification] Response: ' + JSON.stringify(data));
                    callback(null, data);
                });
            },
            StartTransaction: function (args, callback, headers, req) {
                console.log('\n[StartTransaction]: Headers ' + JSON.stringify(headers) + '\n');
                console.log('\n[StartTransaction]: Data ' + JSON.stringify(args) + '\n');
                args.chargeBoxIdentity = headers.chargeBoxIdentity;
                args.endpoint = Utils.getEndpointIp(headers.From.Address, req.connection.remoteAddress);

                handlers.StartTransaction.handle(args).then(function (data) {
                    callback(data);
                    console.log('\n[StartTransaction]: Response ' + JSON.stringify(data) + '\n');
                });
            },
            StopTransaction: function (args, callback, headers, req) {
                console.log('\n[StopTransaction]: Headers ' + JSON.stringify(headers) + '\n');
                console.log('\n[StopTransaction]: Data ' + JSON.stringify(args) + '\n');
                // TODO: store the correct port
                args.chargeBoxIdentity = headers.chargeBoxIdentity;

                handlers.StopTransaction.handle(args).then(function (data) {
                    callback(data);
                    console.log('\n[StopTransaction]: Response ' + JSON.stringify(data) + '\n');
                });
            },
            Heartbeat: function (args, callback, headers, req) {
                console.log('[Heartbeat]: Headers: ' + JSON.stringify(headers) + '\n');
                
                //args.chargeBoxIdentity = headers.chargeBoxIdentity;

                handlers.Heartbeat.handle(headers).then(function (data) {
                    console.log('[Heartbeat]: Response ' + JSON.stringify(data) + '\n');
                    callback(data);
                });
            },
            MeterValues: function (args, callback, headers, req) {
                console.log('\n[MeterValues]: Headers ' + JSON.stringify(headers) + '\n');
                console.log('\n[MeterValues]: Data ' + JSON.stringify(args) + '\n');
                args.chargeBoxIdentity = headers.chargeBoxIdentity;
                args.endpoint = Utils.getEndpointIp(headers.From.Address, req.connection.remoteAddress);

                handlers.MeterValues.handle(args).then(function (data) {
                    callback(data);
                });
            },
            StatusNotification: function (args, callback, headers, req) {
                console.log('\n [StatusNotification]: Headers ' + JSON.stringify(headers) + '\n');
                console.log('\n[StatusNotification]: Data ' + JSON.stringify(args) + '\n');
                args.chargeBoxIdentity = headers.chargeBoxIdentity;
                handlers.StatusNotification.handle(args).then(function (data) {
                    data = data || {}
                    console.log('[StatusNotification] Response: ' + JSON.stringify(data));
                    callback(data);
                });
            },
            FirmwareStatusNotification: function (args, callback, headers, req) {
                console.log('\n[FirmwareStatusNotification]: Headers ' + JSON.stringify(headers) + '\n');
                console.log('\n[FirmwareStatusNotification]: Data ' + JSON.stringify(args) + '\n');
                args.chargeBoxIdentity = headers.chargeBoxIdentity;
                args.endpoint = Utils.getEndpointIp(headers.From.Address, req.connection.remoteAddress);

                handlers.FirmwareStatusNotification.handle(args).then(function (data) {
                    callback(data);
                });
            },
            DiagnosticsStatusNotification: function (args, callback, headers, req) {
                console.log('\n[DiagnosticsStatusNotification]: Headers ' + JSON.stringify(headers) + '\n');
                console.log('\n[DiagnosticsStatusNotification]: data ' + JSON.stringify(args) + '\n');
                args.chargeBoxIdentity = headers.chargeBoxIdentity;
                args.endpoint = Utils.getEndpointIp(headers.From.Address, req.connection.remoteAddress);

                handlers.DiagnosticsStatusNotification.handle(args).then(function (data) {
                    callback(data);
                });
            },
            DataTransfer: function (args, callback, headers, req) {
                console.log('\n[DataTransfer]: Headers ' + JSON.stringify(headers) + '\n');
                console.log('\n[DataTransfer]: Data ' + JSON.stringify(args) + '\n');
                args.chargeBoxIdentity = headers.chargeBoxIdentity;
                args.endpoint = Utils.getEndpointIp(headers.From.Address, req.connection.remoteAddress);

                handlers.DataTransfer.handle(args).then(function (data) {
                    callback(data);
                });
            }
        }
    }
};

module.exports = CentralSystemService;
