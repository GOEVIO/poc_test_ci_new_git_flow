const axios = require('axios');
const Session = require('../models/sessions');

const getSessionByUserId = async (userId) => {
    const context = `Function getSessionByUserId`;
    try {
        const query = { userId: userId };
        const projection = {
            cdrId: 1,
            _id: 1,
            paymentStatus: 1,
            status: 1,
            end_date_time: 1,
            userId: 1
        };
        const sessionData = await Session.find(query, projection).lean();

        return sessionData ? sessionData : [];
    } catch (error) {
        console.error(`[${context}] Error`, error);
        throw error;
    }
};

const getSessionByTransactionId = async (transactionId) => {
    const context = `Function getSessionByTransactionId`;
    try {
        const query = { transactionId: transactionId };
        const sessionData = await Session.find(query).lean();
        return sessionData ? sessionData : [];
    } catch (error) {
        console.error(`[${context}] Error`, error);
        throw error;
    }
};

const getSessionById = async (id) => {
    const context = `Function getSessionById`;
    try {
        const query = { id: id };
        const sessionData = await Session.find(query).lean();
        return sessionData ? sessionData : [];
    } catch (error) {
        console.error(`[${context}] Error`, error);
        throw error;
    }
};

module.exports = {
    getSessionByUserId,
    getSessionByTransactionId,
    getSessionById
};