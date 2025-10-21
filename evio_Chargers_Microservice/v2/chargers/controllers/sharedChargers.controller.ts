import Sentry from '@sentry/node';
import axios from 'axios';
import { Request, Response } from 'express';

import ChargeModel from '../../../v2/chargerModels/model';
import Charger from '../../../models/charger';
import Infrastructure from '../../../models/infrastructure';
import constants from '../../../utils/constants';
import DurationHelper from "../helpers/durationHelper";


async function _getGroupsCSUsersMap(userId: string) {
  const context = '[ChargerV2Controller _getGroupsCSUsersMap]';

  try {
      const headers = { userid: userId };
      const host = `${process.env.HostUser}${process.env.PathGetGroupCSUsersMap}`;

      const response = await axios.get(host, { headers });
      if (!response || !response.data) {
          console.error(`${context} No data returned from ${host}`);
          return [];
      }

      return response.data || [];

  } catch (error: any) {
      console.error(`${context} Error fetching groups for user ${userId}:`, error.message);
      Sentry.captureException(error);
      return [];
  }
}

export async function _getEVsMap(userId: string): Promise<string[]> {
  const context = '[ChargerV2Controller _getEVsMap]';

  try {
      const headers = { userid: userId };
      const host = `${process.env.HostEvs}${process.env.PathGetAllEVsByUser}`;

      const response = await axios.get(host, { headers });
      if (!response || !response.data) {
          console.error(`${context} No data returned from ${host}`);
          return [];
      }

      if (!response.data || response.data.length === 0) {
          return [];
      }

      let listFleetIds: string[];
      listFleetIds = response.data.map((ev: any) => ev.fleet);
      return listFleetIds;

  } catch (error: any) {
      console.error(`${context} Error fetching EVs for user ${userId}:`, error.message);
      Sentry.captureException(error);
      return [];
  }
}

function _InputTextChargersFilters(inputText: string) {
    const filterConditions: any[] = [];
    if (inputText) {
        const regexFilter = { $regex: inputText, $options: 'i' };
        filterConditions.push(
            { hwId: regexFilter },
            { name: regexFilter },
            { 'plugs.qrCodeId': regexFilter },
            { cpe: regexFilter }
        );
    }
    return filterConditions.length > 0 ? filterConditions : [{}];
}

async function _getModelByVendorAndModel(vendor: string, model: string): Promise<any> {
    return ChargeModel.findOne({
        manufacturer: vendor,
        'models.model': model,
    });
}

//Get a list of shared chargers associated with a specific user.
export async function getSharedChargers(req, res) {
  const context = '[ChargerV2Controller getSharedChargers]';

  try {
      const userId = req.headers['userid'] as string;
      if (!userId) {
          return res.status(400).json({
              auth: false,
              code: 'server_error_user_id_required',
              message: "User Id required"
          });
      }

      const groups = await _getGroupsCSUsersMap(userId);
      const fleets = await _getEVsMap(userId);

      const { page = 1, limit = 10, sort = 'name', order = 'asc' } = req.query;
      const inputText = req.query.inputText?.toString().trim() || '';

      if (groups.length === 0 && fleets.length === 0) {
          return res.status(200).send({ data: [], totalChargers: 0, totalPlugs: 0 });
      }

      let baseSharedQuery: any = {
          hasInfrastructure: true,
          active: true,
          $or: [],
      };

      if (groups.length > 0) {
          baseSharedQuery.$or.push({
              'listOfGroups': { $elemMatch: { 'groupId': groups } }
          });
      }

      if (fleets.length > 0) {
          baseSharedQuery.$or.push({
              'listOfFleets': { $elemMatch: { 'fleetId': fleets } }
          });
      }

      let sharedChargersQuery: any;
      if (inputText !== '') {
          sharedChargersQuery = {
              ...baseSharedQuery,
              $and: [
                  { $or: baseSharedQuery.$or },
                  { $or: _InputTextChargersFilters(inputText) }
              ]
          };
          delete sharedChargersQuery.$or;
      } else {
          sharedChargersQuery = baseSharedQuery;
      }

      const chargers = await Charger.find(sharedChargersQuery);

      // Sort the chargers array based on the specified field and order
      const sortedChargers = chargers.sort((a, b) => {
          // If the order is ascending, compare the values of the specified field (sort) in ascending order
          // Otherwise, compare the values of the specified field (sort) in descending order
          return order === 'asc'
              ? (a[sort] || '').localeCompare(b[sort] || '')
              : (b[sort] || '').localeCompare(a[sort] || '');
      });

      const paginatedSharedChargers = sortedChargers.slice((page - 1) * limit, page * limit);

      let totalChargersPerPage = 0;
      let totalPlugsPerPage = 0;

      const sharedChargersResponse = await Promise.all(
          paginatedSharedChargers.map(async (charger) => {
              const location = await Infrastructure.findById(charger.infrastructure).then((infra) => infra?.name || '');

              const sharedChargerItem = {
                  _id: charger._id,
                  chargerId: charger.hwId || '',
                  chargerName: charger.name,
                  location,
                  qrCode: '',
                  state: charger.active ? 'Active' : 'Inactive',
                  accessibility: charger.accessType || '',
                  status: charger.status || '',
              };

              const plugs = (charger.plugs || []).map((plug, plugIndex) => {
                  totalPlugsPerPage++;
                  const statusChangeDate = new Date(plug.statusChangeDate);
                  const currentTime = new Date();
                  const durationInMilliseconds = currentTime.getTime() - statusChangeDate.getTime();
                  const durationInSeconds = Math.floor(durationInMilliseconds / 1000);
                  const duration = DurationHelper.formatDuration(durationInSeconds);
                  return {
                      plugId: plug.plugId || '',
                      plugNumber: plugIndex + 1,
                      qrCode: plug.qrCodeId || '',
                      status: plug.status || '',
                      connectorStatus: plug.subStatus,
                      duration,
                  };
              });

              totalChargersPerPage++;

              return {
                  sharedChargerItem,
                  plugs,
              };
          })
      );

      const totalPlugs = chargers.reduce((sum, charger) => sum + (charger.plugs ? charger.plugs.length : 0), 0);

      res.status(200).send({
          data: sharedChargersResponse,
          totalChargers: chargers.length,
          totalChargersPerPage,
          totalPlugs,
          totalPlugsPerPage
      });

  } catch (error) {
      console.error(`${context} Error listing chargers:`, error.message);
      Sentry.captureException(error);
      return res.status(500).send({
          auth: false,
          code: 'internal_server_error',
          message: "Internal server error"
      });
  }
}

