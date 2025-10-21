require("dotenv-safe").load();
const History = require("../models/historyV2");
const validateAndRemoveNegativeFieldsReports = require("../middlewares/reports");
const {
  checkSessionUserInListOfGroups,
} = require("../helpers/checkSessionUserInListOfGroups");

const {
  matchStage,
  headerTotalsGroupStage,
  headerChargingStationGroupStage,
  headerAptGroupStage,
  detailedList,
  joinList,
} = require("../helpers/apt.helper");

const {
  findHistories,
  findHistoriesAggregated,
} = require("evio-library-statistics");

module.exports = {
  getReportsApps: function (req, res) {
    let context = "Function getReportsApps";
    return new Promise(async (resolve, reject) => {
      try {
        console.log("req.query 1", req.query);
      } catch (error) {
        console.error(`[${context}] Error`, error.message);
        reject(error);
      }
    });
  },
  removeNegativeFields: function (report) {
    if (report.totals) {
      report.totals = validateAndRemoveNegativeFieldsReports({
        totals: report.totals,
      }).totals;
    }

    if (report.totalsGroupBy) {
      report.totalsGroupBy = report.totalsGroupBy.map((group) => {
        group = validateAndRemoveNegativeFieldsReports({
          totals: group,
        }).totals;
        if (group.list) {
          group.list = group.list.map(
            (item) =>
              validateAndRemoveNegativeFieldsReports({ totals: item }).totals,
          );
        }
        return group;
      });
    }

    return report;
  },
  getReportsWeb: function (req, res) {
    let context = "Function getReportsWeb";
    return new Promise(async (resolve, reject) => {
      try {
        let userId = req.headers["userid"];
        let received = req.query;
        let groupBy;

        if (received.groupBy) groupBy = received.groupBy.toUpperCase();

        if (!received.startDate) {
          reject({
            auth: false,
            code: "server_startDate_required",
            message: "Start date is required",
          });
        }
        if (!received.endDate) {
          reject({
            auth: false,
            code: "server_endDate_required",
            message: "End date is required",
          });
        }

        if (!received.type) {
          reject({
            auth: false,
            code: "server_reportsType_required",
            message: "Type is required",
          });
        }

        let totals;
        let totalsGroupBy;
        let listGroupBy;
        let listGroup;

        received.userId = userId;

        if (received.type.toUpperCase() === "EVS") {
          totals = await getTotalsEvs(userId, received, "WEB");

          switch (groupBy) {
            case "BYNETWORK":
              totalsGroupBy = await getTotalsByNetwork(userId, received, "WEB");
              listGroup = await getListByNetwork(userId, received, "WEB");
              listGroupBy = await joinGroups(totalsGroupBy, listGroup, groupBy);

              break;
            case "BYUSER":
              totalsGroupBy = await getTotalsByUser(userId, received, "WEB");
              listGroup = await getListByUser(userId, received, "WEB");
              listGroupBy = await joinGroups(totalsGroupBy, listGroup, groupBy);

              break;
            case "BYEV":
              totalsGroupBy = await getTotalsByEv(userId, received, "WEB");
              listGroup = await getListByEv(userId, received, "WEB");
              listGroupBy = await joinGroups(totalsGroupBy, listGroup, groupBy);
              break;
            case "BYFLEET":
              totalsGroupBy = await getTotalsByFleet(userId, received, "WEB");
              listGroup = await getListByFleet(userId, received, "WEB");
              listGroupBy = await joinGroups(totalsGroupBy, listGroup, groupBy);
              break;
            case "MOBIE":
              totalsGroupBy = await getTotalsByMobiE(userId, received, "WEB");
              listGroup = await getListByMobiE(userId, received, "WEB");
              listGroupBy = await joinGroups(totalsGroupBy, listGroup, groupBy);
              break;
            default:
              reject({
                auth: false,
                code: "server_groupBy_not_supported",
                message: "Group by not supported",
              });
              break;
          }

          if (totals === 0 || totalsGroupBy === 0) {
            resolve({
              totals: {},
              totalsGroupBy: [],
            });
          }

          resolve(
            this.removeNegativeFields({
              totals: totals,
              totalsGroupBy: totalsGroupBy,
            }),
          );
        } else if (received.type.toUpperCase() === "CHARGERS") {
          totals = await getTotalsChargers(userId, received, "WEB");

          switch (groupBy) {
            case "CHARGER":
              totalsGroupBy = await getTotalsByCharger(userId, received, "WEB");
              listGroup = await getListByCharger(userId, received, "WEB");
              listGroupBy = await joinGroups(totalsGroupBy, listGroup, groupBy);
              break;
            case "PLUGS":
              totalsGroupBy = await getTotalsByPlug(userId, received, "WEB");
              listGroup = await getListByPlug(userId, received, "WEB");
              listGroupBy = await joinGroups(totalsGroupBy, listGroup, groupBy);
              break;
            case "INFRASTRUCTURE":
              totalsGroupBy = await getTotalsByInfrastructure(
                userId,
                received,
                "WEB",
              );
              listGroup = await getListByInfrastructure(
                userId,
                received,
                "WEB",
              );
              listGroupBy = await joinGroups(totalsGroupBy, listGroup, groupBy);
              break;
            case "USER":
              totalsGroupBy = await getTotalsByUsers(userId, received, "WEB");
              listGroup = await getListByUsers(userId, received, "WEB");
              listGroupBy = await joinGroups(totalsGroupBy, listGroup, groupBy);
              break;
            default:
              reject({
                auth: false,
                code: "server_groupBy_not_supported",
                message: "Group by not supported",
              });
              break;
          }

          if (totals === 0 || totalsGroupBy === 0) {
            resolve({
              totals: {},
              totalsGroupBy: [],
            });
          }

          if (groupBy === "USER") {
            resolve(
              this.removeNegativeFields({
                totals: totals,
                totalsGroupBy: listGroupBy,
              }),
            );
          } else {
            resolve(
              this.removeNegativeFields({
                totals: totals,
                totalsGroupBy: totalsGroupBy,
              }),
            );
          }
        } else if (received.type.toUpperCase() === "APTS") {
          const match = matchStage(received);
          const headerTotals = headerTotalsGroupStage();
          const headerPipeline = [match, ...headerTotals];
          const headerPipeline2 = [match, ...headerChargingStationGroupStage()];
          const headerPipeline3 = [match, ...headerAptGroupStage()];
          let groupByData;

          switch (groupBy.toUpperCase()) {
            case "CHARGER":
              groupByData = await findHistoriesAggregated(headerPipeline2);
              break;
            case "APT":
              groupByData = await findHistoriesAggregated(headerPipeline3);
              break;
            default:
              reject({
                auth: false,
                code: "server_groupBy_not_supported",
                message: "Group by not supported",
              });
              break;
          }

          const detailedListData = await findHistories(detailedList(received));
          const headerTotalData = await findHistoriesAggregated(headerPipeline);

          await joinList(groupByData, detailedListData, received?.groupBy);

          resolve(
            this.removeNegativeFields({
              totals: headerTotalData,
              totalsGroupBy: groupByData,
            }),
          );
        } else {
          reject({
            auth: false,
            code: "server_type_not_supported",
            message: "Type not supported",
          });
        }
      } catch (error) {
        console.error(`[${context}] Error`, error.message);
        reject(error);
      }
    });
  },
};

