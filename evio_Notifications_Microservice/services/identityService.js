const axios = require('axios');
const usersEnum = require('../utils/enums/users');
async function getUserByEmail(email, clientName) {
    const context = "Function getUserByEmail";
    const host = `${process.env.IdentityHost}${process.env.PathGetUserById}`;
    const params = { email: email, clientName: clientName, status: usersEnum.statusEnum.registered };
    try {
        const response = await axios.get(host, { params });
        console.info(`[${context}] user data:`, response.data);
        return response.data || null;
    } catch (error) {
        console.error(`[${context}] Error: ${error}`);
        return null;
    }
}

module.exports = { getUserByEmail };