export async function getSharedChargerQRCode(req, res) {
  const context = '[ChargerV2Controller getSharedChargerQRCode]';

  try {
      const qrCodeId = req.query.qrCodeId as string;
      const userId = req.headers['userid'] as string;
      const clientName = req.headers['clientname'] as string;

      if (!userId) {
          return res.status(400).json({
              auth: false,
              code: 'server_error_user_id_required',
              message: "User Id required"
          });
      }

      if (!qrCodeId) {
          return res.status(400).send({
              auth: false,
              code: "server_error_qrCodeId_required",
              message: "Qr code id is required"
          });
      }

      if (!clientName) {
          return res.status(400).send({
              auth: false,
              code: 'server_error_clientName_required',
              message: 'Client name is required'
          });
      }

      const [
          groups,
          fleets
      ] = await Promise.all([
          _getGroupsCSUsersMap(userId),
          _getEVsMap(userId)
      ]);

      let sharedChargersQuery;

      if (groups.length === 0 && fleets.length === 0) {
          return res.status(400).send({
              auth: false,
              code: 'server_error_no_shared_chargers',
              message: 'No shared chargers found for this user'
          });
      }

      sharedChargersQuery = {
          $or: [],
          hasInfrastructure: true,
          active: true,
          'plugs.qrCodeId': qrCodeId
      }

      if (groups.length > 0) {
          sharedChargersQuery.$or.push({
              'listOfGroups': {
                  $elemMatch: { 'groupId': groups },
              },
          });
      }

      if (fleets.length > 0) {
          sharedChargersQuery.$or.push({
              'listOfFleets': {
                  $elemMatch: { 'fleetId': fleets },
              },
          });
      }

      const sharedCharger = await Charger.findOne({
          ...sharedChargersQuery,
      });

      if (!sharedCharger) {
          return res.status(400).send({
              auth: false,
              code: 'server_error_shared_charger_not_found',
              message: 'Shared charger not found for the provided QR Code ID'
          });
      }

      const plug = (sharedCharger.plugs || []).find(p => p.qrCodeId === qrCodeId);

      if (!plug) {
          return res.status(400).send({
              auth: false,
              code: 'server_error_plug_not_found',
              message: 'Plug not found for given parameters'
          });
      }

      const qrCodeLink = `${constants.qrCodeLink}${qrCodeId}`;
      if (!qrCodeLink) {
          return res.status(400).send({
              auth: false,
              code: 'server_error_qr_icon_not_found',
              message: 'QR Code Icon not found in customization data'
          });
      }

      const qrCodeDetails = {
          qrCodeId: qrCodeId,
          link: qrCodeLink,
          chargerId: sharedCharger.hwId,
          connectorId: plug.plugId,
      };

      return res.status(200).send(qrCodeDetails);

  } catch (error) {
      console.error(`${context} Error fetching QR code details:`, error.message);
      Sentry.captureException(error);
      return res.status(500).send({
          auth: false,
          code: 'internal_server_error',
          message: "Internal server error"
      });
  }
}

