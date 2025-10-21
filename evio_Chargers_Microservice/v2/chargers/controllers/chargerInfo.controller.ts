import Sentry from '@sentry/node';
import { Request, Response } from 'express';
import mongoose from 'mongoose';

import Charger from '../../../models/charger';
import ChargingSession from "../../../models/chargingSession";
import Infrastructure from '../../../models/infrastructure';
import SwitchBoards from "../../../models/switchBoards";
import ChargeModel from '../../chargerModels/model';
import AssetType from "../../assetType/model";
import CostTariff, {ICostTariff} from "../../costTariffs/model";
import FacilitiesType from "../../facilitiesType/model";
import ParkingType from "../../parkingType/model";
import DurationHelper from "../helpers/durationHelper";
import { updateChargerFilter } from "../helpers/updateChargerFilter";
import { validateSession } from "../helpers/validateSession";
import { changeTariff } from "../helpers/changeTariff";
import {
  ConnectorUpdate
} from '../interfaces';
import {buildAccessGroups} from "../helpers/buildAccessGroups";
import Constants from '../../../utils/constants'

const _findByIdOrField = async (model: any, idOrValue: string, field: string): Promise<any> => {
  return mongoose.Types.ObjectId.isValid(idOrValue)
      ? await model.findById(idOrValue)
      : await model.findOne({ [field]: idOrValue });
};

async function _getModelByVendorAndModel(vendor: string, model: string): Promise<any> {
    return ChargeModel.findOne({
        manufacturer: vendor,
        'models.model': model,
    });
}

export async function getChargerInfo(req: Request, res: Response): Promise<Response> {
  try {
      const chargerId = req.query.chargerId as string;
      if (!chargerId) {
          return res.status(400).send({
              auth: false,
              code: 'server_error_charger_id_required',
              message: 'Charger Id is required'
          });
      }

      const charger = await Charger.findOne({ hwId: chargerId });
      if (!charger) {
          return res.status(400).send({
              auth: false,
              code: 'server_error_charger_not_found',
              message: 'Charger not found for given parameters'
          });
      }

      const hasChargingSessions = await ChargingSession.exists({hwId: charger.hwId})

      const findParkingType = await _findByIdOrField(ParkingType, charger.parkingType, "parkingType");

      const findAssetTypes = await Promise.all(
          charger.vehiclesType.map((v) => _findByIdOrField(AssetType, v.vehicle, "vehicleType"))
      );

      const findFacilityTypes = await Promise.all(
          charger.facilitiesTypes.map((f) => _findByIdOrField(FacilitiesType, f.facility, "locationType"))
      );

      const findCostTariff = await CostTariff.findOne({
          $or: [
              { _id: charger.purchaseTariff?._id },
              { name: charger.purchaseTariff?.name }
          ]
      });

      const findSwitchBoard = await _findByIdOrField(SwitchBoards, charger.switchBoardId, "_id");

      const [infrastructure, modelExists] = await Promise.all([
          Infrastructure.findById(charger.infrastructure),
          _getModelByVendorAndModel(charger.vendor, charger.model)
      ])

      const resolvedManufacturer =
          (modelExists && (modelExists as any).manufacturer) || charger.vendor || '';
      const resolvedModel =
          (modelExists?.models?.find((m: any) => m.model === charger.model)?.model) ||
          charger.model ||
          '';

      const address = charger.address
          ? `${charger.address.street}, ${charger.address.city}, ${charger.address.state}, ${charger.address.country }`
          : 'Address not available';

      const commonData = {
          name: charger.name,
          hwId: charger.hwId,
          location: infrastructure?.name || '',
          imageLocation: infrastructure?.imageContent,
          locationId: charger.infrastructure,
          locationType: findFacilityTypes.filter(Boolean).map((f) => f?.locationType) || [],
          access: charger.accessType,
          manufacturer: resolvedManufacturer,
          model: resolvedModel,
          firmwareVersion: charger.firmwareVersion,
          address: address,
          isShownOnTheMap: charger.mapVisibility,
          allowRFID: charger.allowRFID,
          allowOfflineNotifications: charger.offlineNotification || false,
          notificationEmails: charger.offlineEmailNotification || '',
          rate: charger.rating || 0,
          coordinates: {
              latitude: charger.geometry?.coordinates[1],
              longitude: charger.geometry?.coordinates[0],
          },
          hasChargingSessions: !!hasChargingSessions
      };

      const detailsData = {
          additionalInformation: charger.infoPoints || '',
          parkingType: findParkingType?.parkingType || '',
          vehicleType: findAssetTypes.filter(Boolean).map((v) => v?.vehicleType) || [],
          costTariff: findCostTariff?.name || '',
          brand: resolvedManufacturer,
          serialNumber: charger.serialNumber,
          meterType: charger.meterType,
          switchboard: findSwitchBoard?._id || '',
          voltageLevel: charger.voltageLevel,
          internalInformation: charger.internalInfo || '',
      };

      // Build the "connectors" array
      const connectors = (charger.plugs || []).map((plug) => {
          return {
              connectorId: plug.plugId || '',
              evseId: plug.evseId || '',
              internalReference: plug.internalRef || '',
              connectorType: plug.connectorType || '',
              connectorFormat: plug.connectorFormat,
              connectorStatus: plug.subStatus || '',
              powerType: plug.powerType || '',
              power: plug.power,
              voltage: plug.voltage,
              current: plug.amperage,
              qrCodeId: plug.qrCodeId || '',
              statusTime: plug.statusTime,
              duration: plug.statusChangeDate
                  ? DurationHelper.formatDuration((Date.now() - new Date(plug.statusChangeDate).getTime()) / 1000)
                  : DurationHelper.formatDuration(0),
          };
      });

      const accessGroups = await buildAccessGroups(charger, req.headers.userid as string);

      return res.status(200).send({
          data: {
              ...commonData,
              details: detailsData,
              connectors: connectors,
              accessGroups: accessGroups
          }
      });

  } catch (error) {
      console.error('[getChargerInfo] Error:', error);
      Sentry.captureException(error);
      return res.status(500).send({
          auth: false,
          code: 'internal_server_error',
          message: "Internal server error"
      });
  }
}

