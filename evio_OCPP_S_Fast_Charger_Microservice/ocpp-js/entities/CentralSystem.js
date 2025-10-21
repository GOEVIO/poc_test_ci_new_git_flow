const Utils = require('../utils/utils.js');
const SOAPWrapper = require('../utils/SOAPWrapper');
const ip = require('ip');
const UUID = require('uuid-js');

class CentralSystem {
  constructor(port) {
    this.soapWrapper = new SOAPWrapper(port, true);
    var self = this;
    this.port = port;
    this.ip = ip.address();
    this.clients = [];
    this.chargePointClient = null;

    this.soapWrapper.createCentralSystemServer(port);

    console.log(`[CentralSystem] Server IP: ${self.ip}`);
  }

  createChargeBoxClient(station, callback) {
    var self = this;

    this.soapWrapper.createChargePointClient(station.endpoint).then(function (client) {
      self.clients.push({
        client: client,
        endpoint: station.endpoint,
        chargeBoxIdentity: station.hwId
      });
      callback();
    });
  }

  _getClientByEndpoint(endpoint) {
    return new Promise((resolve, reject) => {

      var soapClient = this.clients.filter(function (client) {
        return client.endpoint === endpoint;
      });

      if (soapClient.length > 0) {
        resolve(soapClient[0]);
      } else {
        resolve(null);
      }
    });
  }

  restartChargingPoint(pointId, endpoint) {
    this.reset(pointId, endpoint, {
      type: 'Hard'
    });

    this.unlockConnector(pointId, endpoint);
  }


  reset(stationId, remoteAddress, data) {
    return new Promise((resolve, reject) => {
      this.action = '/Reset';

      this._updateSoapHeaders(stationId, remoteAddress).then((soapClient) => {

        var request = {
          resetRequest: data
        }

        console.log(request)

        if (soapClient) {

          soapClient.Reset(request).then((result) => {
            resolve(result);

          }).catch(function (error) {
            console.log("[Reset] error", error);
            reject(error);
          });


        }
        else {
          console.log(`[SOAP Request] Client for ${remoteAddress} is not found !`);
        }

      });
    });
  }
  clearCache(stationId, remoteAddress) {
    this.action = '/ClearCache';

    this._updateSoapHeaders(stationId, remoteAddress);

    var request = {
      clearCacheRequest: {}
    }

    this.chargePointClient.ClearCache(request, function (result) {
      console.log(JSON.stringify(result));
    });
  }

  changeAvailability(stationId, remoteAddress, data) {
    this.action = '/ChangeAvailability';

    this._updateSoapHeaders(stationId, remoteAddress);

    var request = {
      changeAvailabilityRequest: data
    }

    this.chargePointClient.ChangeAvailability(request, function (result) {
      console.log(JSON.stringify(result));
    });
  }


  changeConfiguration(stationId, remoteAddress, data) {
    return new Promise((resolve, reject) => {

      this.action = '/ChangeConfiguration';

      this._updateSoapHeaders(stationId, remoteAddress).then((soapClient) => {

        var request = {
          changeConfigurationRequest: data
        }


        if (soapClient) {

          soapClient.ChangeConfiguration(request).then((result) => {
            resolve(result);

          }).catch(function (error) {
            console.log("[ChangeConfiguration] error", error);
            reject(error);
          });


        }
        else {
          console.log(`[SOAP Request] Client for ${remoteAddress} is not found !`);
        }

      });

    });
  }

  getDiagnostics(stationId, remoteAddress) {
    return new Promise((resolve, reject) => {
      this.action = '/GetDiagnostics';

      this._updateSoapHeaders(stationId, remoteAddress).then((soapClient) => {

        var request = {
          getDiagnosticsRequest: {}
        }

        if (soapClient) {

          soapClient.GetDiagnostics(request).then(function (result) {
            resolve(result);
          }).catch(function (error) {
            console.log("error" + error);
            reject(error);
          });

        }
        else {
          console.log(`[SOAP Request] Client for ${remoteAddress} is not found !`);
        }

      });
    });
  }

  GetConfiguration(stationId, remoteAddress) {
    return new Promise((resolve, reject) => {

      this.action = '/GetConfiguration';

      this._updateSoapHeaders(stationId, remoteAddress).then((client) => {

        var request = {
          getConfigurationRequest: {}
        }

        if (client) {



          client.GetConfiguration(request).then(function (result) {
            resolve(result);
          }).catch(function (error) {
            reject(error);
          });
        }
        else {
          console.log(`[SOAP Request] Client for ${remoteAddress} is not found !`);
        }

      });
    });
  }

  remoteStartTransaction(stationId, remoteAddress, data) {
    return new Promise((resolve, reject) => {

      this.action = '/RemoteStartTransaction';

      this._updateSoapHeaders(stationId, remoteAddress).then((soapClient) => {

        var request = {
          remoteStartTransactionRequest: data
        }

        if (soapClient) {

          soapClient.RemoteStartTransaction(request).then((result) => {

            resolve(result);

          }).catch(function (error) {
            console.log("[RemoteStartTransaction] error", error);
            reject(error);
          });

        }
        else {
          console.log(`[SOAP Request] Client for ${remoteAddress} is not found !`);
        }

      });

    });

  }

  remoteStopTransaction(stationId, remoteAddress, data) {
    return new Promise((resolve, reject) => {
      this.action = '/RemoteStopTransaction';

      this._updateSoapHeaders(stationId, remoteAddress).then((soapClient) => {


        var request = {
          remoteStopTransactionRequest: data
        }

        if (soapClient) {

          soapClient.RemoteStopTransaction(request).then(function (result) {

            resolve(result);

          }).catch(function (error) {
            console.log("[remoteStopTransaction] Error invoking RemoteStopTransaction Method: " + error);
            reject(error);
          });
        }
        else {
          console.log(`[SOAP Request] Client for ${remoteAddress} is not found !`);
        }

      });

    });
  }

