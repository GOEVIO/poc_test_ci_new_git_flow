import Sentry from '@sentry/node';
import { Request, Response } from 'express';
import * as TariffService from '../services/salesTariff.service';
import { errorResponse } from '../helpers/error';
export async function getTariffs(req: Request, res: Response): Promise<void> {
    const context = `${req.method} ${req.path}`;
    try {
        const userId = req.headers['userid'] as string;
        const result = await TariffService.getSalesTariffs(userId);
        res.status(200).send(result);
    } catch (error) {
        errorResponse(res, error, context);

    }
}

export async function tariffDetail(req: Request, res: Response): Promise<void> {
    const context = `${req.method} ${req.path}`;
    try {
        const userId = req.headers['userid'] as string;
        const tariffId = req.params._id;
        const result = await TariffService.getTariffDetail(tariffId, userId);
        res.status(200).send(result);
    } catch (error) {
        errorResponse(res, error, context);
    }
}

export async function addTariff(req: Request, res: Response): Promise<void> {
    const context = `${req.method} ${req.path}`;
    try {
        const result = await TariffService.addSalesTariff(req);
        res.status(201).send(result);
    } catch (error) {
        errorResponse(res, error, context);
    }
}

export async function editTariff(req: Request, res: Response): Promise<void> {
    const context = `${req.method} ${req.path}`;
    try {
        const result = await TariffService.editSalesTariff(req);
        res.status(200).send(result);
    } catch (error) {
        errorResponse(res, error, context);
    }
}

export async function deleteTariff(req: Request, res: Response): Promise<void>  {
    const context = `${req.method} ${req.path}`;
    try {
        await TariffService.deleteSalesTariff(req);
        res.status(204).send();
    } catch (error) {
        errorResponse(res, error, context);
    }
}