async function _getNullableValidatedField(
    model: any,
    idOrValue: string | null,
    field: string
): Promise<any | null> {
    if (!idOrValue) return null;
    const result = await _findByIdOrField(model, idOrValue, field);
    return result || null;
}

function _assignIfDefined(target: any, key: string, value: any) {
  if (value !== undefined) {
      target[key] = value;
  }
}

const connectorFieldMapping: Record<keyof Omit<ConnectorUpdate, 'connectorId'>, string> = {
  evseId: 'evseId',
  internalReference: 'internalRef',
  connectorType: 'connectorType',
  connectorFormat: 'connectorFormat',
  powerType: 'powerType',
  power: 'power',
  voltage: 'voltage',
  current: 'amperage',
  qrCodeId: 'qrCodeId',
  connectorStatus: 'subStatus',
  statusTime: 'statusTime'
};

export async function updateChargerInfo(req: Request, res: Response): Promise<Response> {
    try {
        const chargerId = req.query.chargerId as string;
        if (!chargerId) {
            return res.status(400).send({
                auth: false,
                code: 'server_charger_id_required',
                message: 'Charger Id is required'
            });
        }

        let charger = await Charger.findOne({ hwId: chargerId });
        if (!charger) {
            return res.status(400).send({
                auth: false,
                code: 'server_error_charger_not_found',
                message: 'Charger not found for given parameters'
            });
        }

        _assignIfDefined(charger, 'name', req.body.name);
        _assignIfDefined(charger, 'hwId', req.body.hwId);
        _assignIfDefined(charger, 'infoPoints', req.body.additionalInformation);

        // Location
        if (req.body.locationId !== undefined) {
            const location = await _getNullableValidatedField(Infrastructure, req.body.locationId, "name");
            charger.infrastructure = location ? location._id : null;
        }

        // Parking Type
        if (req.body.parkingType !== undefined) {
            const parkingType = await _getNullableValidatedField(ParkingType, req.body.parkingType, "parkingType");
            charger.parkingType = parkingType ? parkingType.parkingType : null;
        }

        // Vehicle Type
        if (req.body.vehicleType !== undefined) {
            const findAssetTypes = await Promise.all(
                req.body.vehicleType.map((v: string) => _findByIdOrField(AssetType, v, "vehicleType"))
            );
            if (findAssetTypes.includes(null)) {
                return res.status(400).send({
                    auth: false,
                    code: 'server_error_invalid_vehicle_type',
                    message: 'Invalid vehicle type selected'
                });
            }
            charger.vehiclesType = findAssetTypes.map(v => ({ vehicle: v.vehicleType }));
        }

        // Facility Type
        if (req.body.locationType !== undefined) {
            const findFacilityTypes = await Promise.all(
                req.body.locationType.map((f: string) => _findByIdOrField(FacilitiesType, f, "locationType"))
            );
            if (findFacilityTypes.includes(null)) {
                return res.status(400).send({
                    auth: false,
                    code: 'server_error_invalid_location_type',
                    message: 'Invalid location type selected'
                });
            }
            charger.facilitiesTypes = findFacilityTypes.map(f => ({ facility: f.locationType }));
        }

        // Cost Tariff
        let costTariff: ICostTariff | null = null;

        if (req.body.costTariff) {
            if (mongoose.Types.ObjectId.isValid(req.body.costTariff)) {
                costTariff = await CostTariff.findById(req.body.costTariff);
            } else {
                costTariff = await CostTariff.findOne({ name: req.body.costTariff });
            }
        }

        charger.purchaseTariff = costTariff ? { name: costTariff.name } : null;

        // Switchboard
        if (req.body.switchboard !== undefined) {
            const switchBoard = await _getNullableValidatedField(SwitchBoards, req.body.switchboard, "_id");
            charger.switchBoardId = switchBoard ? switchBoard._id : null;
        }

        _assignIfDefined(charger, 'offlineNotification', req.body.allowOfflineNotifications);
        _assignIfDefined(charger, 'offlineEmailNotification', req.body.notificationEmails);

        // Address
        if (req.body.address) {
            charger.address = {
                street: req.body.address.street || charger.address?.street,
                city: req.body.address.city || charger.address?.city,
                state: req.body.address.state || charger.address?.state,
                country: req.body.address.country || charger.address?.country
            };
        }

        // Coordinates
        if (req.body.coordinates) {
            charger.geometry = {
                type: "Point",
                coordinates: [req.body.coordinates.longitude, req.body.coordinates.latitude]
            };
        }

        // Hardware
        _assignIfDefined(charger, 'vendor', req.body.brand);
        _assignIfDefined(charger, 'model', req.body.model);
        _assignIfDefined(charger, 'serialNumber', req.body.serialNumber);
        _assignIfDefined(charger, 'meterType', req.body.meterType);
        _assignIfDefined(charger, 'voltageLevel', req.body.voltageLevel);
        _assignIfDefined(charger, 'internalInfo', req.body.internalInformation);

        // Connectors
        if (req.body.connectors && Array.isArray(req.body.connectors)) {
            req.body.connectors.forEach((connectorUpdate: ConnectorUpdate) => {
                const { connectorId, ...fieldsToUpdate } = connectorUpdate;
                if (!connectorId) return;
                const plug = charger.plugs.find((p: any) => p.plugId === connectorId);
                if (!plug) return;

                (Object.keys(connectorFieldMapping) as (keyof Omit<ConnectorUpdate, 'connectorId'>)[]).forEach(field => {
                    if (fieldsToUpdate[field] !== undefined) {
                        const plugField = connectorFieldMapping[field];
                        plug[plugField] = fieldsToUpdate[field];
                    }
                });
            });
        }

        await charger.save();

        const editableFields = {
            name: charger.name,
            hwId: charger.hwId,
            additionalInformation: charger.infoPoints,
            locationId: charger.infrastructure,
            parkingType: charger.parkingType,
            vehicleType: charger.vehiclesType,
            locationType: charger.facilitiesTypes,
            costTariff: charger.purchaseTariff,
            switchboard: charger.switchBoardId,
            address: charger.address
                ? `${charger.address.street}, ${charger.address.city}, ${charger.address.state}, ${charger.address.country}`
                : 'Address not available',
            coordinates: charger.geometry,
            brand: charger.vendor,
            model: charger.model,
            serialNumber: charger.serialNumber,
            meterType: charger.meterType,
            voltageLevel: charger.voltageLevel,
            internalInformation: charger.internalInfo,
            connectors: charger.plugs.map((plug: any) => ({
                connectorId: plug.plugId,
                evseId: plug.evseId,
                internalReference: plug.internalRef,
                connectorType: plug.connectorType,
                connectorFormat: plug.connectorFormat,
                powerType: plug.powerType,
                power: plug.power,
                voltage: plug.voltage,
                current: plug.amperage,
                qrCodeId: plug.qrCodeId,
                connectorStatus: plug.subStatus,
                statusTime: plug.statusTime,
            }))
        };

        return res.status(200).send({ message: 'Charger info updated successfully', data: editableFields });

    } catch (error: any) {
        console.error('[updateChargerInfo] Error:', error?.message || error);
        Sentry.captureException(error);
        return res.status(500).send({
            auth: false,
            code: 'internal_server_error',
            message: error?.message || "Internal server error"
        });
    }
}