//========== FUNCTION ==========
function getTotalsEvs(userId, received, requested) {
  var context = "Function getTotalsEvs";
  return new Promise(async (resolve, reject) => {
    try {
      var pipeline = [
        {
          "$match": {
            "$or": [
              {
                "evOwner": userId,
              },
              {
                "$and": [
                  {
                    "userId": userId,
                  },
                  {
                    "evId": "-1",
                  },
                ],
              },
            ],
            stopDate: {
              $gte: new Date(received.startDate),
              $lte: new Date(received.endDate),
            },
            status: { $ne: process.env.PaymentStatusFaild },
          },
        },
        {
          "$group": {
            "_id": {},
            "COUNT(*)": {
              "$sum": 1,
            },
            "SUM(CO2Saved)": {
              "$sum": "$CO2Saved",
            },
            "SUM(totalPower)": {
              "$sum": "$totalPower",
            },
            "totalPriceInclVat": {
              "$sum": "$totalPrice.incl_vat",
            },
            "totalPriceExclVat": {
              "$sum": "$totalPrice.excl_vat",
            },
            "SUM(timeCharged)": {
              "$sum": "$timeCharged",
            },
          },
        },
        {
          "$project": {
            "totalSessions": "$COUNT(*)",
            "totalCO2Saved": "$SUM(CO2Saved)",
            "totalPower": "$SUM(totalPower)",
            "totalPriceInclVat": "$totalPriceInclVat",
            "totalPriceExclVat": "$totalPriceExclVat",
            "timeCharged": "$SUM(timeCharged)",
            "_id": 0,
          },
        },
      ];

      let totals = await History.aggregate(pipeline);

      resolve(totals[0]);
    } catch (error) {
      console.error(`[${context}] Error`, error.message);
      reject(error);
    }
  });
}

function getTotalsChargers(userId, received, requested) {
  var context = "Function getTotalsChargers";
  return new Promise(async (resolve, reject) => {
    try {
      var pipeline = [
        {
          "$match": {
            chargerOwner: userId,
            stopDate: {
              $gte: new Date(received.startDate),
              $lte: new Date(received.endDate),
            },
            status: { $ne: process.env.PaymentStatusFaild },
          },
        },
        {
          "$group": {
            "_id": {},
            "COUNT(*)": {
              "$sum": 1,
            },
            "SUM(CO2Saved)": {
              "$sum": "$CO2Saved",
            },
            "SUM(totalPower)": {
              "$sum": "$totalPower",
            },
            "totalPriceInclVat": {
              "$sum": "$totalPrice.incl_vat",
            },
            "totalPriceExclVat": {
              "$sum": "$totalPrice.excl_vat",
            },
            "SUM(timeCharged)": {
              "$sum": "$timeCharged",
            },
            "purchaseTariffDetailsExclVat": {
              "$sum": "$purchaseTariffDetails.excl_vat",
            },
            "purchaseTariffDetailsInclVat": {
              "$sum": "$purchaseTariffDetails.incl_vat",
            },
          },
        },
        {
          "$project": {
            "totalSessions": "$COUNT(*)",
            "totalCO2Saved": "$SUM(CO2Saved)",
            "totalPower": "$SUM(totalPower)",
            "totalPriceInclVat": "$totalPriceInclVat",
            "totalPriceExclVat": "$totalPriceExclVat",
            "purchaseTariffDetailsExclVat": "$purchaseTariffDetailsExclVat",
            "purchaseTariffDetailsInclVat": "$purchaseTariffDetailsInclVat",
            "timeCharged": "$SUM(timeCharged)",
            "_id": 0,
          },
        },
      ];

      let totals = await History.aggregate(pipeline);

      resolve(totals[0]);
    } catch (error) {
      console.error(`[${context}] Error`, error.message);
      reject(error);
    }
  });
}

//Get totals by network
function getTotalsByNetwork(userId, received, requested) {
  var context = "Function getTotalsByNetwork";
  return new Promise(async (resolve, reject) => {
    try {
      var pipeline = [
        {
          "$match": {
            "$or": [
              {
                "evOwner": userId,
              },
              {
                "$and": [
                  {
                    "userId": userId,
                  },
                  {
                    "evId": "-1",
                  },
                ],
              },
            ],
            stopDate: {
              $gte: new Date(received.startDate),
              $lte: new Date(received.endDate),
            },
            status: { $ne: process.env.PaymentStatusFaild },
          },
        },
        {
          "$group": {
            "_id": {
              "network": "$network",
            },
            "COUNT(*)": {
              "$sum": 1,
            },
            "SUM(CO2Saved)": {
              "$sum": "$CO2Saved",
            },
            "SUM(totalPower)": {
              "$sum": "$totalPower",
            },
            "totalPriceInclVat": {
              "$sum": "$totalPrice.incl_vat",
            },
            "totalPriceExclVat": {
              "$sum": "$totalPrice.excl_vat",
            },
            "SUM(timeCharged)": {
              "$sum": "$timeCharged",
            },
          },
        },
        {
          "$project": {
            "totalSessions": "$COUNT(*)",
            "totalCO2Saved": "$SUM(CO2Saved)",
            "totalPower": "$SUM(totalPower)",
            "totalPriceInclVat": "$totalPriceInclVat",
            "totalPriceExclVat": "$totalPriceExclVat",
            "timeCharged": "$SUM(timeCharged)",
            "network": "$_id.network",
            "_id": 0,
          },
        },
      ];

      let totals = await History.aggregate(pipeline);
      resolve(totals);
    } catch (error) {
      console.error(`[${context}] Error`, error.message);
      reject(error);
    }
  });
}

