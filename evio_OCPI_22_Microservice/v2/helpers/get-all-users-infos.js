const { getAllUserInfo, getOneUserAllInfo } = require('evio-library-identity').default;
const { Enums } = require('evio-library-commons').default;

const getAllUsersInfos = async (userId, userIdWillPay, userIdToBilling, reject) => {
    try {
        const userInfo = await getAllUserInfo({userId, userIdToBilling, userIdWillPay});
        return userInfo || {};
    } catch (error) {
        console.error(`Error fetching user by ID ${userId}:`, error.message);
        reject.setField('code', 'server_all_info_user_not_found')
            .setField('internalLog', JSON.stringify(error))
            .setField('message', error?.response ? JSON.stringify(error.response.data) : `Error during fetching user ${userId}: ${error.message}`)
            .setField('errorType', Enums.SessionFlowLogsErrorTypes.INTERNAL_ERROR)
        throw new Error();
    }
};

const getAllOneUserInfo = async (userId, reject) => {
    try {
        const userInfo = await getOneUserAllInfo(userId);
        return userInfo || {};
    } catch (error) {
        console.error(`Error fetching user by ID ${userId}:`, error.message);
        reject.setField('code', 'server_all_info_one_user_not_found')
            .setField('internalLog', JSON.stringify(error))
            .setField('message', error?.response ? JSON.stringify(error.response.data) : `Error during fetching user ${userId}: ${error.message}`)
            .setField('errorType', Enums.SessionFlowLogsErrorTypes.INTERNAL_ERROR)
        throw new Error();
    }
};

module.exports = { getAllUsersInfos, getAllOneUserInfo };
