const Promise = require('promise');
const moment = require('moment');
var Notification = require('../../models/notifications');
const global = require('../../global');
const Utils = require('../utils/utils');
var host = global.charger_microservice_host;
var host_identity = global.identity_microservice_host;

const idTagProxy = `${host_identity}/api/private/contracts/idTag`;
const chargingSessionProxy = `${host}/api/private/chargingSession`;

const context = "[Authorize] ";

module.exports = {
  handle: function (data) {
    return new Promise(function (resolve, reject) {

      data.chargeBoxIdentity = JSON.parse(JSON.stringify(data.chargeBoxIdentity), function (k, v) {
        if (k === "$value") {
          this.value = v;
        } else {
          return v;
        }
      });

      if (data.chargeBoxIdentity.value)
        data.chargeBoxIdentity = data.chargeBoxIdentity.value;

      var message = `Trying authentication on station ${data.chargeBoxIdentity} with IdTag ${data.idTag}`;

      var notification = new Notification({
        hwId: data.chargeBoxIdentity,
        text: message,
        unread: true,
        type: 'Authorize',
        timestamp: moment().format()
      });

      console.log('[Authorize] notification: ' + JSON.stringify(notification))

      try {

        var idTag = data.idTag;
        Notification.createNotification(notification);

        var params = {
          idTag: idTag,
          status: process.env.SessionStatusToStart
        };

        Utils.getSession(chargingSessionProxy, params).then((session) => {
          if (session) {
            
            var userId = session.userId;

            var params = {
              userId: userId,
              idTag: idTag
            };

            /////////////////////////////////////////////////////////////////////////////
            //Check if tagId is valid
            Utils.checkIdTagValidity(idTagProxy, params).then((contract) => {
              if (contract) {

                /////////////////////////////////////////////////////////////////////////////
                //Accept authorize
                resolve({
                  authorizeResponse: {
                    idTagInfo: {
                      status: global.idTagStatusAccepted
                    }
                  }
                });
              }
              else {
                console.log(`${context} Invalid id tag: `, params);
                resolve({
                  authorizeResponse: {
                    idTagInfo: {
                      status: global.idTagStatusInvalid
                    }
                  }
                });
              }

            });
          }
          else {
            console.log(`${context} Charging session with toStart status not found for given idTag: `, idTag);
            resolve({
              authorizeResponse: {
                idTagInfo: {
                  status: global.idTagStatusInvalid
                }
              }
            });
          }

        });

      } catch (error) {
        console.log('[Authorize] error :' + error);
      }
    });
  }
}


// module.exports = {
//   handle: function (data) {
//     return new Promise(function (resolve, reject) {
//       Storage.findAll('users', function (err, users) {
//         // Get user with idTag
//         var user = users.filter(function (u) {
//           return u.idTag === data.idTag;
//         })[0];


//         console.log(`User: ${JSON.stringify(user)} for idTag ${data.idTag}`);

//         if (user) {

//           var name = user.name.split(' ');
//           var firstName = name[0];
//           var lastName = name[1];

//           var message = `${firstName} ${lastName} is now authenticated on station ${data.chargeBoxIdentity}`;

//           var notification = {
//             text: message,
//             unread: true,
//             type: 'Authorize',
//             timestamp: moment().format()
//           }

//           Storage.save('notification', notification, function (err) {
//             if (err) {
//               reject(err);
//             } else {
//               // TODO: check if not expired
//               resolve({
//                 AuthorizeResponse: {
//                   idTagInfo: {
//                     status: 'Accepted',
//                     expiryDate: moment().add(1, 'months').format(),
//                     parentIdTag: 'PARENT'
//                   }
//                 }
//               });
//             }
//           });
//         } else {
//           // User not authorized
//           resolve({
//             AuthorizeResponse: {
//               idTagInfo: {
//                 status: 'Invalid',
//                 expiryDate: moment().subtract(1, 'months').format(),
//                 parentIdTag: 'PARENT'
//               }
//             }
//           });
//         }
//       });
//     });
//   }
// }