//Get list by network
function getListByNetwork(userId, received, requested) {
  var context = "Function getListByNetwork";
  return new Promise(async (resolve, reject) => {
    try {
      let query = {
        "$or": [
          {
            "evOwner": userId,
          },
          {
            "$and": [
              {
                "userId": userId,
              },
              {
                "evId": "-1",
              },
            ],
          },
        ],
        stopDate: {
          $gte: new Date(received.startDate),
          $lte: new Date(received.endDate),
        },
        status: { $ne: process.env.PaymentStatusFaild },
      };

      let fieldsEvs = {
        _id: 1,
        startDate: 1,
        timeCharged: 1,
        "ev.brand": 1,
        "ev.model": 1,
        "ev.version": 1,
        "ev.licensePlate": 1,
        network: 1,
        totalPower: 1,
        "user.name": 1,
        "charger.address": 1,
        "charger.hwId": 1,
        totalPrice: 1,
        cdrId: 1,
        chargerType: 1,
      };

      let listByNetwork = await History.find(query, fieldsEvs).sort({
        "network": 1,
        startDate: 1,
      });
      resolve(listByNetwork);
    } catch (error) {
      console.error(`[${context}] Error`, error.message);
      reject(error);
    }
  });
}

//Get totals by user
function getTotalsByUser(userId, received, requested) {
  var context = "Function getTotalsByUser";
  return new Promise(async (resolve, reject) => {
    try {
      var pipeline = [
        {
          "$match": {
            "$or": [
              {
                "evOwner": userId,
              },
              {
                "$and": [
                  {
                    "userId": userId,
                  },
                  {
                    "evId": "-1",
                  },
                ],
              },
            ],
            stopDate: {
              $gte: new Date(received.startDate),
              $lte: new Date(received.endDate),
            },
            status: { $ne: process.env.PaymentStatusFaild },
          },
        },
        {
          "$group": {
            "_id": {
              "userId": "$userId",
              "name": "$user.name",
            },
            "COUNT(*)": {
              "$sum": 1,
            },
            "SUM(CO2Saved)": {
              "$sum": "$CO2Saved",
            },
            "SUM(totalPower)": {
              "$sum": "$totalPower",
            },
            "totalPriceInclVat": {
              "$sum": "$totalPrice.incl_vat",
            },
            "totalPriceExclVat": {
              "$sum": "$totalPrice.excl_vat",
            },
            "SUM(timeCharged)": {
              "$sum": "$timeCharged",
            },
          },
        },
        {
          "$project": {
            "totalSessions": "$COUNT(*)",
            "totalCO2Saved": "$SUM(CO2Saved)",
            "totalPower": "$SUM(totalPower)",
            "totalPriceInclVat": "$totalPriceInclVat",
            "totalPriceExclVat": "$totalPriceExclVat",
            "timeCharged": "$SUM(timeCharged)",
            "userId": "$_id.userId",
            "name": "$_id.name",
            "_id": 0,
          },
        },
      ];

      let totals = await History.aggregate(pipeline);
      resolve(totals);
    } catch (error) {
      console.error(`[${context}] Error`, error.message);
      reject(error);
    }
  });
}

//Get list by user
function getListByUser(userId, received, requested) {
  var context = "Function getListByUser";
  return new Promise(async (resolve, reject) => {
    try {
      let query = {
        "$or": [
          {
            "evOwner": userId,
          },
          {
            "$and": [
              {
                "userId": userId,
              },
              {
                "evId": "-1",
              },
            ],
          },
        ],
        stopDate: {
          $gte: new Date(received.startDate),
          $lte: new Date(received.endDate),
        },
        status: { $ne: process.env.PaymentStatusFaild },
      };

      let fieldsEvs = {
        _id: 1,
        startDate: 1,
        timeCharged: 1,
        "ev.brand": 1,
        "ev.model": 1,
        "ev.version": 1,
        "ev.licensePlate": 1,
        totalPrice: 1,
        network: 1,
        totalPower: 1,
        "user.name": 1,
        "charger.address": 1,
        "charger.hwId": 1,
        userId: 1,
        cdrId: 1,
        chargerType: 1,
      };

      let listByNetwork = await History.find(query, fieldsEvs).sort({
        "userId": 1,
        startDate: 1,
      });
      resolve(listByNetwork);
    } catch (error) {
      console.error(`[${context}] Error`, error.message);
      reject(error);
    }
  });
}

//Get totals by EV
function getTotalsByEv(userId, received, requested) {
  var context = "Function getTotalsByEv";
  return new Promise(async (resolve, reject) => {
    try {
      var pipeline = [
        {
          "$match": {
            "$or": [
              {
                "evOwner": userId,
              },
              {
                "$and": [
                  {
                    "userId": userId,
                  },
                  {
                    "evId": "-1",
                  },
                ],
              },
            ],
            stopDate: {
              $gte: new Date(received.startDate),
              $lte: new Date(received.endDate),
            },
            status: { $ne: process.env.PaymentStatusFaild },
          },
        },
        {
          "$group": {
            "_id": {
              "evId": "$evId",
              "licensePlate": "$ev.licensePlate",
            },
            "COUNT(*)": {
              "$sum": 1,
            },
            "SUM(CO2Saved)": {
              "$sum": "$CO2Saved",
            },
            "SUM(totalPower)": {
              "$sum": "$totalPower",
            },
            "totalPriceInclVat": {
              "$sum": "$totalPrice.incl_vat",
            },
            "totalPriceExclVat": {
              "$sum": "$totalPrice.excl_vat",
            },
            "SUM(timeCharged)": {
              "$sum": "$timeCharged",
            },
          },
        },
        {
          "$project": {
            "totalSessions": "$COUNT(*)",
            "totalCO2Saved": "$SUM(CO2Saved)",
            "totalPower": "$SUM(totalPower)",
            "totalPriceInclVat": "$totalPriceInclVat",
            "totalPriceExclVat": "$totalPriceExclVat",
            "timeCharged": "$SUM(timeCharged)",
            "evId": "$_id.evId",
            "licensePlate": "$_id.licensePlate",
            "_id": 0,
          },
        },
      ];

      let totals = await History.aggregate(pipeline);
      resolve(totals);
    } catch (error) {
      console.error(`[${context}] Error`, error.message);
      reject(error);
    }
  });
}

//Get list by ev
function getListByEv(userId, received, requested) {
  var context = "Function getListByEv";
  return new Promise(async (resolve, reject) => {
    try {
      let query = {
        "$or": [
          {
            "evOwner": userId,
          },
          {
            "$and": [
              {
                "userId": userId,
              },
              {
                "evId": "-1",
              },
            ],
          },
        ],
        stopDate: {
          $gte: new Date(received.startDate),
          $lte: new Date(received.endDate),
        },
        status: { $ne: process.env.PaymentStatusFaild },
      };

      let fieldsEvs = {
        _id: 1,
        startDate: 1,
        timeCharged: 1,
        "ev.brand": 1,
        "ev.model": 1,
        "ev.version": 1,
        "ev.licensePlate": 1,
        totalPrice: 1,
        network: 1,
        totalPower: 1,
        "user.name": 1,
        "charger.address": 1,
        "charger.hwId": 1,
        evId: 1,
        cdrId: 1,
        chargerType: 1,
      };

      let listByNetwork = await History.find(query, fieldsEvs).sort({
        "evId": 1,
        startDate: 1,
      });
      resolve(listByNetwork);
    } catch (error) {
      console.error(`[${context}] Error`, error.message);
      reject(error);
    }
  });
}

