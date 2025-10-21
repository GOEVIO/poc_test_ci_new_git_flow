var Platforms = require('../../../models/platforms');
const axios = require('axios');

module.exports = {
    getPlatformDetails: function (endpoint, token) {

        return new Promise((resolve, reject) => {
            axios.get(endpoint, { headers: { 'Authorization': `Token ${token}` } }).then(function (response) {

                if (typeof response.data !== 'undefined') {
                    resolve(response.data);
                }
                else
                    resolve(false);

            }).catch(function (error) {
                reject(error);
            });
        });
    },
    getPlatformDetailsByPlatformCode: function (platformCode) {
        return new Promise((resolve, reject) => {

            var query = { platformCode: platformCode };
            Platforms.findOne(query, (err, platforms) => {
                if (err) {
                    console.error(`[find] Error `, err);
                    reject(err);
                }
                else {
                    resolve(platforms);
                }
                // else {
                //     axios.get(platforms.platformDetailsEndpoint)
                //         .then(function (response) {

                //             if (typeof response.data !== 'undefined') {
                //                 resolve(response.data);
                //             }
                //             else
                //                 resolve(false);

                //         }).catch(function (error) {
                //             reject(error);
                //         });
                // }
            });
        });
    }

}
