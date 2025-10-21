import { Request, Response } from 'express';
import IdentityLib from 'evio-library-identity'
import fs from 'fs'

import { LocationsV2Dto } from './validation.middleware';
import Infrastructure from '../../models/infrastructure';
import Charger from '../../models/charger';
import Sentry from "@sentry/node";
import ChargingSession from "../../models/chargingSession";
import {LocationsFiltersConditions} from "./interfaces";
const ObjectId = require("mongoose").Types.ObjectId;
import {isFlagChooseSearchCoordinatesActive, returnCoordinatesAccordingToFlag} from '../../utils/handleCoordinates'

//Function to save image on file
function saveImageContent(infrastructure) {
  return new Promise((resolve, reject) => {

      const dateNow = Date.now();
      const path = `/usr/src/app/img/infrastructures/${infrastructure._id}_${dateNow}.jpg`;
      let pathImage = `${process.env.HostQA}infrastructures/${infrastructure._id}_${dateNow}.jpg`;
      const base64Image = infrastructure.imageContent.split(';base64,').pop();

      if (process.env.NODE_ENV === 'production') {
          pathImage = `${process.env.HostProd}infrastructures/${infrastructure._id}_${dateNow}.jpg`; // For PROD server
      }
      else if (process.env.NODE_ENV === 'pre-production') {
          pathImage = `${process.env.HostPreProd}infrastructures/${infrastructure._id}_${dateNow}.jpg`; // For PROD server
      }

      fs.writeFile(path, base64Image, { encoding: 'base64' }, function (err) {
          if (err) {
              console.error(`[Function saveImageContent] Error saving to ${path}:`, err.message);
              return reject(err);
          }

          console.log(`[Function saveImageContent] Image saved successfully: ${pathImage}`);
          infrastructure.imageContent = pathImage;
          return resolve(infrastructure);
      });
  });
};

export class LocationsV2Controller {
  #model: typeof Infrastructure;
  #saveImage: typeof saveImageContent

  // the point of this is to inject a mock, we shouldn't really have multiple implementations of the same model
  constructor(model?: typeof Infrastructure, saveImageFunc?: typeof saveImageContent) {
    this.#model = model || Infrastructure;
    this.#saveImage = saveImageFunc || saveImageContent
  }

  private async _getOrDefaultOperatorId(userId: string): Promise<string> {
    try {
      const user = await IdentityLib.findUserById(userId)
      return user.operatorId || ''
    } catch (e) {
      console.warn(`Unexpected error trying to find user by id ${userId} in database`, e)
      return ''
    }
  }