//Get totals by FLEET
function getTotalsByFleet(userId, received, requested) {
  var context = "Function getTotalsByFleet";
  return new Promise(async (resolve, reject) => {
    try {
      var pipeline = [
        {
          "$match": {
            "$or": [
              {
                "evOwner": userId,
              },
              {
                "$and": [
                  {
                    "userId": userId,
                  },
                  {
                    "evId": "-1",
                  },
                ],
              },
            ],
            stopDate: {
              $gte: new Date(received.startDate),
              $lte: new Date(received.endDate),
            },
            status: { $ne: process.env.PaymentStatusFaild },
          },
        },
        {
          "$group": {
            "_id": {
              "fleet": "$fleet._id",
              "name": "$fleet.name",
            },
            "COUNT(*)": {
              "$sum": 1,
            },
            "SUM(CO2Saved)": {
              "$sum": "$CO2Saved",
            },
            "SUM(totalPower)": {
              "$sum": "$totalPower",
            },
            "totalPriceInclVat": {
              "$sum": "$totalPrice.incl_vat",
            },
            "totalPriceExclVat": {
              "$sum": "$totalPrice.excl_vat",
            },
            "SUM(timeCharged)": {
              "$sum": "$timeCharged",
            },
          },
        },
        {
          "$project": {
            "totalSessions": "$COUNT(*)",
            "totalCO2Saved": "$SUM(CO2Saved)",
            "totalPower": "$SUM(totalPower)",
            "totalPriceInclVat": "$totalPriceInclVat",
            "totalPriceExclVat": "$totalPriceExclVat",
            "timeCharged": "$SUM(timeCharged)",
            "fleet": "$_id.fleet",
            "name": "$_id.name",
            "_id": 0,
          },
        },
      ];

      let totals = await History.aggregate(pipeline);
      resolve(totals);
    } catch (error) {
      console.error(`[${context}] Error`, error.message);
      reject(error);
    }
  });
}

//Get list by Fleet
function getListByFleet(userId, received, requested) {
  var context = "Function getListByFleet";
  return new Promise(async (resolve, reject) => {
    try {
      let query = {
        "$or": [
          {
            "evOwner": userId,
          },
          {
            "$and": [
              {
                "userId": userId,
              },
              {
                "evId": "-1",
              },
            ],
          },
        ],
        stopDate: {
          $gte: new Date(received.startDate),
          $lte: new Date(received.endDate),
        },
        status: { $ne: process.env.PaymentStatusFaild },
      };

      let fieldsEvs = {
        _id: 1,
        startDate: 1,
        timeCharged: 1,
        "ev.brand": 1,
        "ev.model": 1,
        "ev.version": 1,
        "ev.licensePlate": 1,
        totalPrice: 1,
        network: 1,
        totalPower: 1,
        "user.name": 1,
        "charger.address": 1,
        "charger.hwId": 1,
        "fleet._id": 1,
        cdrId: 1,
        chargerType: 1,
      };

      let listByNetwork = await History.find(query, fieldsEvs).sort({
        "fleet._id": 1,
        startDate: 1,
      });
      resolve(listByNetwork);
    } catch (error) {
      console.error(`[${context}] Error`, error.message);
      reject(error);
    }
  });
}

//Get totals by MobiE
function getTotalsByMobiE(userId, received, requested) {
  const context = "Function getTotalsByMobiE";
  return new Promise(async (resolve, reject) => {
    try {
      let pipeline = [
        {
          "$match": {
            "$or": [
              {
                "evOwner": userId,
              },
              {
                "$and": [
                  {
                    "userId": userId,
                  },
                  {
                    "evId": "-1",
                  },
                ],
              },
            ],
            stopDate: {
              $gte: new Date(received.startDate),
              $lte: new Date(received.endDate),
            },
            status: { $ne: process.env.PaymentStatusFaild },
            network: "MOBIE",
          },
        },
        {
          "$group": {
            "_id": {
              "network": "$network",
            },
            "COUNT(*)": {
              "$sum": 1,
            },
            "SUM(CO2Saved)": {
              "$sum": "$CO2Saved",
            },
            "SUM(totalPower)": {
              "$sum": "$totalPower",
            },
            "totalPriceInclVat": {
              "$sum": "$totalPrice.incl_vat",
            },
            "totalPriceExclVat": {
              "$sum": "$totalPrice.excl_vat",
            },
            "SUM(timeCharged)": {
              "$sum": "$timeCharged",
            },
          },
        },
        {
          "$project": {
            "totalSessions": "$COUNT(*)",
            "totalCO2Saved": "$SUM(CO2Saved)",
            "totalPower": "$SUM(totalPower)",
            "totalPriceInclVat": "$totalPriceInclVat",
            "totalPriceExclVat": "$totalPriceExclVat",
            "timeCharged": "$SUM(timeCharged)",
            "network": "$_id.network",
            "_id": 0,
          },
        },
      ];

      let totals = await History.aggregate(pipeline);
      resolve(totals);
    } catch (error) {
      console.error(`[${context}] Error`, error.message);
      reject(error);
    }
  });
}

//Get list MobiE
function getListByMobiE(userId, received, requested) {
  var context = "Function getListByMobiE";
  return new Promise(async (resolve, reject) => {
    try {
      let query = {
        "$or": [
          {
            "evOwner": userId,
          },
          {
            "$and": [
              {
                "userId": userId,
              },
              {
                "evId": "-1",
              },
            ],
          },
        ],
        stopDate: {
          $gte: new Date(received.startDate),
          $lte: new Date(received.endDate),
        },
        status: { $ne: process.env.PaymentStatusFaild },
        network: "MOBIE",
      };

      let fieldsEvs = {
        _id: 1,
        startDate: 1,
        timeCharged: 1,
        "ev.brand": 1,
        "ev.model": 1,
        "ev.version": 1,
        "ev.licensePlate": 1,
        network: 1,
        totalPower: 1,
        "user.name": 1,
        "charger.address": 1,
        "charger.hwId": 1,
        totalPrice: 1,
        cdrId: 1,
        chargerType: 1,
        finalPrices: 1,
      };

      let listByNetwork = await History.find(query, fieldsEvs).sort({
        "network": 1,
        startDate: 1,
      });
      resolve(listByNetwork);
    } catch (error) {
      console.error(`[${context}] Error`, error.message);
      reject(error);
    }
  });
}

