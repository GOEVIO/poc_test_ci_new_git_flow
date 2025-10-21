const assetService = require('../services/assets');
const { errorResponse } = require('../utils/errorHandling');

const getAssets = async (req, res) => {
    const context = `${req.method} ${req.path}`;
    try {
        return res.status(200).json(await assetService.getAssets(req));
    } catch (error) {
        return errorResponse(res, error, context);
    }
};
const createAsset = async (req, res) => {
    const context = `${req.method} ${req.path}`;
    try {
        return res.status(201).json(await assetService.createAsset(req));
    } catch (error) {
        return errorResponse(res, error, context);
    }
};

const changeNetworkStatus = async (req, res) => {
    const context = `${req.method} ${req.path}`;
    try {
        return res.status(200).json(await assetService.changeNetworkStatus(req));
    } catch (error) {
        return errorResponse(res, error, context);
    }
};

const deleteAsset = async (req, res) => {
    const context = `${req.method} ${req.path}`;
    try {
        return res.status(200).json(await assetService.deleteAsset(req));
    } catch (error) {
        return errorResponse(res, error, context);
    }
};

const updateAsset = async (req, res) => {
    const context = `${req.method} ${req.path}`;
    try {
        return res.status(200).json(await assetService.updateAsset(req));
    } catch (error) {
        return errorResponse(res, error, context);
    }
};

module.exports = {
    getAssets,
    createAsset,
    changeNetworkStatus,
    deleteAsset,
    updateAsset
};