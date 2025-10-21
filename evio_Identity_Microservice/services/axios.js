const axios = require("axios");
const FormData = require('form-data');
const { logger } = require('../utils/constants');

module.exports = {
    axiosGet: (host, params) => {
        let context = "Function axiosGet";
        return new Promise((resolve, reject) => {
            axios.get(host, { params })
                .then((result) => {
                    resolve(result.data);
                })
                .catch((error) => {
                    console.log("error")
                    console.log(error)
                    console.log(`[${context}][${host}] Error`, error.message);
                    reject(error);
                });
        });
    },
    axiosPatch: function (host, params) {
        let context = "Function axiosPatch";
        return new Promise((resolve, reject) => {
            axios.patch(host, { params })
                .then((result) => {
                    resolve(result.data);
                })
                .catch((error) => {
                    console.log(`[${context}][${host}] Error`, error.message);
                    reject();
                });
        });
    },
    axiosPut: function (host, body) {
        let context = "Function axiosPut";
        return new Promise((resolve, reject) => {
            axios.put(host, body)
                .then((result) => {
                    resolve(result.data);
                })
                .catch((error) => {
                    console.log(`[${context}][${host}] Error`, error.message);
                    reject();
                });
        });
    },
    axiosPutBodyAndHeader: function (host, body, headers) {
        let context = "Function axiosPut";
        return new Promise((resolve, reject) => {
            axios.put(host, body, { headers })
                .then((result) => {
                    resolve(result.data);
                })
                .catch((error) => {
                    console.log(`[${context}][${host}] Error`, error.message);
                    reject();
                });
        });
    },
    axiosPostBody: function (host, body) {
        let context = "Function axiosPostBody";
        return new Promise((resolve, reject) => {
            axios.post(host, body)
                .then((result) => {
                    resolve(result.data);
                })
                .catch((error) => {
                    console.log(`[${context}][${host}] Error`, error.message);
                    reject(error);
                });
        });
    },
    axiosPostBandH: function (host, body, params) {
        let context = "Function axiosPostBandH";
        return new Promise((resolve, reject) => {
            axios.post(host, body, { params })
                .then((result) => {
                    resolve(result.data);
                })
                .catch((error) => {
                    console.log(`[${context}][${host}] Error`, error.message);
                    reject();
                });
        });
    },
    axiosGetHeaders: (host, headers) => {
        let context = "Function axiosGetHeaders";
        return new Promise((resolve, reject) => {
            axios.get(host, { headers })
                .then((result) => {
                    resolve(result.data);
                })
                .catch((error) => {
                    console.log(`[${context}][${host}] Error`, error.message);
                    reject(error);
                });
        });
    },
    axiosPatchBody: (host, body) => {
        let context = "Function axiosPatchBody";
        return new Promise((resolve, reject) => {
            axios.patch(host, body , {'maxContentLength': Infinity,'maxBodyLength': Infinity})
                .then((result) => {
                    resolve(result.data);
                })
                .catch((error) => {
                    console.log(`[${context}][${host}] Error`, error.message);
                    reject(error);
                });
        });
    },
    axiosPostBodyHeadersEmail: (host, mailOptions, headers) => {
        let context = "Function axiosPostBodyHeadersEmail";
        return new Promise((resolve, reject) => {
            axios.post(host, { mailOptions }, { headers })
                .then((result) => {
                    resolve(result.data);
                })
                .catch((error) => {
                    console.log(`[${context}][${host}] Error`, error.message);
                    reject(error);
                });
        });
    },
    getFromDataFormat: (keys, values) => {
        let context = "Function getFromDataFormat";
        try {
            if (keys.length != values.length)
                return null

            let form = new FormData();

            for (let i = 0; i != keys.length; i++)
                form.append(keys[i], values[i]);

            return form;
        }
        catch (error) {
            console.log(`[${context}] Error`, error.message);
            return null;
        }
    }
};