//Get totals by Charager
function getTotalsByCharger(userId, received, requested) {
  var context = "Function getTotalsByCharger";
  return new Promise(async (resolve, reject) => {
    try {
      var pipeline = [
        {
          "$match": {
            chargerOwner: userId,
            stopDate: {
              $gte: new Date(received.startDate),
              $lte: new Date(received.endDate),
            },
            status: { $ne: process.env.PaymentStatusFaild },
          },
        },
        {
          "$group": {
            "_id": {
              "hwId": "$hwId",
              "name": "$charger.name",
              "address": "$charger.address",
            },
            "COUNT(*)": {
              "$sum": 1,
            },
            "SUM(CO2Saved)": {
              "$sum": "$CO2Saved",
            },
            "SUM(totalPower)": {
              "$sum": "$totalPower",
            },
            "totalPriceInclVat": {
              "$sum": "$totalPrice.incl_vat",
            },
            "totalPriceExclVat": {
              "$sum": "$totalPrice.excl_vat",
            },
            "SUM(timeCharged)": {
              "$sum": "$timeCharged",
            },
            "purchaseTariffDetailsExclVat": {
              "$sum": "$purchaseTariffDetails.excl_vat",
            },
            "purchaseTariffDetailsInclVat": {
              "$sum": "$purchaseTariffDetails.incl_vat",
            },
          },
        },
        {
          "$project": {
            "totalSessions": "$COUNT(*)",
            "totalCO2Saved": "$SUM(CO2Saved)",
            "totalPower": "$SUM(totalPower)",
            "totalPriceInclVat": "$totalPriceInclVat",
            "totalPriceExclVat": "$totalPriceExclVat",
            "purchaseTariffDetailsExclVat": "$purchaseTariffDetailsExclVat",
            "purchaseTariffDetailsInclVat": "$purchaseTariffDetailsInclVat",
            "timeCharged": "$SUM(timeCharged)",
            "hwId": "$_id.hwId",
            "name": "$_id.name",
            "address": "$_id.address",
            "_id": 0,
          },
        },
      ];

      let totals = await History.aggregate(pipeline);
      resolve(totals);
    } catch (error) {
      console.error(`[${context}] Error`, error.message);
      reject(error);
    }
  });
}

//Get list by Charger
function getListByCharger(userId, received, requested) {
  var context = "Function getListByCharger";
  return new Promise(async (resolve, reject) => {
    try {
      let query = {
        chargerOwner: userId,
        $and: [
          { stopDate: { $gte: received.startDate } },
          { stopDate: { $lte: received.endDate } },
        ],
        status: { $ne: process.env.PaymentStatusFaild },
      };

      let fields = {
        _id: 1,
        startDate: 1,
        timeCharged: 1,
        "ev.brand": 1,
        "ev.model": 1,
        "ev.version": 1,
        "ev.licensePlate": 1,
        "ev.fleet": 1,
        totalPrice: 1,
        network: 1,
        totalPower: 1,
        "user._id": 1,
        "user.name": 1,
        "charger.listOfFleets": 1,
        "charger.hwId": 1,
        "charger.name": 1,
        "charger.listOfGroups": 1,
        "fleet.name": 1,
        hwId: 1,
        evOwner: 1,
        purchaseTariffDetails: 1,
        cdrId: 1,
        chargerType: 1,
      };

      let listByNetwork = await History.find(query, fields).sort({
        "hwId": 1,
        startDate: 1,
      });
      if (listByNetwork.length > 0) {
        Promise.all(
          listByNetwork.map((session) => {
            return new Promise((resolve) => {
              if (session.evOwner != userId) {
                let found;
                if (
                  session.charger &&
                  session.charger !== "-1" &&
                  session.charger.listOfFleets?.length > 0 &&
                  session?.ev?.fleet
                ) {
                  found = session.charger.listOfFleets.find((fleet) => {
                    return fleet.fleetId === session.ev.fleet;
                  });
                }

                if (found) {
                  //session.ev = "-";
                  session.user.name = session.fleet.name;
                } else {
                  if (session.charger && session.charger !== "-1") {
                    if (
                      !session?.user?._id ||
                      !checkSessionUserInListOfGroups(
                        session.charger,
                        session.user?._id,
                      )
                    ) {
                      session.ev = "-";
                      session.fleet = "-";
                      session.user = "history_public";
                    }
                  } else {
                    session.ev = "-";
                    session.fleet = "-";
                    session.user = "history_public";
                  }
                }
              }
              resolve();
            });
          }),
        ).then((result) => {
          resolve(listByNetwork);
        });
      } else {
        resolve(listByNetwork);
      }
    } catch (error) {
      console.error(`[${context}] Error`, error.message);
      reject(error);
    }
  });
}

//Get totals by Plug
function getTotalsByPlug(userId, received, requested) {
  var context = "Function getTotalsByPlug";
  return new Promise(async (resolve, reject) => {
    try {
      var pipeline = [
        {
          "$match": {
            chargerOwner: userId,
            stopDate: {
              $gte: new Date(received.startDate),
              $lte: new Date(received.endDate),
            },
            status: { $ne: process.env.PaymentStatusFaild },
          },
        },
        {
          "$group": {
            "_id": {
              "hwId": "$hwId",
              "plugId": "$plugId",
              "name": "$charger.name",
              "address": "$charger.address",
            },
            "COUNT(*)": {
              "$sum": 1,
            },
            "SUM(CO2Saved)": {
              "$sum": "$CO2Saved",
            },
            "SUM(totalPower)": {
              "$sum": "$totalPower",
            },
            "totalPriceInclVat": {
              "$sum": "$totalPrice.incl_vat",
            },
            "totalPriceExclVat": {
              "$sum": "$totalPrice.excl_vat",
            },
            "SUM(timeCharged)": {
              "$sum": "$timeCharged",
            },
            "purchaseTariffDetailsExclVat": {
              "$sum": "$purchaseTariffDetails.excl_vat",
            },
            "purchaseTariffDetailsInclVat": {
              "$sum": "$purchaseTariffDetails.incl_vat",
            },
          },
        },
        {
          "$project": {
            "totalSessions": "$COUNT(*)",
            "totalCO2Saved": "$SUM(CO2Saved)",
            "totalPower": "$SUM(totalPower)",
            "totalPriceInclVat": "$totalPriceInclVat",
            "totalPriceExclVat": "$totalPriceExclVat",
            "purchaseTariffDetailsExclVat": "$purchaseTariffDetailsExclVat",
            "purchaseTariffDetailsInclVat": "$purchaseTariffDetailsInclVat",
            "timeCharged": "$SUM(timeCharged)",
            "hwId": "$_id.hwId",
            "plugId": "$_id.plugId",
            "name": "$_id.name",
            "address": "$_id.address",
            "_id": 0,
          },
        },
      ];

      let totals = await History.aggregate(pipeline);
      resolve(totals);
    } catch (error) {
      console.error(`[${context}] Error`, error.message);
      reject(error);
    }
  });
}

