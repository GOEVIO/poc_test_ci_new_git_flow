const express = require('express');
const router = express.Router();
const User = require('../models/user');
require("dotenv-safe").load();
const { logger } = require('../utils/constants');

//========== PATCH ==========
//edit an user
router.patch('/api/private/controlCenter/users/operatorId', async (req, res, next) => {
    var context = "PATCH /api/private/controlCenter/users/operatorId";
    try {
        var { userId , operatorId } = req.body

        var query = {
            _id: { $in : userId }
        };

        let usersUpdated = await User.updateMany(query , {$set : {operatorId}})
        return res.status(200).send(usersUpdated);

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});


module.exports = router;
