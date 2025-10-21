import { Request, Response } from 'express';
import CostTariff, { ICostTariff } from './model';
import Sentry from "@sentry/node";

export class CostTariffsController {
    public async createCostTariff(req: Request, res: Response): Promise<Response> {
        try {
            const { name, description, tariffType, userId, weekSchedule, purchaseTariffId } = req.body;

            const newCostTariff: ICostTariff = new CostTariff({ name, description, tariffType, userId, weekSchedule, purchaseTariffId });
            await newCostTariff.save();

            return res.status(201).send(newCostTariff);

        } catch (error: any) {
            console.error('[createCostTariff] Error:', error);
            Sentry.captureException(error);
            return res.status(500).send({
                auth: false,
                code: 'internal_server_error',
                message: "Internal server error"
            });
        }
    }

    public async getCostTariff(req: Request, res: Response): Promise<Response> {
        try {
            const filter = Object.fromEntries(
                Object.entries(req.query).filter(([_, value]) => value !== undefined)
            );

            const result = await CostTariff.find(filter);

            return res.status(200).json(result);
        } catch (error) {
            console.error('[getCostTariff] Error:', error);
            Sentry.captureException(error);
            return res.status(500).send({
                auth: false,
                code: 'internal_server_error',
                message: "Internal server error"
            });
        }
    }

    public async updateCostTariff(req: Request, res: Response): Promise<Response> {
        try {
            const { _id, ...updateData } = req.body;
            if (!_id) {
                return res.status(400).send({
                    auth: false,
                    code: 'server_error_cost_tariff_id_is_required',
                    message: 'Cost tariff ID is required'
                });
            }

            const updatedTariff = await CostTariff.findByIdAndUpdate(_id, updateData, { new: true });

            if (!updatedTariff) {
                return res.status(400).send({
                    auth: false,
                    code: 'server_error_cost_tariff_not_found',
                    message: 'Cost tariff not found for the given ID.'
                });
            }

            return res.status(200).send(updatedTariff);

        } catch (error) {
            console.error('[updateCostTariff] Error:', error);
            Sentry.captureException(error);
            return res.status(500).send({
                auth: false,
                code: 'internal_server_error',
                message: "Internal server error"
            });
        }
    }

    public async removeCostTariff(req: Request, res: Response): Promise<Response> {
        try {
            const { _id } = req.body;
            if (!_id) {
                return res.status(400).send({
                    auth: false,
                    code: 'server_error_cost_tariff_id_is_required',
                    message: 'Cost tariff ID is required'
                });
            }

            const deletedTariff = await CostTariff.findByIdAndDelete(_id);

            if (!deletedTariff) {
                return res.status(400).send({
                    auth: false,
                    code: 'server_error_cost_tariff_not_found',
                    message: 'Cost tariff not found for the given ID.'
                });
            }

            return res.status(200).send({ message: 'Deleted successfully' });

        } catch (error) {
            console.error('[removeCostTariff] Error:', error);
            Sentry.captureException(error);
            return res.status(500).send({
                auth: false,
                code: 'internal_server_error',
                message: "Internal server error"
            });
        }
    }
}