export async function deleteSharedCharger(req: Request, res: Response) {
  const context = '[ChargerV2Controller deleteSharedCharger]';

  try {
      const userId = req.headers['userid'] as string;
      if (!userId) {
          return res.status(400).json({
              auth: false,
              code: 'server_error_user_id_required',
              message: "User Id required"
          });
      }

      const sharedCharger = req.body;
      if (!sharedCharger || !sharedCharger._id) {
          return res.status(400).send({
              auth: false,
              code: 'server_error_charger_id_required',
              message: 'Charger Id is required'
          });
      }

      const [groups, fleets] = await Promise.all([
          _getGroupsCSUsersMap(userId),
          _getEVsMap(userId),
      ]);

      if (groups.length === 0 && fleets.length === 0) {
          return res.status(400).send({
              auth: false,
              code: 'server_error_no_shared_chargers',
              message: 'No shared chargers found for this user'
          });
      }

      // Find the charger to ensure it exists and the user has permission to delete it
      const charger = await Charger.findOne({
          _id: sharedCharger._id,
          $or: [
              { 'listOfGroups.groupId': { $in: groups } },
              { 'listOfFleets.fleetId': { $in: fleets } },
          ],
          active: true,
      });

      if (!charger) {
          return res.status(400).send({
              auth: false,
              code: 'server_error_charger_not_found',
              message: 'Charger not found for given parameters'
          });
      }

      // Check if any plug is in use
      const inUsePlugs = charger.plugs.filter((plug) => plug.status === process.env.PlugsStatusInUse);
      if (inUsePlugs.length > 0) {
          return res.status(400).send({
              message: 'Charger cannot be deleted as it has plugs currently in use',
          });
      }

      // Perform the deletion
      const result = await Charger.deleteOne({ _id: sharedCharger._id });
      if (result.deletedCount === 0) {
          return res.status(400).send({
              auth: false,
              code: 'server_error_charger_deletion_failed',
              message: 'Charger could not be deleted'
          });
      }

      return res.status(200).send({ message: 'Shared charger deleted successfully' });

  } catch (error: any) {
      console.error(`${context} Error deleting shared charger:`, error.message);
      Sentry.captureException(error);
      return res.status(500).send({
          auth: false,
          code: 'internal_server_error',
          message: "Internal server error"
      });
  }
}

export async function getSharedChargerDetail(req: Request, res: Response) {
  const context = '[ChargerV2Controller getSharedChargerDetail]';

  try {
      const userId = req.headers['userid'] as string;
      if (!userId) {
          return res.status(400).json({
              auth: false,
              code: 'server_error_user_id_required',
              message: "User Id required"
          });
          return res.status(400).send({ message: 'User ID is required' });
      }

      const chargerId = req.query.chargerId as string;
      if (!chargerId) {
          return res.status(400).send({
              auth: false,
              code: 'server_error_charger_id_required',
              message: 'Charger Id is required'
          });
      }

      const [groups, fleets] = await Promise.all([
          _getGroupsCSUsersMap(userId),
          _getEVsMap(userId),
      ]);

      if (groups.length === 0 && fleets.length === 0) {
          return res.status(400).send({
              auth: false,
              code: 'server_error_no_shared_chargers',
              message: 'No shared chargers found for this user'
          });
      }

      const sharedChargersQuery = {
          $or: [
              { 'listOfGroups.groupId': { $in: groups } },
              { 'listOfFleets.fleetId': { $in: fleets } },
          ],
          hasInfrastructure: true,
          active: true,
          hwId: chargerId,
      };

      const charger = await Charger.findOne(sharedChargersQuery);
      if (!charger) {
          return res.status(400).send({
              auth: false,
              code: 'server_error_charger_not_found',
              message: 'Charger not found for given parameters'
          });
      }

      const modelExists = await _getModelByVendorAndModel(charger.vendor, charger.model);
      if (!modelExists) {
          return res.status(400).send({
              auth: false,
              code: 'server_error_model_or_vendor_not_found',
              message: 'The specified model or vendor could not be found.'
          });
      }

      const address = charger.address
          ? `${charger.address.street || ''}, ${charger.address.city || ''}, ${charger.address.state || ''}, ${charger.address.country || ''}`
          : 'Address not available';

      const chargerDetail = {
          chargerId: charger.hwId,
          image: charger.imageContent || '',
          brand: modelExists.manufacturer || '',
          model: modelExists.models.find((m: any) => m.model === charger.model)?.model || '',
          connectorsInfo: (charger.plugs || []).map((plug) => ({
              connectorId: plug.plugId || '',
              connectorStatus: plug.subStatus,
              connectorType: plug.connectorType || '',
              current: plug.current || '',
              voltage: plug.voltage || '',
              power: plug.power || '',
          })),
          address,
          latitude: charger.geometry?.coordinates?.[1] || '',
          longitude: charger.geometry?.coordinates?.[0] || '',
          location: charger?.infrastructure || '',
          locationType: charger.facilitiesTypes?.map((ft) => ft.facility).join(', ') || '',
          parkingType: charger.parkingType || '',
      };

      return res.status(200).send({
          data: chargerDetail,
      });

  } catch (error: any) {
      console.error(`${context} Error fetching shared charger detail:`, error.message);
      Sentry.captureException(error);
      return res.status(500).send({
          auth: false,
          code: 'internal_server_error',
          message: "Internal server error"
      });
  }
}
