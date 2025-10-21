import { Request, Response } from 'express';
import ChargerTest from './model';
import toggle from 'evio-toggle';
import Sentry from '@sentry/node';

export class ChargerTestController {

    public async create(req: Request, res: Response) {
        const context = '[ChargerTestController create]';

        try {
            if (!(await toggle.isEnable('charge-118'))) {
                return res.status(403).send({ message: 'Feature not enabled' });
            }

            const chargerTest = new ChargerTest(req.body);
            await chargerTest.save();
            return res.status(201).send({ message: 'ChargerTest created successfully', data: chargerTest });

        } catch (error: any) {
            console.error(`${context} Error `, error.message);
            Sentry.captureException(error);
            return res.status(500).send({
                auth: false,
                code: 'internal_server_error',
                message: "Internal server error"
            });
        }
    }

    public async getAll(req: Request, res: Response) {
        const context = '[ChargerTestController getAll]';

        try {
            if (!(await toggle.isEnable('charge-118'))) {
                return res.status(403).send({ message: 'Feature not enabled' });
            }

            const chargerTests = await ChargerTest.find();
            return res.status(200).send({ message: 'ChargerTests retrieved successfully', data: chargerTests });

        } catch (error: any) {
            console.error(`${context} Error `, error.message);
            Sentry.captureException(error);
            return res.status(500).send({
                auth: false,
                code: 'internal_server_error',
                message: "Internal server error"
            });
        }
    }

    public async getById(req: Request, res: Response) {
        const context = '[ChargerTestController getById]';

        try {
            if (!(await toggle.isEnable('charge-118'))) {
                return res.status(403).send({ message: 'Feature not enabled' });
            }

            const { id } = req.params;
            const exists = await ChargerTest.exists({ _id: id });
            if (!exists) {
                return res.status(400).send({
                    auth: false,
                    code: 'server_error_charger_test_not_found',
                    message: 'Could not find the ChargerTest record with the provided ID.'
                });
            }

            const chargerTest = await ChargerTest.findById(id);

            return res.status(200).send({ message: 'ChargerTest retrieved successfully', data: chargerTest });

        } catch (error: any) {
            console.error(`${context} Error `, error.message);
            Sentry.captureException(error);
            return res.status(500).send({
                auth: false,
                code: 'internal_server_error',
                message: "Internal server error"
            });
        }
    }

    public async update(req: Request, res: Response) {
        const context = '[ChargerTestController update]';

        try {
            if (!(await toggle.isEnable('charge-118'))) {
                return res.status(403).send({ message: 'Feature not enabled' });
            }

            const { id } = req.params;
            const updateData = req.body;

            const chargerTest = await ChargerTest.findByIdAndUpdate(id, updateData, { new: true });
            if (!chargerTest) {
                return res.status(400).send({
                    auth: false,
                    code: 'server_error_charger_test_not_found',
                    message: 'Could not find the ChargerTest record with the provided ID.'
                });
            }
            return res.status(200).send({ message: 'ChargerTest updated successfully', data: chargerTest });

        } catch (error: any) {
            console.error(`${context} Error `, error.message);
            Sentry.captureException(error);
            return res.status(500).send({
                auth: false,
                code: 'internal_server_error',
                message: "Internal server error"
            });
        }
    }

    public async delete(req: Request, res: Response) {
        const context = '[ChargerTestController delete]';

        try {
            if (!(await toggle.isEnable('charge-118'))) {
                return res.status(403).send({ message: 'Feature not enabled' });
            }

            const { id } = req.params;
            const chargerTest = await ChargerTest.findByIdAndDelete(id);
            if (!chargerTest) {
                return res.status(400).send({
                    auth: false,
                    code: 'server_error_charger_test_not_found',
                    message: 'Could not find the ChargerTest record with the provided ID.'
                });
            }
            return res.status(200).send({ message: 'ChargerTest deleted successfully' });

        } catch (error: any) {
            console.error(`${context} Error `, error.message);
            Sentry.captureException(error);
            return res.status(500).send({
                auth: false,
                code: 'internal_server_error',
                message: "Internal server error"
            });
        }
    }
}
