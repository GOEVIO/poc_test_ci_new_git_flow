const express = require("express");
const router = express.Router();

const Sentry = require("@sentry/node");
const axios = require("axios");
const moment = require("moment");
const axiosS = require("../services/axios");

const notificationsHost = "http://notifications:3008";
const firebaseNotification = `${notificationsHost}/api/private/firebase/session/missingPayment`;

const toggle = require("evio-toggle").default;

const Constants = require("../utils/constants");
const { PaymentSubStatus } = require("evio-library-commons/dist");

// Services
const {
  processCheckRunningPlafondSessions,
  autoStopChargingSession,
} = require("../services/chargingSessions");

router.post("/api/job/cancelSessionsWithoutBalance", (req, res) => {
  const context = "JOB cancelSessionsWithoutBalance";
  try {
    let sessions = [];

    //get charging sessions from charging session
    let chargingSessions = new Promise((resolve, reject) => {
      var host =
        process.env.ChargersServiceProxy +
        process.env.ChargersServiceCheckPaymentRoutine;
      axios
        .get(host, {})
        .then((result) => {
          sessions = sessions.concat(result.data);
          resolve();
          //resolve(result.data);
        })
        .catch((error) => {
          console.error(`[${host}] Error `, error.message);
          resolve();
          //reject(error.response.data);
        });
    });

    //get charging sessions from mobie cg
    let chargingSessionsMobiE = new Promise((resolve, reject) => {
      var host =
        process.env.HostChargingSessionMobie +
        process.env.ChargersServiceCheckPaymentRoutine;
      axios
        .get(host, {})
        .then((result) => {
          sessions = sessions.concat(result.data);
          resolve();
          //resolve(result.data);
        })
        .catch((error) => {
          console.error(`[${host}] Error `, error.message);
          resolve();
          //reject(error.response.data);
        });
    });

    Promise.all([chargingSessions, chargingSessionsMobiE]).then(async () => {
      try {
        if (sessions.length !== 0) {
          let sessionsWallet = []; // sessões com payment type wallet
          let sessionsUnknown = []; // sessões com payment type unknown
          let sessionsPlafond = []; // sessões de plafond
          let sessionsThatShouldHadBeenStopped = []; // sessions with failed payment sub status that are still running
          for (let session of sessions) {
            const sessionPaymentMethod = session.paymentMethod.toUpperCase();
            const isPlafondSession =
              session.plafondId && session.plafondId != "-1";

            if (
              session.paymentSubStatus ==
                PaymentSubStatus.PaymentFailedForAnyReason &&
              sessionPaymentMethod ==
                process.env.PaymentMethodCard.toUpperCase()
            ) {
              sessionsThatShouldHadBeenStopped.push(session);
            } else if (
              sessionPaymentMethod ==
                process.env.PaymentMethodUnknown.toUpperCase() &&
              !isPlafondSession
            ) {
              sessionsUnknown.push(session);
            } else if (isPlafondSession) {
              sessionsPlafond.push(session);
            } else if (
              sessionPaymentMethod ==
                process.env.PaymentMethodWallet.toUpperCase() &&
              !isPlafondSession
            ) {
              sessionsWallet.push(session);
            }
          }
          //Se tiver sessões com payment type wallet fazer a verificação do preço a pagar
          if (sessionsWallet.length > 0) {
            let wallets = await getUsersWallets(sessionsWallet);

            const resultByUser = mergeByUserId(sessionsWallet);

            if (wallets?.length === 0 && resultByUser?.length > 0) {
              const error = new Error(
                " Error Getting the wallets in job cancelSessionsWithoutBalance"
              );
              console.error(`[${context}] Error -  ${error} `);
              Sentry.captureException(error);
              console.log(
                `[${context}] Because of error will skip the the wallet validation on cancelSessionsWithoutBalance...`
              );
            } else {
              const isNewValuesFromWalletActive = await toggle.isEnable(
                "bp-372-change_wallet_values"
              );
              const minimumValueToStopSession = isNewValuesFromWalletActive
                ? Constants.wallet.minimumValueToStopSession
                : 2.5;
              const minimumValueToTopUp = isNewValuesFromWalletActive
                ? Constants.wallet.minimumValueToTopUp
                : 2.5;
              const maximumValueToTopUp = isNewValuesFromWalletActive
                ? Constants.wallet.maximumValueToTopUp
                : 5;
              for await (let listSessionsOfAUser of resultByUser) {
                try {
                  // retrive wallet user
                  const wallet = wallets.find(
                    (elem) =>
                      elem.userId === listSessionsOfAUser[0].userIdWillPay
                  );
                  if (!wallet) {
                    console.log(
                      `[${context}] Wallet not found for userId: ${listSessionsOfAUser[0].userId} we will stop his sessions`
                    );
                    Sentry.captureException(
                      ` User Without Wallet: ${listSessionsOfAUser[0].userId}`
                    );
                    // We will stop the user if we cont find the user wallet
                    const reason = {
                      reasonCode: "other",
                      reasonText: "Wallet not found",
                    };
                    listSessionsOfAUser.forEach((session) => {
                      autoStopChargingSession(session, reason);
                    });
                    continue;
                  }
                  // sum all values
                  const value =
                    listSessionsOfAUser.length === 1
                      ? listSessionsOfAUser[0].estimatedPrice
                      : (
                          await listSessionsOfAUser.map((e) => e.estimatedPrice)
                        ).reduce((partialSum, a) => partialSum + a, 0);
                  let leftPayAmount = wallet.amount?.value?.toFixed(2) - value;
                  for await (const session of listSessionsOfAUser) {
                    const user = {
                      userIdWillPay: session.userIdWillPay ?? session.userId,
                      clientName: session.clientName,
                    };

                    if (
                      leftPayAmount <= maximumValueToTopUp &&
                      leftPayAmount >= minimumValueToTopUp
                    ) {
                      //utilizadore a notificar
                      let usersToNotify = checkUserIdToNotification(
                        user.userIdWillPay,
                        [session]
                      );
                      console.log(
                        `[${context}] usersToNotify: ${JSON.stringify(
                          usersToNotify
                        )}`
                      );
                      //envia notificação
                      var body = {
                        userIdWillPay: user.userIdWillPay,
                        usersToNotify: usersToNotify,
                      };

                      await axios
                        .post(firebaseNotification, body)
                        .then((response) => {
                          if (response) {
                            //faz update ao user para indicar que foi enviado notificação

                            //Fazer chamada ao serviço do chargers das sessoes
                            //Fazer divisão por chargerType

                            //updateSessionsAfterUserNotification(user.userIdWillPay);

                            var body = {
                              userIdWillPay: user.userIdWillPay,
                            };

                            //Faz update no serviço de chargers

                            var host =
                              process.env.ChargersServiceProxy +
                              process.env.ChargersServiceNotificationUpdate;

                            axios
                              .patch(host, body)
                              .then(() => {
                                console.log("Sessions update successfully");
                              })
                              .catch((error) => {
                                console.error(
                                  `[UpdateNotification] [${host}] Error `,
                                  error.response.data
                                );
                              });
                          }
                        })
                        .catch((error) => {
                          console.log("[Failed to send notification] " + error);
                        });

                      checkWalletAutoRecharger(user);
                    }
                    if (leftPayAmount < minimumValueToStopSession) {
                      var reason = {
                        reasonCode: "other",
                        reasonText: "Total price reached",
                      };
                      autoStopChargingSession(session, reason);
                    }
                  }
                } catch (error) {
                  console.error(`[${context}] Error `, error);
                  Sentry.captureException(
                    ` Sessions of User Id: ${listSessionsOfAUser[0].userId} with  Error: ${error?.message}`
                  );
                }
              }
            }
          }

          //Se tiver sessões com payment type unknow fazer autoStop da sessão
          if (sessionsUnknown.length > 0) {
            sessionsUnknown.map((session) => {
              const reason = {
                reasonCode: "other",
                reasonText: "No balance or payment methods available",
              };
              console.log(
                `[${context}] Stopping session ${session._id} due to unknown payment method`
              );
              autoStopChargingSession(session, reason);
            });
          }

          if (sessionsThatShouldHadBeenStopped.length > 0) {
            sessionsThatShouldHadBeenStopped.map((session) => {
              var reason = {
                reasonCode: "other",
                reasonText: "Payment failed for any reason",
              };
              console.log(
                `[${context}] Stopping session ${session._id} due to payment failure`
              );
              autoStopChargingSession(session, reason);
            });
          }

          if (sessionsPlafond.length > 0) {
            await processCheckRunningPlafondSessions(sessionsPlafond);
          }
        }
      } catch (error) {
        console.error(`[${context}] Error:`, error?.message);
        Sentry.captureException(error);
      }
    });
    res.status(200).send(`${context} - Process completed successfully`);
  } catch (error) {
    console.error(`[${context}] Error:`, error.message);
    Sentry.captureException(error);
    return res
      .status(500)
      .send({ error: `${context} - An error occurred while processing` });
  }
});

