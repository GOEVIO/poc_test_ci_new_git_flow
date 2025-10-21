import express, { Router, Request, Response } from 'express';
import rulesService from '../services/rules';
import { errorResponse } from '../utils/errorHandling';

const router: Router = express.Router();

router.get('/api/private/rules', async (req: Request, res: Response) => {
    try {
        const rulesList = await rulesService.listRules();
        return res.send(rulesList);
    } catch (error) {
        return errorResponse(res, error, req.path);
    }
});

router.get('/api/private/rules/:index', async (req: Request, res: Response) => {
    try {
        const rule = await rulesService.getRuleByIndex(req.params.index);
        return res.send(rule);
    } catch (error) {
        return errorResponse(res, error, req.path);
    }
});

router.post('/api/private/rules', async (req: Request, res: Response) => {
    try {
        const rule = await rulesService.createRule(req.body);
        return res.send(rule);
    } catch (error) {
        return errorResponse(res, error, req.path);
    }
});

router.put('/api/private/rules/:id', async (req: Request, res: Response) => {
    try {
        const rule = await rulesService.updateRule(req.body, req.params.id);
        return res.send(rule);
    } catch (error) {
        return errorResponse(res, error, req.path);
    }
});

router.patch('/api/private/rules/:id', async (req: Request, res: Response) => {
    try {
        const rule = await rulesService.patchRule(req.body, req.params.id);
        return res.send(rule);
    } catch (error) {
        return errorResponse(res, error, req.path);
    }
});

router.delete('/api/private/rules/:id', async (req: Request, res: Response) => {
    try {
        await rulesService.disableRule(req.params.id);
        return res.status(204).send();
    } catch (error) {
        return errorResponse(res, error, req.path);
    }
});

export default router;
