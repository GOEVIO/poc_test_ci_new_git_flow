const walletService = require('../services/walletService');
const { StatusCodes } = require('http-status-codes');
const toggle = require('evio-toggle').default;
const { captureException } = require("@sentry/node");
const Constants = require('../utils/constants');

const processClearenceWallet = async (req, res) => {
    const context = "function processClearenceWallet";
    console.info(`[${context}] - Initiating clearence process`);
    try {
        await handleClearenceWallet();
        console.info(`[${context}] - Process completed successfully.`);
        res.status(StatusCodes.OK).send({ message: "Process completed successfully." });
    } catch (error) {
        console.error(`[${context}] Error`, error);
        captureException(error.message);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            auth: false,
            code: 'server_error',
            message: "Internal server error"
        });
    }
}

const handleClearenceWallet = async () => {
    const context = "Function handleClearenceWallet";
    try {
        const walletsRequiringClearance = await walletService.getWalletsRequiringClearance();

        if (!walletsRequiringClearance.length) {
            console.info(`[${context}] - No wallets requiring clearance found.`);
            return;
        }

        const walletsUpdated = [];
        for (const wallet of walletsRequiringClearance) {
            await walletService.clearWalletBalances(wallet);
            const previousBalance = `${wallet.clearedAmount.value} ${wallet.clearedAmount.currency}`;
            const clearenceDate = wallet.clearanceDate;

            if (wallet.amount.value === 0) {
                walletsUpdated.push({
                    walletId: wallet._id.toString(),
                    userId: wallet.userId,
                    previousBalance,
                    clearenceDate
                });
            }

            await walletService.anonymizeUserData(wallet.userId);
        }

        if (walletsUpdated.length > 0) {
            await walletService.sendEmailWalletClearance('account_deletion_wallet_clearance_finance', {
                destinationEmail: Constants.emails.Finance, 
                walletsData: walletsUpdated
            });
        }

    } catch (error) {
        console.error(`[${context}] Error`, error);
        captureException(error.message);
        throw error;
    }
};

const enableBalanceClearance = async (req, res) => {
    const context = "Controller enableBalanceClearance";

    try {
        const userId = req.query['user'];

        if (!userId) {
            return res.status(StatusCodes.NOT_FOUND).json({
                auth: false,
                code: 'server_user_not_found',
                message: 'User not found'
            });
        }

        const response = await walletService.enableBalanceClearance(userId);

        return res.status(response.status).json(response.body);
    } catch (error) {
        console.error(`[${context}] Error:`, error);
        Sentry.captureException(error);
        saveRequestHistoryLogs(req, res, error.message);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: "An unexpected error occurred",
            error: error.message
        });
    }
};

module.exports = { processClearenceWallet, enableBalanceClearance };