  unlockConnector(stationId, remoteAddress, data) {

    return new Promise((resolve, reject) => {
      this.action = '/UnlockConnector';

      this._updateSoapHeaders(stationId, remoteAddress).then((soapClient) => {

        var request = {
          unlockConnectorRequest: {
            connectorId: data.connectorId
          }
        }

        if (soapClient) {

          soapClient.UnlockConnector(request).then((result) => {
            resolve(result);

          }).catch(function (error) {
            console.log("[UnlockConnector] error", error);
            reject(error);
          });

        }

        else {
          console.log(`[SOAP Request] Client for ${remoteAddress} is not found !`);
        }

      });

    });
  }

  updateFirmware(stationId, remoteAddress, data) {
    this.action = '/UpdateFirmware';

    this._updateSoapHeaders(stationId, remoteAddress);

    var request = {
      updateFirmwareRequest: data
    }

    this.chargePointClient.UpdateFirmware(request, function (result) {
      console.log(JSON.stringify(result));
    });
  }

  reserveNow(stationId, remoteAddress, data) {
    this.action = '/ReserveNow';

    this._updateSoapHeaders(stationId, remoteAddress);

    var request = {
      reserveNowRequest: data
    }

    this.chargePointClient.ReserveNow(request, function (result) {
      console.log(JSON.stringify(result));
    });
  }

  cancelReservation(stationId, remoteAddress, data) {
    this.action = '/CancelReservation';

    this._updateSoapHeaders(stationId, remoteAddress);

    var request = {
      cancelReservationRequest: data
    }

    this.chargePointClient.CancelReservation(request, function (result) {
      console.log(JSON.stringify(result));
    });
  }

  sendLocalList(stationId, remoteAddress, data) {
    this.action = '/SendLocalList';

    this._updateSoapHeaders(stationId, remoteAddress);

    var request = {
      sendLocalListRequest: data
    }

    this.chargePointClient.SendLocalList(request, function (result) {
      console.log(JSON.stringify(result));
    });
  }

  getLocalListVersion(stationId, remoteAddress) {
    this.action = '/GetLocalListVersion';

    this._updateSoapHeaders(stationId, remoteAddress);

    var request = {
      getLocalListVersionRequest: {}
    }

    this.chargePointClient.GetLocalListVersion(request, function (result) {
      console.log(JSON.stringify(result));
    });
  }

  dataTransfer(stationId, remoteAddress, data) {
    this.action = '/DataTransfer';

    this._updateSoapHeaders(stationId, remoteAddress);

    var request = {
      dataTransferRequest: data
    }

    this.chargePointClient.DataTransfer(request, function (result) {
      console.log(JSON.stringify(result));
    });
  }

  _updateSoapHeaders(clientId, remoteAddress) {
    return new Promise((resolve, reject) => {

      this._getClientByEndpoint(remoteAddress).then((client) => {

        var soapClient;
        if (client) {

          soapClient = client.client;

          soapClient.clearSoapHeaders();

          clientId = clientId || 'Simulator';

          // console.log(`Client ID: ${clientId}`);
          // console.log(`Remote Address: ${remoteAddress}`);
          // console.log(`Action: ${this.action}`);

          var to = remoteAddress || 'http://192.168.0.114:8081';
          //var to = 'http://127.0.0.1:8081/ChargeBox/Ocpp';

          // Generate a V4 UUID
          var uuid4 = UUID.create();

          soapClient.wsdl.xmlnsInEnvelope = soapClient.wsdl._xmlnsMap();
          //soapClient.addSoapHeader('<h:connection xmlns:h="urn://Ocpp/Cp/2012/06/" >keep-alive</h:connection>')
          soapClient.addSoapHeader('<h:chargeBoxIdentity xmlns:h="urn://Ocpp/Cp/2012/06/" >' + clientId + '</h:chargeBoxIdentity>')
          //soapClient.setEndpoint("http://192.168.103.13:8088/ChargePointServiceV1dot5");
          //client.addSoapHeader('<h:chargeBoxIdentity xmlns:h="urn://Ocpp/Cp/2012/06/" >0005510901AB</h:chargeBoxIdentity>')

          //soapClient.setSOAPAction('/GetConfiguration')
          soapClient.setSOAPAction(this.action)
          console.log(this.action);
          soapClient.setHttpHeader("Content-Type", "application/soap+xml;charset=UTF-8;action=\"" + this.action + "\"");
          //soapClient.setHttpHeader("Content-Type", "application/soap+xml;charset=UTF-8;action=\"/GetConfiguration\"");
          //soapClient.setHttpHeader("Content-Type", "application/soap+xml;charset=UTF-8;action=\"/GetConfiguration\"");



          // soapClient.addSoapHeader('<a:MessageID>urn:uuid:' + uuid4 + '</a:MessageID>')
          // soapClient.addSoapHeader('<a:From><a:Address>http://85.88.143.237:8090/Ocpp/CentralSystemService</a:Address></a:From>')
          // soapClient.addSoapHeader('<a:ReplyTo><a:Address>http://www.w3.org/2005/08/addressing/anonymous</a:Address></a:ReplyTo>')
          // soapClient.addSoapHeader('<a:To>' + to + '</a:To>')
          // soapClient.addSoapHeader('<a:Action soap:mustUnderstand="1">' + this.action + '</a:Action>')


          resolve(soapClient);

        } else {
          console.log(`[SOAP Headers] Client for ${remoteAddress} is not found !`);
          resolve(null);
        }

      });
    });

  }
}

module.exports = CentralSystem;
