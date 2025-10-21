const AxiosHandler = require('../services/axios');
const Constants = require('../utils/constants');

const sendNotificationEmail = async (mailOptions, clientName) => {
    try {
        const url = `${Constants.services.notifications.host}/api/private/sendEmail`;
        const headers = { clientname: clientName };
        await AxiosHandler.axiosPostBandH(url, mailOptions, headers);
    } catch (error) {
        console.error('Error sending email: ', error);
        throw error;
    }
};

module.exports = sendNotificationEmail;