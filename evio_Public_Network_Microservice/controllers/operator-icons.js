const {
    upsertOperatorIcon,
    deleteOperatorIcon,
    listIconsByPartyIds,
} = require('../services/operator-icons');

exports.createOrUpdateIcon = async (req, res, next) => {
    try {
        const { partyId } = req.params;
        const { type, base64, contentType } = req.body || {};
        if (!type || !base64) {
            return res.status(400).json({ message: 'type and base64 are required' });
        }

        const icon = await upsertOperatorIcon({ partyId, type, base64, contentType });
        res.status(200).json(icon);
    } catch (err) {
        next(err);
    }
};

exports.deleteIcon = async (req, res, next) => {
    try {
        const { partyId, type } = req.params;
        await deleteOperatorIcon({ partyId, type });
        res.status(204).send();
    } catch (err) {
        next(err);
    }
};

exports.bulkFetchIcons = async (req, res, next) => {
    try {
        const { partyIds } = req.body || {};
        if (!Array.isArray(partyIds)) {
            return res.status(400).json({ message: 'partyIds must be a non-empty array' });
        }
        if(!partyIds.length) return res.json([]);

        const items = await listIconsByPartyIds(partyIds);
        res.json(items);
    } catch (err) {
        next(err);
    }
};
