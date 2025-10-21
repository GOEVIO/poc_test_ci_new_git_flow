const Charger = require('../models/charger');

exports.getPlugStatusesByHwId = async (req, res) => {
    const context = 'GET /api/private/chargers/:hwId/plugs/status';
    const { hwId } = req.params;

    try {
        const charger = await Charger.findOne(
            {
                hwId,
                hasInfrastructure: true,
                operationalStatus: { $ne: process.env.OperationalStatusRemoved }
            },
            { plugs: 1 }
        );

        if (!charger) {
            return res.status(404).send({
                code: 'charger_not_found',
                message: `Charger with hwId ${hwId} not found`,
            });
        }

        const plugStatuses = charger.plugs?.map(plug => ({
            plugId: plug.plugId,
            status: plug.status,
        })) || [];

        return res.status(200).send({ hwId, plugStatuses });

    } catch (error) {
        console.error(`[${context}] Error`, error?.message || error);
        return res.status(500).send({ message: error?.message || 'Internal server error' });
    }
};
