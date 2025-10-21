export const matchStage = function (received: {
  userId: any;
  startDate: string | number | Date;
  endDate: string | number | Date;
}) {
  return {
    $match: {
      evOwner: received.userId,
      stopDate: {
        $gte: new Date(received.startDate),
        $lte: new Date(received.endDate),
      },
      status: { $ne: 60 },
      createdWay: "APT_START_SESSION",
    },
  };
};

export const headerTotalsGroupStage = function () {
  return [
    {
      $group: {
        _id: {},
        "COUNT(*)": {
          $sum: 1,
        },
        "SUM(totalPower)": {
          $sum: "$totalPower",
        },
        totalPriceExclVat: {
          $sum: "$totalPrice.excl_vat",
        },
        "SUM(chargingTime)": {
          $sum: "$timeCharged",
        },
        "AVG(chargingTime)": {
          $avg: "$timeCharged",
        },
      },
    },
    {
      $project: {
        totalSessions: "$COUNT(*)",
        totalPower: "$SUM(totalPower)",
        totalPriceExclVat: "$totalPriceExclVat",
        avgTimeCharged: "$AVG(chargingTime)",
        timeCharged: "$SUM(chargingTime)",
        _id: 0,
      },
    },
  ];
};

export const headerChargingStationGroupStage = function () {
  return [
    {
      $group: {
        _id: {
          hwId: "$hwId",
          name: "$charger.name",
          address: "$charger.address",
        },
        "COUNT(*)": {
          $sum: 1,
        },
        "SUM(totalPower)": {
          $sum: "$totalPower",
        },
        totalPriceInclVat: {
          $sum: "$totalPrice.incl_vat",
        },
        totalPriceExclVat: {
          $sum: "$totalPrice.excl_vat",
        },
        "SUM(timeCharged)": {
          $sum: "$timeCharged",
        },
        "AVG(chargingTime)": {
          $avg: "$timeCharged",
        },
      },
    },
    {
      $project: {
        totalSessions: "$COUNT(*)",
        totalPower: "$SUM(totalPower)",
        totalPriceExclVat: "$totalPriceExclVat",
        timeCharged: "$SUM(timeCharged)",
        avgTimeCharged: "$AVG(chargingTime)",
        hwId: "$_id.hwId",
        name: "$_id.name",
        address: "$_id.address",
        _id: 0,
      },
    },
  ];
};

export const headerAptGroupStage = function () {
  return [
    {
      $group: {
        _id: {
          aptId: "$user.username",
        },
        "COUNT(*)": {
          $sum: 1,
        },
        "SUM(totalPower)": {
          $sum: "$totalPower",
        },
        totalPriceInclVat: {
          $sum: "$totalPrice.incl_vat",
        },
        totalPriceExclVat: {
          $sum: "$totalPrice.excl_vat",
        },
        "SUM(timeCharged)": {
          $sum: "$timeCharged",
        },
        "AVG(chargingTime)": {
          $avg: "$timeCharged",
        },
        address: { $first: "$address" },
      },
    },
    {
      $project: {
        totalSessions: "$COUNT(*)",
        totalPower: "$SUM(totalPower)",
        totalPriceExclVat: "$totalPriceExclVat",
        timeCharged: "$SUM(timeCharged)",
        avgTimeCharged: "$AVG(chargingTime)",
        address: "$address",
        aptId: "$_id.aptId",
        _id: 0,
      },
    },
  ];
};

export const detailedList = function (recieved: {
  userId: any;
  startDate: string | number | Date;
  endDate: string | number | Date;
}) {
  let query = {
    evOwner: recieved.userId,
    stopDate: {
      $gte: new Date(recieved.startDate),
      $lte: new Date(recieved.endDate),
    },
    status: { $ne: 60 },
    createdWay: "APT_START_SESSION",
  };

  let fields = {
    _id: 1,
    startDate: 1,
    timeCharged: 1,
    totalPrice: 1,
    network: 1,
    totalPower: 1,
    "charger.hwId": 1,
    "charger.name": 1,
    hwId: 1,
    cdrId: 1,
    chargerType: 1,
    "user.username": 1,
  };

  return { query, fields };
};

export const joinList = async function (
  groupByData: any,
  detailedListData: any[],
  groupBy: string,
) {
  for (const t of groupByData) {
    if (groupBy.toLowerCase() === "charger") {
      t.list = detailedListData.filter((d) => d.hwId === t.hwId);
    } else if (groupBy.toLowerCase() === "apt") {
      t.list = detailedListData.filter((d) => d.user?.username === t.aptId);
    } else {
      t.list = [];
    }
  }
};
