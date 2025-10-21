const axios = require('axios');

module.exports = {
    updateOperatorIdByHwId: async function (req, res) {
        const context = "Function updateOperatorIdByHwId"
        try {
            let host = process.env.HostChargers + process.env.PathUpdateOperatorByHwId
            // console.log(host)
            // console.log(req.body)
            let resp = await patchRequest(host,req.body)
            return res.status(200).send(resp);
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return res.status(500).send(error.message);
        }   
        
    },
    updateOperatorIdInfrastructure: async function (req, res) {
        const context = "Function updateOperatorIdInfrastructure"
        try {
            let host = process.env.HostChargers + process.env.PathUpdateOperatorByInfrastructure
            // console.log(host)
            // console.log(req.body)
            let resp = await patchRequest(host,req.body)
            return res.status(200).send(resp);
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return res.status(500).send(error.message);
        }   
        
    },
    addNetworks: async function (req, res) {
        const context = "Function addNetworks"
        try {
            let host = process.env.HostChargers + process.env.PathAddNetworksToChargers
            // console.log(host)
            // console.log(req.body)
            let resp = await patchRequest(host,req.body)
            return res.status(200).send(resp);
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return res.status(500).send(error.message);
        }   
        
    },
}


async function patchRequest(host,data) {
    const context = "Function patchRequest";
    try {
        let resp = await axios.patch(host, data)
        if (resp.data) {
            return resp.data
        } else {
            return null
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null;
    }
}
