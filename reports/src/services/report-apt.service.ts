import { DbClient } from 'evio-library-connections';
import { ReportHandler } from '../interfaces/report-handler.interface';
import { HISTORIES_COLLECTION, STATISTICS_DB } from '../constants';
import { IReportRequestMessage } from '@/interfaces/report.interface';

function matchStage(message: IReportRequestMessage) {
  return {
    $match: {
      evOwner: message.userId,
      stopDate: {
        $gte: new Date(message.filter.startDate),
        $lte: new Date(message.filter.endDate),
      },
      status: { $ne: 60 },
      createdWay: 'APT_START_SESSION',
    },
  };
}

function headerTotalsGroupStage() {
  return [
    {
      $group: {
        _id: {},
        'COUNT(*)': {
          $sum: 1,
        },
        'SUM(totalPower)': {
          $sum: '$totalPower',
        },
        totalPriceExclVat: {
          $sum: '$totalPrice.excl_vat',
        },
        'SUM(chargingTime)': {
          $sum: '$timeCharged',
        },
        'AVG(chargingTime)': {
          $avg: '$timeCharged',
        },
      },
    },
    {
      $project: {
        totalSessions: '$COUNT(*)',
        totalPower: '$SUM(totalPower)',
        totalPriceExclVat: '$totalPriceExclVat',
        avgTimeCharged: '$AVG(chargingTime)',
        timeCharged: '$SUM(chargingTime)',
        _id: 0,
      },
    },
  ];
}

function headerChargingStationGroupStage() {
  return [
    {
      $group: {
        _id: {
          hwId: '$hwId',
          name: '$charger.name',
          address: '$charger.address',
        },
        'COUNT(*)': {
          $sum: 1,
        },
        'SUM(totalPower)': {
          $sum: '$totalPower',
        },
        totalPriceInclVat: {
          $sum: '$totalPrice.incl_vat',
        },
        totalPriceExclVat: {
          $sum: '$totalPrice.excl_vat',
        },
        'SUM(timeCharged)': {
          $sum: '$timeCharged',
        },
        'AVG(chargingTime)': {
          $avg: '$timeCharged',
        },
      },
    },
    {
      $project: {
        totalSessions: '$COUNT(*)',
        totalPower: '$SUM(totalPower)',
        totalPriceExclVat: '$totalPriceExclVat',
        timeCharged: '$SUM(timeCharged)',
        avgTimeCharged: '$AVG(chargingTime)',
        hwId: '$_id.hwId',
        name: '$_id.name',
        address: '$_id.address',
        _id: 0,
      },
    },
  ];
}

function headerAptGroupStage() {
  return [
    {
      $group: {
        _id: {
          aptId: '$user.username',
        },
        'COUNT(*)': {
          $sum: 1,
        },
        'SUM(totalPower)': {
          $sum: '$totalPower',
        },
        totalPriceInclVat: {
          $sum: '$totalPrice.incl_vat',
        },
        totalPriceExclVat: {
          $sum: '$totalPrice.excl_vat',
        },
        'SUM(timeCharged)': {
          $sum: '$timeCharged',
        },
        'AVG(chargingTime)': {
          $avg: '$timeCharged',
        },
        address: { $first: '$address' },
      },
    },
    {
      $project: {
        totalSessions: '$COUNT(*)',
        totalPower: '$SUM(totalPower)',
        totalPriceExclVat: '$totalPriceExclVat',
        timeCharged: '$SUM(timeCharged)',
        avgTimeCharged: '$AVG(chargingTime)',
        address: '$address',
        aptId: '$_id.aptId',
        _id: 0,
      },
    },
  ];
}

function detailtedList(db: DbClient, message: IReportRequestMessage) {
  let query = {
    evOwner: message.userId,
    stopDate: {
      $gte: new Date(message.filter.startDate),
      $lte: new Date(message.filter.endDate),
    },
    status: { $ne: 60 },
    createdWay: 'APT_START_SESSION',
  };

  let fields = {
    _id: 1,
    startDate: 1,
    timeCharged: 1,
    totalPrice: 1,
    network: 1,
    totalPower: 1,
    'charger.hwId': 1,
    'charger.name': 1,
    hwId: 1,
    cdrId: 1,
    chargerType: 1,
    'user.username': 1,
  };

  return db.findMany(HISTORIES_COLLECTION, query, fields);
}

function joinList(groupByData, detailedListData, groupBy) {
  for (const t of groupByData) {
    if (groupBy.toLowerCase() === 'charger') {
      t.list = detailedListData.filter((d) => d.hwId === t.hwId);
    } else if (groupBy.toLowerCase() === 'apt') {
      t.list = detailedListData.filter((d) => d.user?.username === t.aptId);
    } else {
      t.list = [];
    }
  }
}

export const aptReport: ReportHandler = {
  async generate(message: IReportRequestMessage) {
    const db = await DbClient.getInstance(STATISTICS_DB);

    const match = matchStage(message);
    const totals = headerTotalsGroupStage();
    const headerPipeline = [match, ...totals];
    let groupByData;

    switch (message.filter?.groupBy?.toLowerCase()) {
      case 'charger':
        groupByData = await db.findAggregated(HISTORIES_COLLECTION, [
          match,
          ...headerChargingStationGroupStage(),
        ]);
        break;
      case 'apt':
        groupByData = await db.findAggregated(HISTORIES_COLLECTION, [
          match,
          ...headerAptGroupStage(),
        ]);
        break;
      default:
        throw new Error('Invalid groupBy value');
    }

    const detailedListData = await detailtedList(db, message);
    const headerTotalData = await db.findAggregated(
      HISTORIES_COLLECTION,
      headerPipeline,
    );

    joinList(groupByData, detailedListData, message.filter?.groupBy);
    console.log(
      JSON.stringify({
        totals: headerTotalData,
        totalsGroupBy: groupByData,
      }),
    );
    return {
      totals: headerTotalData,
      totalsGroupBy: groupByData,
    };
  },
};
