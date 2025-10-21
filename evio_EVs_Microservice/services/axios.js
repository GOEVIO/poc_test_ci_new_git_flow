const axios = require("axios");

module.exports = {
    axiosGet: (host, params) => {
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
                    console.error(`[${context}][${host}] Error`, error.message);
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
                    console.error(`[${context}][${host}] Error`, error.message);
                    reject();
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
                    console.error(`[${context}][${host}] Error`, error.message);
                    reject(error);
                });
        });
    },
    axiosGetBody: (host, data) => {
        let context = "Function axiosGetBody";
        return new Promise((resolve, reject) => {
            axios.get(host, { data } , {'maxContentLength': Infinity,'maxBodyLength': Infinity})
                .then((result) => {
                    resolve(result.data);
                })
                .catch((error) => {
                    console.error(`[${context}][${host}] Error`, error.message);
                    reject(error);
                });
        });
    }
};