//Get list by PLug
function getListByPlug(userId, received, requested) {
  var context = "Function getListByPlug";
  return new Promise(async (resolve, reject) => {
    try {
      let query = {
        chargerOwner: userId,
        $and: [
          { stopDate: { $gte: received.startDate } },
          { stopDate: { $lte: received.endDate } },
        ],
        status: { $ne: process.env.PaymentStatusFaild },
      };

      let fields = {
        _id: 1,
        startDate: 1,
        timeCharged: 1,
        "ev.brand": 1,
        "ev.model": 1,
        "ev.version": 1,
        "ev.licensePlate": 1,
        "ev.fleet": 1,
        totalPrice: 1,
        network: 1,
        totalPower: 1,
        "user._id": 1,
        "user.name": 1,
        "charger.listOfFleets": 1,
        "charger.hwId": 1,
        "charger.name": 1,
        "charger.listOfGroups": 1,
        "fleet.name": 1,
        hwId: 1,
        evOwner: 1,
        purchaseTariffDetails: 1,
        cdrId: 1,
        chargerType: 1,
        plugId: 1,
      };

      let listByNetwork = await History.find(query, fields).sort({
        "hwId": 1,
        "plugId": 1,
        startDate: 1,
      });

      if (listByNetwork.length > 0) {
        Promise.all(
          listByNetwork.map((session) => {
            return new Promise((resolve) => {
              if (session.evOwner != userId) {
                let found;
                if (
                  session.charger &&
                  session.charger.listOfFleets?.length > 0 &&
                  session?.ev?.fleet
                ) {
                  found = session.charger.listOfFleets.find((fleet) => {
                    return fleet.fleetId === session.ev.fleet;
                  });
                }

                if (found) {
                  session.user.name = session.fleet.name;
                } else if (
                  !session?.user?._id ||
                  !checkSessionUserInListOfGroups(
                    session.charger,
                    session.user?._id || "",
                  )
                ) {
                  session.ev = "-";
                  session.fleet = "-";
                  session.user = "history_public";
                }
              }
              resolve();
            });
          }),
        ).then((result) => {
          resolve(listByNetwork);
        });
      } else {
        resolve(listByNetwork);
      }
    } catch (error) {
      console.error(`[${context}] Error`, error.message);
      reject(error);
    }
  });
}

//Get totals by Plug
function getTotalsByPlug(userId, received, requested) {
  var context = "Function getTotalsByPlug";
  return new Promise(async (resolve, reject) => {
    try {
      var pipeline = [
        {
          "$match": {
            chargerOwner: userId,
            stopDate: {
              $gte: new Date(received.startDate),
              $lte: new Date(received.endDate),
            },
            status: { $ne: process.env.PaymentStatusFaild },
          },
        },
        {
          "$group": {
            "_id": {
              "hwId": "$hwId",
              "plugId": "$plugId",
              "name": "$charger.name",
              "address": "$charger.address",
            },
            "COUNT(*)": {
              "$sum": 1,
            },
            "SUM(CO2Saved)": {
              "$sum": "$CO2Saved",
            },
            "SUM(totalPower)": {
              "$sum": "$totalPower",
            },
            "totalPriceInclVat": {
              "$sum": "$totalPrice.incl_vat",
            },
            "totalPriceExclVat": {
              "$sum": "$totalPrice.excl_vat",
            },
            "SUM(timeCharged)": {
              "$sum": "$timeCharged",
            },
            "purchaseTariffDetailsExclVat": {
              "$sum": "$purchaseTariffDetails.excl_vat",
            },
            "purchaseTariffDetailsInclVat": {
              "$sum": "$purchaseTariffDetails.incl_vat",
            },
          },
        },
        {
          "$project": {
            "totalSessions": "$COUNT(*)",
            "totalCO2Saved": "$SUM(CO2Saved)",
            "totalPower": "$SUM(totalPower)",
            "totalPriceInclVat": "$totalPriceInclVat",
            "totalPriceExclVat": "$totalPriceExclVat",
            "purchaseTariffDetailsExclVat": "$purchaseTariffDetailsExclVat",
            "purchaseTariffDetailsInclVat": "$purchaseTariffDetailsInclVat",
            "timeCharged": "$SUM(timeCharged)",
            "hwId": "$_id.hwId",
            "plugId": "$_id.plugId",
            "name": "$_id.name",
            "address": "$_id.address",
            "_id": 0,
          },
        },
      ];

      let totals = await History.aggregate(pipeline);
      resolve(totals);
    } catch (error) {
      console.error(`[${context}] Error`, error.message);
      reject(error);
    }
  });
}

//Get list by PLug
function getListByPlug(userId, received, requested) {
  var context = "Function getListByPlug";
  return new Promise(async (resolve, reject) => {
    try {
      let query = {
        chargerOwner: userId,
        $and: [
          { stopDate: { $gte: received.startDate } },
          { stopDate: { $lte: received.endDate } },
        ],
        status: { $ne: process.env.PaymentStatusFaild },
      };

      let fields = {
        _id: 1,
        startDate: 1,
        timeCharged: 1,
        "ev.brand": 1,
        "ev.model": 1,
        "ev.version": 1,
        "ev.licensePlate": 1,
        "ev.fleet": 1,
        totalPrice: 1,
        network: 1,
        totalPower: 1,
        "user._id": 1,
        "user.name": 1,
        "charger.listOfFleets": 1,
        "charger.hwId": 1,
        "charger.name": 1,
        "charger.listOfGroups": 1,
        "fleet.name": 1,
        hwId: 1,
        evOwner: 1,
        purchaseTariffDetails: 1,
        cdrId: 1,
        chargerType: 1,
        plugId: 1,
      };

      let listByNetwork = await History.find(query, fields).sort({
        "hwId": 1,
        "plugId": 1,
        startDate: 1,
      });

      if (listByNetwork.length > 0) {
        Promise.all(
          listByNetwork.map((session) => {
            return new Promise((resolve) => {
              if (session.evOwner != userId) {
                let found = session.charger.listOfFleets.find((fleet) => {
                  return fleet.fleetId === session.ev.fleet;
                });

                if (found) {
                  //session.ev = "-";
                  session.user.name = session.fleet.name;
                } else if (
                  !session?.user?._id ||
                  !checkSessionUserInListOfGroups(
                    session.charger,
                    session.user?._id || "",
                  )
                ) {
                  session.ev = "-";
                  session.fleet = "-";
                  session.user = "history_public";
                }
              }
              resolve();
            });
          }),
        ).then((result) => {
          resolve(listByNetwork);
        });
      } else {
        resolve(listByNetwork);
      }
    } catch (error) {
      console.error(`[${context}] Error`, error.message);
      reject(error);
    }
  });
}

