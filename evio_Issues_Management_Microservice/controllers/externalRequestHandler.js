const axios = require("axios");

module.exports = {

    getCharger: (params) => {
        const context = "Funciton getCharger";
        return new Promise(async (resolve, reject) => {
            try {

                let host = process.env.HostChargers + process.env.PathGetChargersIssue;
                let charger = await axios.get(host, { params });

                resolve(charger.data);

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            }
        });
    },
    getUser: (headers) => {
        const context = "Funciton getUser";
        return new Promise(async (resolve, reject) => {
            try {

                let host = process.env.HostUser + process.env.PathGetUser;
                let user = await axios.get(host, { headers });

                resolve(user.data);

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            }
        });
    },
    getQuestion: (data) => {
        const context = "Funciton getQuestion";
        return new Promise(async (resolve, reject) => {
            try {

                let host = process.env.HostQuestions + process.env.PathGetQuestionsIssue;
                let question = await axios.get(host, { data });

                resolve(question.data);

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            }
        });
    },
    getTranslation: (params) => {
        const context = "Funciton getTranslation";
        return new Promise(async (resolve, reject) => {
            try {

                let host = process.env.HostLanguage + process.env.PathGetLanguage;
                let translation = await axios.get(host, { params });

                resolve(translation.data[0]);

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            }
        });
    },
    getChargerPublic: (params) => {
        const context = "Funciton getChargerPublic";
        return new Promise(async (resolve, reject) => {
            try {
                let host = process.env.HostPublicNetworks + process.env.PathGetChargersPublicIssue;

                let charger = await axios.get(host, { params });

                resolve(charger.data);

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            }
        });
    }

}