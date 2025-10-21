import { aggregatePrivateChargers } from 'evio-library-chargers'

import { ChargerDtoTotalFilters } from '../types/chargerDto'
import { GetChargersParamsType } from '../service/getChargersParams.service';
import { buildFiltersMatch, buildLocationFilters } from './chargers.repository'
import { InfrastructureMap } from './infrastrutures.respository'

function buildCountPipeline(field: string) {
  return [
    { $group: { _id: `$${field}`, total: { $sum: 1 } } },
    { $project: { value:'$_id', total:1, _id:0 } }
  ]
}

function buildLocationPipeline() {
  return [
    { $set: { infrastructure: { $toObjectId: '$infrastructure'}}},
    { $lookup: { from: 'infrastructures', localField: 'infrastructure', foreignField: '_id', as: 'location'}},
    { $set: { location: { $first: '$location.name'}}},
    ...buildCountPipeline('location')
  ]
}

function buildFiltersMatches(params: GetChargersParamsType, infrastructures: InfrastructureMap) {
  if (params.inputText) return {}

  const base = buildFiltersMatch(params.filters)

  if (params.locations?.length) {
    Object.assign(base, buildLocationFilters(params.locations, infrastructures))
  }

  return base
}

function buildUniqueValuePipeline(field: string) {
  return [
    { $group: { _id: `$${field}` } },
    { $project: { value: '$_id', _id: 0 } }
  ];
}


export async function countChargersByFilters(
    userId: string,
    params: GetChargersParamsType,
    infrastructures: InfrastructureMap
): Promise<Array<ChargerDtoTotalFilters>> {
  const matchFilters = { createUser: userId, ...buildFiltersMatches(params, infrastructures) };

  const aggregationPipeline = [
    { $match: matchFilters },
    {
      $facet: {
        location: buildLocationPipeline(),
        accessibility: buildCountPipeline('accessType'),
        chargerStatus: buildCountPipeline('status'),
        state: [
          { $group: { _id: '$active', total: { $sum: 1 } } },
          {
            $project: {
              value: {
                $cond: { if: '$_id', then: 'ACTIVE', else: 'INACTIVE' }
              },
              total: 1,
              _id: 0
            }
          }
        ],
        connectorStatus: [
          { $unwind: '$plugs' },
          { $group: { _id: '$plugs.subStatus', total: { $sum: 1 } } },
          { $project: { value: '$_id', total: 1, _id: 0 } }
        ]
      }
    }
  ];

  const resultFromQuery = (await aggregatePrivateChargers(aggregationPipeline))[0];

  const allValuesPipeline = [
    { $match: { createUser: userId } },
    {
      $facet: {
        state: [
          { $group: { _id: '$active', total: { $sum: 1 } } },
          {
            $project: {
              value: {
                $cond: { if: '$_id', then: 'ACTIVE', else: 'INACTIVE' }
              },
              total: 1,
              _id: 0
            }
          }
        ],
        accessibility: buildUniqueValuePipeline('accessType'),
        chargerStatus: buildUniqueValuePipeline('status'),
        connectorStatus: [
          { $unwind: '$plugs' },
          { $group: { _id: '$plugs.subStatus' } },
          { $project: { value: '$_id', _id: 0 } }
        ]
      }
    }
  ];

  const allValues = (await aggregatePrivateChargers(allValuesPipeline))[0];

  const finalResult: ChargerDtoTotalFilters[] = [];

  for (const [title, possibleValues] of Object.entries(allValues)) {
    const valuesFromQuery = (resultFromQuery?.[title] || []) as { value: string, total: number }[];

    const filledValues = (possibleValues as { value: string }[]).map((pv) => {
      const found = valuesFromQuery.find((v) => v.value === pv.value);
      return {
        value: pv.value,
        total: found?.total ?? 0
      };
    });

    finalResult.push({
      title,
      values: filledValues
    });
  }

  return finalResult;
}

export async function countChargersAndPlugsByUserId(userId: string) {
  const pipeline = [
    { $match: { createUser: userId } },
    { $project: { plugs: { '$size': '$plugs' } } },
    { $group: { _id: null, totalChargers: { $sum: 1 }, totalPlugs: { $sum: '$plugs' } } }
  ]

  const result = await aggregatePrivateChargers(pipeline)
  return result[0]
}

export async function countChargersAndPlugsWithFilters(
    userId: string,
    params: GetChargersParamsType,
    infrastructures: InfrastructureMap
) {
  const matchFilters = { createUser: userId, ...buildFiltersMatch(params.filters) };

  if (params.inputText) {
    const regex = RegExp(params.inputText.trim(), 'i');
    matchFilters['$or'] = [
      { hwId: regex },
      { name: regex },
      { 'plugs.qrCodeId': regex },
      { cpe: regex },
    ];
  }

  if (params.locations?.length) {
    Object.assign(matchFilters, buildLocationFilters(params.locations, infrastructures));
  }

  const pipeline = [
    { $match: matchFilters },
    { $project: { plugs: { $size: '$plugs' } } },
    { $group: { _id: null, totalChargers: { $sum: 1 }, totalPlugs: { $sum: '$plugs' } } }
  ];

  const result = await aggregatePrivateChargers(pipeline);
  return result[0] ?? { totalChargers: 0, totalPlugs: 0 };
}

