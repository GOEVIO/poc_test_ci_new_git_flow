const express = require('express');
const router = express.Router();
const controller = require('../controllers/operator-icons');

require("dotenv-safe").load();

const Operator = require('../models/operator');

router.get('/api/public/operators', (req, res, next) => {
    var context = "GET /api/public/operators";
    try {
        var query = req.query;

        Operator.findOne(query, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                return res.status(200).send(result);
            };
        });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };

});

// Create/Update icon same for post and patch
router.post('/api/private/operators/:partyId/icons', controller.createOrUpdateIcon);
router.patch('/api/private/operators/icons/bulk', controller.createOrUpdateIcon);

// Delete icon
router.delete('/api/private/operators/:partyId/icons/:type', controller.deleteIcon);

// Bulk fetch icons by partyIds
router.post('/api/private/operators/icons/bulk', controller.bulkFetchIcons);

module.exports = router;