const mergeByUserId = (data) => {
  const grouped = data.reduce((acc, obj) => {
    if (!acc[obj.userId]) {
      acc[obj.userId] = [];
    }

    // Clone the object and replace readingPoints with its count
    const newObj = {
      ...obj,
      readingPoints: obj.readingPoints.length,
    };

    acc[obj.userId].push(newObj);
    return acc;
  }, {});

  return Object.values(grouped);
};

router.post("/api/job/cancelPaymentFailedSessions", (req, res) => {
  var context = "JOB cancelPaymentFailedSessions";
  try {
    let sessions = [];

    let chargingSessions = new Promise((resolve, reject) => {
      var host =
        process.env.ChargersServiceProxy +
        process.env.ChargingSessionCancelPaymentFailedSessions;
      axios
        .get(host, {})
        .then((result) => {
          sessions = sessions.concat(result.data);
          resolve();
        })
        .catch((error) => {
          console.error(`[${host}] Error `, error.message);
          resolve();
        });
    });

    let chargingSessionsMobiE = new Promise((resolve, reject) => {
      var host =
        process.env.HostChargingSessionMobie +
        process.env.ChargingSessionCancelPaymentFailedSessions;
      axios
        .get(host, {})
        .then((result) => {
          sessions = sessions.concat(result.data);
          resolve();
        })
        .catch((error) => {
          console.error(`[${host}] Error `, error.message);
          resolve();
        });
    });

    Promise.all([chargingSessions, chargingSessionsMobiE])
      .then(() => {
        if (sessions.length > 0) {
          sessions.map((session) => {
            var publicNetworkChargerType = process.env.PublicNetworkChargerType;

            publicNetworkChargerType = publicNetworkChargerType.split(",");

            var found = publicNetworkChargerType.find((type) => {
              return type === session.chargerType;
            });

            if (session.paymentMethod === process.env.PaymentMethodCard) {
              cancelPreAuthorisePayment(session);
            }

            if (found) {
              cancelPaymentFailedSessionsMobiE(session);
            } else {
              cancelPaymentFailedSessionsEVIO(session);
            }
          });
        }
      })
      .catch((error) => {
        console.log("[Error]: " + error);
      });
    res.status(200).send(`${context} - Process completed successfully`);
  } catch (error) {
    console.error(`[${context}] Error:`, error.message);
    Sentry.captureException(error);
    return res
      .status(500)
      .send({ error: `${context} - An error occurred while processing` });
  }
});

