import Sentry from '@sentry/node';
import { Request, Response } from 'express';
import path from 'path';

import Charger from '../../../models/charger';
import Infrastructure from '../../../models/infrastructure';
import { saveImageContent } from '../../../utils/saveImage';
import ChargeModel from '../../chargerModels/model';

async function _getInfrastructureById(id: string): Promise<any> {
  return Infrastructure.findById(id);
}

async function _getModelByVendorAndModel(vendor: string, model: string): Promise<any> {
  return ChargeModel.findOne({
      manufacturer: vendor,
      'models.model': model,
  });
}

function _setChargerTypeAndNetwork(charger: any): void {
  switch (charger.clientName) {
      case process.env.WhiteLabelGoCharge:
          charger.chargerType = _isValidChargerType(charger.chargerType) ? charger.chargerType : '011';
          charger.network = process.env.NetworkGoCharge;
          break;
      case process.env.WhiteLabelHyundai:
          charger.chargerType = _isValidChargerType(charger.chargerType) ? charger.chargerType : '012';
          charger.network = process.env.NetworkHyundai;
          break;
      case process.env.WhiteLabelKLC:
          charger.chargerType = _isValidChargerType(charger.chargerType) ? charger.chargerType : process.env.chargerTypeKLC;
          charger.network = process.env.NetworkKLC;
          break;
      case process.env.WhiteLabelKinto:
          charger.chargerType = _isValidChargerType(charger.chargerType) ? charger.chargerType : process.env.chargerTypeKinto;
          charger.network = process.env.NetworkKinto;
          break;
      default:
          charger.chargerType = '008';
          charger.network = process.env.NetworkEVIO;
          break;
  }
}

function _isValidChargerType(chargerType: string): boolean {
  return [process.env.EVIOBoxType, process.env.SonOFFType].includes(chargerType);
}

function _getOperationalStatus(chargerType: string): string {
  const operationalStatusApproved = process.env.OperationalStatusApproved || 'approved_default';
  const operationalStatusWaitingApproval = process.env.OperationalStatusWaitingAproval || 'waiting_approval_default';

  return _isValidChargerType(chargerType)
      ? operationalStatusApproved
      : operationalStatusWaitingApproval;
}

function _extractChargerData(req: Request) {
  const chargerData: any = new Charger(req.body);

  chargerData.createUser = req.headers['userid'] as string;
  chargerData.createdBy = req.headers['userid'] as string;
  chargerData.clientName = req.headers['clientname'] as string;

  return chargerData;
}

export async function create(req: Request, res: Response) {
  const context = '[ChargerV2Controller create]';

  try {
      const charger = _extractChargerData(req);

      const infrastructureExists = await _getInfrastructureById(charger.infrastructure);
      if (!infrastructureExists) {
          return res.status(400).send({
              auth: false,
              code: 'server_error_infrastructure_not_found',
              message: "Infrastructure not found for given parameters"
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

      _setChargerTypeAndNetwork(charger);
      charger.operationalStatus = _getOperationalStatus(charger.chargerType!);

      if (charger.imageContent && charger.imageContent.length > 0) {
          const directoryPath = path.join(__dirname, '../img/chargers');
          const dateNow = Date.now();
          const imageFileName = `${charger._id}_${dateNow}.jpg`;
          const imagePath = path.join(directoryPath, imageFileName);

          await saveImageContent(imageFileName, directoryPath, charger.imageContent[0], imagePath);
      }

      const newCharger = new Charger(charger);
      await newCharger.save();

      return res.status(201).send({ message: 'Charger created successfully', data: newCharger });

  } catch (error: any) {
      console.error(`[${context}] Error `, error.message);
      Sentry.captureException(error);
      return res.status(500).send({
          auth: false,
          code: 'internal_server_error',
          message: "Internal server error"
      });
  }
}