//Get totals by Infrastructure
function getTotalsByInfrastructure(userId, received, requested) {
  var context = "Function getTotalsByInfrastructure";
  return new Promise(async (resolve, reject) => {
    try {
      var pipeline = [
        {
          "$match": {
            chargerOwner: userId,
            stopDate: {
              $gte: new Date(received.startDate),
              $lte: new Date(received.endDate),
            },
            status: { $ne: process.env.PaymentStatusFaild },
          },
        },
        {
          "$group": {
            "_id": {
              "infrastructure": "$infrastructure._id",
              "name": "$infrastructure.name",
            },
            "COUNT(*)": {
              "$sum": 1,
            },
            "SUM(CO2Saved)": {
              "$sum": "$CO2Saved",
            },
            "SUM(totalPower)": {
              "$sum": "$totalPower",
            },
            "totalPriceInclVat": {
              "$sum": "$totalPrice.incl_vat",
            },
            "totalPriceExclVat": {
              "$sum": "$totalPrice.excl_vat",
            },
            "SUM(timeCharged)": {
              "$sum": "$timeCharged",
            },
            "purchaseTariffDetailsExclVat": {
              "$sum": "$purchaseTariffDetails.excl_vat",
            },
            "purchaseTariffDetailsInclVat": {
              "$sum": "$purchaseTariffDetails.incl_vat",
            },
          },
        },
        {
          "$project": {
            "totalSessions": "$COUNT(*)",
            "totalCO2Saved": "$SUM(CO2Saved)",
            "totalPower": "$SUM(totalPower)",
            "totalPriceInclVat": "$totalPriceInclVat",
            "totalPriceExclVat": "$totalPriceExclVat",
            "purchaseTariffDetailsExclVat": "$purchaseTariffDetailsExclVat",
            "purchaseTariffDetailsInclVat": "$purchaseTariffDetailsInclVat",
            "timeCharged": "$SUM(timeCharged)",
            "infrastructure": "$_id.infrastructure",
            "name": "$_id.name",
            "_id": 0,
          },
        },
      ];

      let totals = await History.aggregate(pipeline);
      resolve(totals);
    } catch (error) {
      console.error(`[${context}] Error`, error.message);
      reject(error);
    }
  });
}

//Get list by Infrastructure
function getListByInfrastructure(userId, received, requested) {
  var context = "Function getListByInfrastructure";
  return new Promise(async (resolve, reject) => {
    try {
      let query = {
        chargerOwner: userId,
        $and: [
          { stopDate: { $gte: received.startDate } },
          { stopDate: { $lte: received.endDate } },
        ],
        status: { $ne: process.env.PaymentStatusFaild },
      };

      let fields = {
        _id: 1,
        startDate: 1,
        timeCharged: 1,
        "ev.brand": 1,
        "ev.model": 1,
        "ev.version": 1,
        "ev.licensePlate": 1,
        "ev.fleet": 1,
        totalPrice: 1,
        network: 1,
        totalPower: 1,
        "user._id": 1,
        "user.name": 1,
        "charger.address": 1,
        "charger.listOfFleets": 1,
        "charger.listOfGroups": 1,
        "charger.hwId": 1,
        "charger.name": 1,
        "infrastructure._id": 1,
        evOwner: 1,
        purchaseTariffDetails: 1,
        "fleet.name": 1,
        cdrId: 1,
        chargerType: 1,
      };

      let listByNetwork = await History.find(query, fields).sort({
        "infrastructure._id": 1,
        startDate: 1,
      });

      if (listByNetwork.length > 0) {
        Promise.all(
          listByNetwork.map((session) => {
            return new Promise((resolve) => {
              if (session.evOwner != userId) {
                let found;

                if (
                  session.charger &&
                  session.charger !== "-1" &&
                  session.charger.listOfFleets?.length > 0 &&
                  session?.ev?.fleet
                ) {
                  found = session.charger.listOfFleets.find((fleet) => {
                    return fleet.fleetId === session.ev.fleet;
                  });
                }

                if (found) {
                  //session.ev = "-";
                  session.user.name = session.fleet.name;
                } else {
                  if (session.charger && session.charger !== "-1") {
                    if (
                      !session?.user?._id ||
                      !checkSessionUserInListOfGroups(
                        session.charger,
                        session.user?._id || "",
                      )
                    ) {
                      session.ev = "-";
                      session.fleet = "-";
                      session.user = "history_public";
                    }
                  } else {
                    session.ev = "-";
                    session.fleet = "-";
                    session.user = "history_public";
                  }
                }
              }
              resolve();
            });
          }),
        ).then((result) => {
          resolve(listByNetwork);
        });
      } else {
        resolve(listByNetwork);
      }
    } catch (error) {
      console.error(`[${context}] Error`, error.message);
      reject(error);
    }
  });
}