async function getUsersWallets(sessions) {
  try {
    let usersArray = [];

    sessions.forEach((session) => {
      let index = usersArray.findIndex(
        (x) => x.userIdWillPay === session.userIdWillPay
      );

      if (index === -1) {
        usersArray.push(session.userIdWillPay);
      }
    });

    let query = { userId: usersArray };
    let hostCDR =
      process.env.HostPayments + process.env.PathPostGetWalletByUsersId;

    wallets = await axiosS.axiosPostBody(hostCDR, query);

    return wallets;
  } catch (error) {
    console.error(`[getUsersWallets] Error `, error.message);
    Sentry.captureException(error);
    return [];
  }
}

function checkWalletAutoRecharger(user) {
  const context = "Function checkWalletAutoRecharger";

  const host = `${process.env.HostPayments}${process.env.PathPayments}/${user.userIdWillPay}`;

  axios
    .get(host)
    .then(async (result) => {
      //Check if you have auto recharge active
      if (result.data.autoRecharger) {
        let headers = {
          userid: user.userIdWillPay,
          clientname: user.clientName,
        };

        let hostPayments =
          process.env.HostPayments + process.env.PathPaymentMethods;
        let params = {};
        const isNewValuesFromWalletActive = await toggle.isEnable(
          "bp-372-change_wallet_values"
        );
        const defaultValueToTopUp = Constants.wallet.defaultValueToTopUp;
        axios
          .get(hostPayments, { params, headers })
          .then((result) => {
            if (result.data.length > 0) {
              let defaultPaymentMethod = result.data.find((paymentMethod) => {
                return paymentMethod.defaultPaymentMethod === true;
              });

              if (!defaultPaymentMethod) {
                defaultPaymentMethod = result.data[0];
              }

              let hostTopUp =
                process.env.HostPayments + process.env.PathAddBalanceCardTopUp;

              let data = {
                paymentMethod: {
                  storedPaymentMethodId: defaultPaymentMethod.id,
                  type: "scheme",
                },
                amount: {
                  value:
                    isNewValuesFromWalletActive && defaultValueToTopUp
                      ? defaultValueToTopUp
                      : 20,
                  currency: "EUR",
                },
              };
              //console.log("defaultPaymentMethod", defaultPaymentMethod);

              axios
                .post(hostTopUp, data, { headers })
                .then((response) => {
                  console.log(`[${context}][${hostTopUp}] Top up sent!`);
                })
                .catch((error) => {
                  console.error(
                    `[${context}][${hostTopUp}] Error ${error.message}`
                  );
                });
            } else {
              console.log("No auto recharger!");
            }
          })
          .catch((error) => {
            console.error(
              `[${context}][${hostPayments}] Error ${error.message}`
            );
          });
      } else {
        console.log("No auto recharger!");
      }
    })
    .catch((error) => {
      console.error(`[${context}][${host}] Error ${error.message}`);
    });
}

