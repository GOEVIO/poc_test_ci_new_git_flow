const { findEVById } = require('evio-library-evs/dist').default;


module.exports = {
    getEVById: async (evId) => {
        const context = '[getEVById]';
        console.log(`${context} Getting EV by id ${evId}`);

        return await findEVById(evId);
    },
};