function joinGroups(totals, listGroup, groupBy) {
  let context = "Function joinGroups";
  return new Promise(async (resolve, reject) => {
    try {
      let newList = [];
      let list;
      let newElem;

      if (totals.length === 0) {
        resolve(newList);
      }

      Promise.all(
        totals.map((elem) => {
          return new Promise(async (resolve, reject) => {
            switch (groupBy) {
              case "BYNETWORK":
                list = listGroup.filter((elemt) => {
                  return elemt.network === elem.network;
                });

                elem.list = list;

                break;
              case "BYUSER":
                list = listGroup.filter((elemt) => {
                  return elemt.userId === elem.userId;
                });
                elem.list = list;

                break;
              case "BYEV":
                list = listGroup.filter((elemt) => {
                  return elemt.evId === elem.evId;
                });
                elem.list = list;

                break;
              case "BYFLEET":
                list = listGroup.filter((elemt) => {
                  if (elemt.fleet) return elemt.fleet._id === elem.fleet;
                });
                elem.list = list;

                break;
              case "CHARGER":
                list = listGroup.filter((elemt) => {
                  return elemt.hwId === elem.hwId;
                });
                elem.list = list;

                break;
              case "PLUGS":
                list = listGroup.filter((elemt) => {
                  return (
                    elemt.hwId === elem.hwId && elemt.plugId === elem.plugId
                  );
                });
                elem.list = list;

                break;
              case "INFRASTRUCTURE":
                list = listGroup.filter((elemt) => {
                  if (elemt.infrastructure)
                    return elemt.infrastructure._id === elem.infrastructure;
                });
                elem.list = list;

                break;
              case "USER":
                list = listGroup.filter((elemt) => {
                  if (elemt.user) return elemt.user._id === elem.user;
                });
                elem.list = list;
                break;
              default:
                reject({
                  auth: false,
                  code: "server_groupBy_not_supported",
                  message: "Group by not supported",
                });
                break;
            }

            newList.push(elem);
            resolve(true);
          });
        }),
      )
        .then(() => {
          if (groupBy === "USER") {
            let responseList = [];
            Promise.all(
              newList.map((elemt) => {
                return new Promise((resolve, reject) => {
                  if (elemt.list.length > 0) {
                    if (
                      elemt.name !== elemt.list[0].user.name &&
                      elemt.list[0].user.name === "history_public"
                    ) {
                      elemt.name = elemt.list[0].user.name;
                    }
                  }

                  let index = responseList.indexOf(
                    responseList.find((elem) => {
                      return elem.name === elemt.name;
                    }),
                  );

                  if (index > -1) {
                    responseList[index].totalSessions += elemt.totalSessions;
                    responseList[index].totalCO2Saved += elemt.totalCO2Saved;
                    responseList[index].totalPower += elemt.totalPower;
                    responseList[index].totalPriceInclVat +=
                      elemt.totalPriceInclVat;
                    responseList[index].totalPriceExclVat +=
                      elemt.totalPriceExclVat;
                    responseList[index].purchaseTariffDetailsExclVat +=
                      elemt.purchaseTariffDetailsExclVat;
                    responseList[index].purchaseTariffDetailsInclVat +=
                      elemt.purchaseTariffDetailsInclVat;
                    responseList[index].timeCharged += elemt.timeCharged;
                    responseList[index].list = responseList[index].list.concat(
                      elemt.list,
                    );
                    responseList[index].list.sort(
                      (a, b) => a.startDate - b.startDate,
                    );
                    resolve();
                  } else {
                    responseList.push(elemt);
                    resolve();
                  }
                });
              }),
            ).then(() => {
              resolve(responseList);
            });
          } else {
            resolve(newList);
          }
        })
        .catch((error) => {
          console.error(`[${context}] Error`, error.message);
          reject(error);
        });
    } catch (error) {
      console.error(`[${context}] Error`, error.message);
      reject(error);
    }
  });
}

//Get totals by Infrastructure
function getTotalsByUsers(userId, received, requested) {
  var context = "Function getTotalsByUsers";
  return new Promise(async (resolve, reject) => {
    try {
      var pipeline = [
        {
          "$match": {
            chargerOwner: userId,
            stopDate: {
              $gte: new Date(received.startDate),
              $lte: new Date(received.endDate),
            },
            status: { $ne: process.env.PaymentStatusFaild },
          },
        },
        {
          "$group": {
            "_id": {
              "user": "$user._id",
              "name": "$user.name",
            },
            "COUNT(*)": {
              "$sum": 1,
            },
            "SUM(CO2Saved)": {
              "$sum": "$CO2Saved",
            },
            "SUM(totalPower)": {
              "$sum": "$totalPower",
            },
            "totalPriceInclVat": {
              "$sum": "$totalPrice.incl_vat",
            },
            "totalPriceExclVat": {
              "$sum": "$totalPrice.excl_vat",
            },
            "SUM(timeCharged)": {
              "$sum": "$timeCharged",
            },
            "purchaseTariffDetailsExclVat": {
              "$sum": "$purchaseTariffDetails.excl_vat",
            },
            "purchaseTariffDetailsInclVat": {
              "$sum": "$purchaseTariffDetails.incl_vat",
            },
          },
        },
        {
          "$project": {
            "totalSessions": "$COUNT(*)",
            "totalCO2Saved": "$SUM(CO2Saved)",
            "totalPower": "$SUM(totalPower)",
            "totalPriceInclVat": "$totalPriceInclVat",
            "totalPriceExclVat": "$totalPriceExclVat",
            "purchaseTariffDetailsExclVat": "$purchaseTariffDetailsExclVat",
            "purchaseTariffDetailsInclVat": "$purchaseTariffDetailsInclVat",
            "timeCharged": "$SUM(timeCharged)",
            "user": "$_id.user",
            "name": "$_id.name",
            "_id": 0,
          },
        },
      ];

      let totals = await History.aggregate(pipeline);

      resolve(totals);
    } catch (error) {
      console.error(`[${context}] Error`, error.message);
      reject(error);
    }
  });
}

//Get list by Infrastructure
function getListByUsers(userId, received, requested) {
  var context = "Function getListByUsers";
  return new Promise(async (resolve, reject) => {
    try {
      let query = {
        chargerOwner: userId,
        $and: [
          { stopDate: { $gte: received.startDate } },
          { stopDate: { $lte: received.endDate } },
          { status: { $ne: process.env.PaymentStatusFaild } },
        ],
      };

      let fields = {
        _id: 1,
        startDate: 1,
        timeCharged: 1,
        "ev.brand": 1,
        "ev.model": 1,
        "ev.version": 1,
        "ev.licensePlate": 1,
        "ev.fleet": 1,
        totalPrice: 1,
        network: 1,
        totalPower: 1,
        "user._id": 1,
        "user.name": 1,
        "charger.address": 1,
        "charger.listOfFleets": 1,
        "charger.listOfGroups": 1,
        "charger.hwId": 1,
        "charger.name": 1,
        "infrastructure._id": 1,
        evOwner: 1,
        purchaseTariffDetails: 1,
        "fleet.name": 1,
        cdrId: 1,
        chargerType: 1,
      };

      let listByNetwork = await History.find(query, fields).sort({
        "user._id": 1,
        startDate: 1,
      });

      if (listByNetwork.length > 0) {
        Promise.all(
          listByNetwork.map((session) => {
            return new Promise((resolve) => {
              if (session.evOwner != userId) {
                let found;
                if (
                  session.charger &&
                  session.charger !== "-1" &&
                  session.charger.listOfFleets?.length > 0 &&
                  session?.ev?.fleet
                ) {
                  found = session.charger.listOfFleets.find((fleet) => {
                    return fleet.fleetId === session.ev.fleet;
                  });
                }

                if (found) {
                  session.user.name = session.fleet.name;
                } else {
                  if (session.charger && session.charger !== "-1") {
                    if (
                      !session?.user?._id ||
                      !checkSessionUserInListOfGroups(
                        session.charger,
                        session.user?._id,
                      )
                    ) {
                      session.ev = "-";
                      session.fleet = "-";
                      session.user = "history_public";
                    }
                  } else {
                    session.ev = "-";
                    session.fleet = "-";
                    session.user.name = "history_public";
                  }
                }
              }

              resolve();
            });
          }),
        ).then((result) => {
          resolve(listByNetwork);
        });
      } else {
        resolve(listByNetwork);
      }
    } catch (error) {
      console.error(`[${context}] Error`, error.message);
      reject(error);
    }
  });
}
