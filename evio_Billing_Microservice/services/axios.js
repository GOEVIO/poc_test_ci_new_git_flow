const axios = require("axios");

module.exports = {
    axiosGet: function (host, params) {
        let context = "Function axiosGet";
        return new Promise((resolve, reject) => {
            axios.get(host, { params })
                .then((result) => {
                    resolve(result.data);
                })
                .catch((error) => {
                    console.error(`[${context}][${host}] Error`, error.message);
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
                    console.error(`[${context}][${host}] Error`, error.message);
                    reject(error);
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
                    console.error(`[${context}][${host}] Error`, error.message);
                    reject(error);
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
                    console.error(`[${context}][${host}] Error`, error.message);
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
                    console.error(`[${context}][${host}] Error`, error.message);
                    reject(error);
                });
        });
    },
    axiosPatchBody: function (host, data) {
        let context = "Function axiosPatchBody";
        return new Promise((resolve, reject) => {
            axios.patch(host, data)
                .then((result) => {
                    resolve(result.data);
                })
                .catch((error) => {
                    console.error(`[${context}][${host}] Error`, error.message);
                    reject(error);
                });
        });
    },
};