function checkUserIdToNotification(userWillPay, sessions) {
  let ids = [];

  sessions.forEach((session) => {
    let index = ids.findIndex((x) => x == session.userId);
    if (index === -1) {
      if (session.userId != userWillPay) {
        ids.push(session.userId);
      }
    }
  });

  return ids;
}

function cancelPaymentFailedSessionsEVIO(session) {
  var context = "Function cancelPaymentFailedSessionsEVIO";
  var host =
    process.env.ChargersServiceProxy +
    process.env.ChargingSessionCancelPaymentFailedSessions;

  var data = {
    _id: session._id,
    paymentStatus: process.env.ChargingSessionPaymentStatusCanceled,
  };

  axios
    .put(host, data)
    .then((result) => {
      console.log(`[${context}][${host}] session updated`);
    })
    .catch((error) => {
      console.error(`[${context}][axios.put] Error `, error.response.data);
    });
}

function cancelPaymentFailedSessionsMobiE(session) {
  var context = "Function cancelPaymentFailedSessionsMobiE";
  var host =
    process.env.HostChargingSessionMobie +
    process.env.ChargingSessionCancelPaymentFailedSessions;

  console.log("session._id", session._id);
  var data = {
    _id: session._id,
    paymentStatus: process.env.ChargingSessionPaymentStatusCanceled,
  };

  axios
    .put(host, data)
    .then((result) => {
      console.log(`[${context}][${host}] session updated`);
    })
    .catch((error) => {
      console.error(`[${context}][axios.put] Error `, error.response.data);
    });
}

function cancelPreAuthorisePayment(chargingSession) {
  var context = "Function cancelPreAuthorisePayment";

  var host =
    process.env.HostPayments + process.env.PathCancelPreAuthorisePayment;

  let headers = {
    clientname: chargingSession.clientName,
  };

  var data = {
    transactionId: chargingSession.transactionId,
  };

  axios
    .delete(host, { headers }, { data })
    .then((result) => {
      console.log("Pre authorise payment cancel!");
    })
    .catch((error) => {
      console.error(`[${context}] Error`, error);
    });
}

module.exports = router;
