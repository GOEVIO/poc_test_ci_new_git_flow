import express from 'express';
import type { RequestHandler } from 'express';
import { validate } from '../helpers/validate-schema';
import { CreateSalesTariffSchema, UpdateSalesTariffSchema, DeleteSalesTariffSchema } from '../schemas/sales-tariff.schema';
import {
    getTariffs,
    addTariff,
    editTariff,
    deleteTariff,
    tariffDetail
} from '../controllers/salesTariff.controller';

const router = express.Router();

router.get('', getTariffs);
router.get('/:_id', validate(DeleteSalesTariffSchema), tariffDetail);
router.post('', validate(CreateSalesTariffSchema), addTariff);
router.put('/:_id', validate(UpdateSalesTariffSchema), editTariff);
router.delete('/:_id', validate(DeleteSalesTariffSchema), deleteTariff);

export default router;