export async function updateAccess(req: Request, res: Response): Promise<Response> {
    const context = 'PATCH /v2/chargers/updateAccessType';

    try {
        const clientRequest = req.headers.client;
        const received = req.body;

        const query = {
            _id: received._id,
            hasInfrastructure: true
        };

        const chargerFound = await Charger.findOne(query);
        if (!chargerFound) {
            return res.status(400).send({
                auth: false,
                code: 'server_error_charger_not_found',
                message: 'Charger not found for given parameters'
            });
        }

        const isInUse = await validateSession(chargerFound);
        if (isInUse) {
            return res.status(400).send({
                auth: false,
                code: 'server_error_accessType_not_update',
                message: 'Access type cannot be changed while the charger is in use.'
            });
        }

        const isFreeAccess =
            received.accessType === Constants.chargerAccess.freeCharge ||
            received.accessType === Constants.chargerAccess.plugAndCharge;

        if (received.accessType === Constants.chargerAccess.private || isFreeAccess) {
            chargerFound.accessType = received.accessType;
            chargerFound.listOfGroups = [];
            chargerFound.listOfFleets = [];
        } else {
            chargerFound.accessType = received.accessType;

            if (received.mapVisibility !== undefined) {
                chargerFound.mapVisibility = received.mapVisibility;
            }

            if (received.allowRFID !== undefined) {
                chargerFound.allowRFID = received.allowRFID;
            }

            if (received.accessType === Constants.chargerAccess.public) {
                if (received.mapVisibility !== undefined && received.mapVisibility !== null) {
                    chargerFound.mapVisibility = received.mapVisibility;
                }
            }

            chargerFound.listOfGroups = received.listOfGroups ?? [];

            if (clientRequest === Constants.clientType.backOficce) {
                chargerFound.listOfFleets = received.listOfFleets ?? [];
            }
        }

        const { accessType, listOfGroups, listOfFleets, plugs, mapVisibility } = await changeTariff(chargerFound);
        const isPublicCharger = received.accessType === Constants.chargerAccess.public;

        const updateData = {
            $set: {
                accessType,
                listOfGroups,
                listOfFleets,
                plugs,
                ...isPublicCharger && { mapVisibility },
                mapVisibility: chargerFound.mapVisibility,
                allowRFID: chargerFound.allowRFID
            }
        };

        const result = await updateChargerFilter(query, updateData, { new: true });

        if (result) {
            const accessGroups = await buildAccessGroups(result, req.headers.userid as string);

            return res.status(200).send({
                isShownOnTheMap: result.mapVisibility,
                allowRFID: result.allowRFID,
                access: result.accessType,
                accessGroups: accessGroups.map(group => ({
                    id: group.id,
                    name: group.name,
                    type: group.type,
                    plugs: (group.plugs || []).map(plug => ({
                        plugId: plug.plugId,
                        tariffId: plug.tariffId || '',
                        name: plug.name || 'No tariff'
                    }))
                }))
            });
        } else {
            return res.status(400).send({
                auth: false,
                code: 'server_error_update_failed',
                message: 'The charger access type could not be updated.'
            });
        }
    } catch (error) {
        console.error(`[${context}] Error`, error.message);
        return res.status(500).send({ auth: false, code: 'internal_server_error', message: "Internal server error" });
    }
}