  public async create(req: Request, res: Response) {
    const body = req.body as LocationsV2Dto; // validated in middleware
    const userId = req.headers.userid as string; // validated in ApiGateway
    const clientName = req.headers.clientname as string; // validated in ApiGateway
    const operatorId = await this._getOrDefaultOperatorId(userId);

    const infrastructure = new this.#model({
      ...body,
      clientName,
      operatorId,
      createUserId: userId,
      createdBy: userId,
    });

    // save image to file system and update infrastructure with path to this image
    try {
      await this.#saveImage(infrastructure);
      await infrastructure.save();
    } catch (e) {
      console.error('Unexpected error saving infrastructure', e)
        return res.status(500).send({
            auth: false,
            code: 'internal_server_error',
            message: "Internal server error"
        });
    }

    return res.status(201).send({ message: 'created' })
  }

    private _InputTextLocationsFilters(inputText: string): LocationsFiltersConditions[] {
        const filterConditions: LocationsFiltersConditions[] = [];

        if (inputText) {
            const regexFilter = { $regex: inputText, $options: 'i' };

            filterConditions.push(
                { name: regexFilter },
                { CPE: regexFilter },
                { 'listChargers.hwId': regexFilter },
                { 'listChargers.name': regexFilter },
                { 'listChargers.plugs.qrCodeId': regexFilter }
            );
        }

        return filterConditions.length > 0 ? filterConditions : [{}];
    }

    public async getLocations(req: Request, res: Response) {
        const context = '[LocationsV2Controller getLocations]';
        try {
            const { page = 1, limit = 10, sort = 'name', order = 'asc', inputText = ''} = req.query;
            const userId = req.headers.userid as string;

            if (!userId) {
                return res.status(400).json({
                    auth: false,
                    code: 'server_error_user_id_required',
                    message: "User Id required"
                });
            }

            const sortField = typeof sort === 'string' ? sort : 'name';

            //input Text filter
            const textFilter = typeof inputText === 'string' ? inputText : '';
            const inputTextFilters = this._InputTextLocationsFilters(textFilter);
            const hasInputText = inputTextFilters.length > 0;

            const filterQuery: any = {
                createUserId: userId,
                ...(hasInputText ? { $or: inputTextFilters } : {}),
            };

            // Fetch locations associated with the user
            const locations = await this.#model.find(filterQuery);

            // Sort locations
            const sortedLocations = locations.sort((a, b) => {
                // If the order is ascending, compare the values of the specified field (sort) in ascending order
                // Otherwise, compare the values of the specified field (sort) in descending order
                return order === 'asc'
                    ? (a[sortField] || '').localeCompare(b[sortField] || '')
                    : (b[sortField] || '').localeCompare(a[sortField] || '');
            });

            // Initialize global counters
            let totalPlugs = 0;
            const locationChargerMap = new Map<string, number>();
            const totalFilters = {
                state: {},
                accessibility: {},
                chargerStatus: {},
                plugStatus: {},
            };

            // Calculate total plugs before pagination
            await Promise.all(
                locations.map(async (location) => {
                    const chargers = await Charger.find({
                        _id: { $in: location.listChargers.map((c) => c.chargerId) },
                    });

                    chargers.forEach((charger) => {
                        totalPlugs += (charger.plugs || []).length;

                        // Update totals Filters
                        const state = charger.active ? 'Active' : 'Inactive';
                        const accessibility = charger.accessType || '';
                        const chargerStatus = charger.status || '';

                        totalFilters.state[state] = (totalFilters.state[state] || 0) + 1;
                        totalFilters.accessibility[accessibility] = (totalFilters.accessibility[accessibility] || 0) + 1;
                        totalFilters.chargerStatus[chargerStatus] = (totalFilters.chargerStatus[chargerStatus] || 0) + 1;

                        (charger.plugs || []).forEach((plug) => {
                            const plugStatus = plug.status || '';
                            totalFilters.plugStatus[plugStatus] = (totalFilters.plugStatus[plugStatus] || 0) + 1;
                        });
                    });

                    // Update chargers count per location
                    const chargerCount = chargers.length;
                    if (locationChargerMap.has(location.name)) {
                        locationChargerMap.set(location.name, locationChargerMap.get(location.name)! + chargerCount);
                    } else {
                        locationChargerMap.set(location.name, chargerCount);
                    }

                })
            );

            // Convert the Map into the desired totalFiltersLocation format
            const totalFiltersLocation = Array.from(locationChargerMap.entries()).map(
                ([name, totalChargersPerLocation]) => ({
                    name,
                    totalChargersPerLocation,
                })
            );

            // Transform totalFilters into the desired output format
            const totalFiltersArray = Object.keys(totalFilters).map((key) => ({
                status: key,
                total: totalFilters[key],
            }));

            // Paginate locations
            const paginatedLocations = sortedLocations.slice((+page - 1) * +limit, +page * +limit);

            // Initialize global counters
            let totalChargersPerPage = 0;
            let totalPlugsPerPage = 0;
            const searchCoordinatesFlagActive = await isFlagChooseSearchCoordinatesActive();

            // Process each location to include chargers and plugs
            const data = await Promise.all(
                paginatedLocations.map(async (location) => {
                    // Fetch chargers associated with this location
                    const chargers = await Charger.find({
                        _id: { $in: location.listChargers.map((c) => c.chargerId) },
                    });

                    // Process chargers and their plugs
                    const chargersData = chargers.map((charger) => {
                        totalChargersPerPage++;
                        const plugsData = (charger.plugs || []).map((plug) => {
                            totalPlugsPerPage++;
                            return {
                                plugId: plug.plugId,
                                status: plug.status,
                            };
                        });
                        const { geometry } = returnCoordinatesAccordingToFlag(charger, searchCoordinatesFlagActive);
                        return {
                            _id: charger._id,
                            status: charger.status,
                            plugs: plugsData,
                            geometry: geometry?.coordinates || [],
                            additionalInformation: charger.infoPoints || '',
                        };
                    });
                    // Return location in the expected format
                    return {
                        _id: location._id,
                        name: location.name,
                        CPE: location.CPE,
                        address: location.address,
                        coordinates: location.geometry?.coordinates || [],
                        additionalInformation: location.additionalInformation || '',
                        imageContent: location.imageContent,
                        chargers: chargersData,
                    };
                })
            );

            const totalChargers = locations.reduce((sum, loc) => sum + (loc.listChargers?.length || 0), 0);

            res.status(200).send({
                data,
                totalLocations: locations.length,
                totalLocationsPerPage: paginatedLocations.length,
                totalChargers,
                totalChargersPerPage,
                totalPlugs,
                totalPlugsPerPage,
                totalFiltersLocation,
                totalFilters: ['state', 'accessibility', 'chargerStatus', 'plugStatus'].map(property => ({
                    [property]: Object.entries(totalFilters[property]).map(([value, total]) => ({ value, total }))
                }))
            });

        } catch (error) {
            console.error(`${context} Error listing locations:`, error.message);
            Sentry.captureException(error);
            return res.status(500).send({
                auth: false,
                code: 'internal_server_error',
                message: "Internal server error"
            });
        }
    }

    // Location List to dropdown
    public async getLocationsList(req: Request, res: Response) {
        const context = '[LocationsV2Controller getLocationsList]';
        try {
            const userId = req.headers.userid as string;
            if (!userId) {
                return res.status(400).json({
                    auth: false,
                    code: 'server_error_user_id_required',
                    message: "User Id required"
                });
            }

            const query: any = {createUserId: userId};

            const locations = await this.#model.find(query, { _id: 1, name: 1, address: 1 });

            res.status(200).send({locations});

        } catch (error) {
            console.error(`${context} Error listing locations:`, error.message);
            Sentry.captureException(error);
            return res.status(500).send({
                auth: false,
                code: 'internal_server_error',
                message: "Internal server error"
            });
        }
    }

    public async update(req: Request, res: Response) {
        const context = '[LocationsV2Controller update]';
        try {
            const body = req.body as LocationsV2Dto & { _id?: string }; // Validated in middleware

            const userId = req.headers.userid as string; // Validated in ApiGateway
            if (!userId) {
                return res.status(400).json({
                    auth: false,
                    code: 'server_error_user_id_required',
                    message: "User Id required"
                });
            }

            const query = { _id: ObjectId(body._id) };
            if (!query) {
                return res.status(400).send({
                    auth: false,
                    code: 'server_error_infrastructure_id_is_required',
                    message: 'Infrastructure ID is required.'
                });
            }

            // Validate infrastructure existence
            const infrastructure = await this.#model.findById(query);
            if (!infrastructure || infrastructure.createUserId !== userId) {
                return res.status(400).send({
                    auth: false,
                    code: 'server_error_infrastructure_not_found',
                    message: "Infrastructure not found for given parameters"
                });
            }

            // Prepare update fields
            const updateFields: Partial<LocationsV2Dto> = {
                name: body.name,
                address: body.address,
                CPE: body.CPE,
                additionalInformation: body.additionalInformation,
            };

            if (body.geometry && Array.isArray(body.geometry.coordinates) && body.geometry.coordinates.length === 2) {
                updateFields["geometry.coordinates"] = [
                    body.geometry.coordinates[0], // Longitude
                    body.geometry.coordinates[1]  // Latitude
                ];
            }  else {
                console.warn(`[${context}] Geometry invalid. Not be updated.`);
            }

            // Handle image update
            if (body.imageContent && typeof body.imageContent === 'string' &&  (
                body.imageContent.includes('base64') ||
                /^[A-Za-z0-9+/]+={0,2}$/.test(body.imageContent.trim())
            )) {
                try {
                    infrastructure.imageContent = body.imageContent;
                    await this.#saveImage(infrastructure);
                    updateFields.imageContent = infrastructure.imageContent;
                } catch (error) {
                    console.error(`[${context}] Error updating image:`, error.message);
                }
            } else if (body.imageContent === '' || body.imageContent === null) {
                updateFields.imageContent = '';
            }


            // Update infrastructure
            const updatedInfrastructure = await this.#model.findByIdAndUpdate(
                query,
                { $set: updateFields },
                { new: true }
            );

            if (!updatedInfrastructure) {
                return res.status(400).send({
                    auth: false,
                    code: 'server_error_infrastructure_update_failed',
                    message: 'Failed to update the infrastructure.'
                });
            }

            return res.status(200).send(updatedInfrastructure);

        } catch (error) {
            console.error(`${context} Error updating infrastructure:`, error.message);
            Sentry.captureException(error);
            return res.status(500).send({
                auth: false,
                code: 'internal_server_error',
                message: "Internal server error"
            });
        }
    }

    private async _hasActiveSessions(query): Promise<boolean> {
        const context = 'Function _hasActiveSessions';
        try {
            const chargingSessions = await ChargingSession.find(query);

            return chargingSessions.length > 0;

        } catch (error) {
            console.error(`[${context}] Error:`, error.message);
            throw error;
        }
    }

    private async _removeChargerInfrastructure(infrastructureId: string): Promise<boolean> {
        const context = '[removeChargerInfrastructure]';
        try {
            const infraObjectId = ObjectId(infrastructureId);

            const chargersFound = await (Charger as any).find({ infrastructure: infraObjectId });
            if (!chargersFound.length) return true;

            const chargersInUse = chargersFound.filter((charger: any) =>
                (charger.plugs || []).some((plug: any) => plug.status === process.env.PlugsStatusInUse)
            );

            if (chargersInUse.length > 0) {
                console.error(`${context} - Chargers in use, cannot remove infrastructure`);
                return false;
            }

            await Promise.all(
                chargersFound.map(async (charger: any) => {
                    const queryById = { _id: ObjectId(charger._id) };
                    const queryHwId = { hwId: charger.hwId };

                    const updateFields = {
                        active: false,
                        infrastructure: '',
                        hasInfrastructure: false,
                        status: process.env.ChargePointStatusEVIOFaulted,
                        operationalStatus: process.env.OperationalStatusRemoved,
                    };

                    if (await this._hasActiveSessions(queryHwId)) {
                        await (Charger as any).updateOne(queryById, { $set: updateFields });
                    } else {
                        await (Charger as any).deleteOne(queryById);
                    }
                })
            );

            return true;
        } catch (error: any) {
            console.error(`${context} Error:`, error.message);
            return false;
        }
    }

    private async _unlinkImage(infrastructure): Promise<void> {
        const context = "Function unlinkImage";
        return new Promise((resolve) => {
            try {
                if (!infrastructure.imageContent) return resolve();

                const imageName = infrastructure.imageContent.split('/').pop();
                const path = `/usr/src/app/img/infrastructures/${imageName}`;

                fs.unlink(path, (err) => {
                    if (err) {
                        if (err.code === 'ENOENT') {
                            console.warn(`[${context}] File does not exist: ${path}`);
                        } else {
                            console.error(`[${context}] [fs.unlink] Error `, err.message);
                        }
                    }
                    resolve();
                });
            } catch (error) {
                console.error(`[${context}] Error `, error.message);
                Sentry.captureException(error);
                resolve();
            }
        });
    }

    public async delete(req: Request, res: Response) {
        const context = '[LocationsV2Controller delete]';

        try{
            const { _id } = req.body as { _id?: string };
            if (!_id) {
                return res.status(400).send({
                    auth: false,
                    code: 'server_error_infrastructure_id_is_required',
                    message: 'Infrastructure ID is required.'
                });
            }

            const userId = req.headers.userid as string;
            if (!userId) {
                return res.status(400).json({
                    auth: false,
                    code: 'server_error_user_id_required',
                    message: "User Id required"
                });
            }

            const infrastructureFound = await (this.#model as any).findById(_id);
            if (!infrastructureFound || infrastructureFound.createUserId !== userId) {
                return res.status(400).send({
                    auth: false,
                    code: 'server_error_infrastructure_not_found',
                    message: 'Infrastructure not found for given parameters',
                });
            }

            const removed = await this._removeChargerInfrastructure(infrastructureFound._id.toString());
            if (!removed) {
                console.error(`${context}] Error - Fail to remove infrastructure`);
                return res.status(400).send({
                    auth: false,
                    code: 'server_error_infrastructure_cannot_be_removed_chargers_in_use',
                    message: 'Infrastructure cannot be removed because it has chargers currently in use.',
                });
            }

            if (infrastructureFound.imageContent && infrastructureFound.imageContent !== "") {
                await this._unlinkImage(infrastructureFound);
            }

            const result = await (this.#model as any).deleteOne({ _id: ObjectId(_id) });
            if (!result.deletedCount) {
                return res.status(400).send({
                    auth: false,
                    code: 'server_error_infrastructure_not_found',
                    message: "Infrastructure not found for given parameters"
                });
            }

            return res.status(200).send({ auth: true, code: 'server_infrastructure_removed', message: 'Infrastructure removed successfully' });

        } catch (error) {
            console.error(`${context} Error:`, error.message);
            Sentry.captureException(error);
            return res.status(500).send({
                auth: false,
                code: 'internal_server_error',
                message: "Internal server error"
            });
        }
    }

}


