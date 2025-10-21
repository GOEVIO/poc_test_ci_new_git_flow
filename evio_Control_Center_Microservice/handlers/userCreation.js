require("dotenv-safe").load();
const axiosS = require('../services/axios')

module.exports = {
    post: (req, res) => createUser(req, res),
    userB2B: (req, res) => createUserB2B(req, res)
};

async function createUser(req, res) {
    let context = "Function createUser";
    try {

        let isAdmin = req.headers['isadmin']
        let clientname = req.headers['clientname']
        let headers = req.headers
        let body = req.body

        if (isAdmin) {

            if (body.clientname) {
                clientname = body.clientname
            }
        }

        body.clientname = clientname

        //let host = process.env.HostUser + process.env.PathToCreateKintoUser
        let host = process.env.HostUser + process.env.PathToCreateUserB2C

        let response = await axiosS.axiosPostBodyHeaders(host, body, headers)

        return res.status(200).send(response)

    } catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send(error);
    }
}

async function createUserB2B(req, res) {
    let context = "Function createUserB2B";
    try {

        let isAdmin = req.headers['isadmin']
        let clientname = req.headers['clientname']
        let headers = req.headers
        let body = req.body

        if (isAdmin) {

            if (body.clientname) {
                clientname = body.clientname
            }
        }

        body.clientname = clientname

        //let host = process.env.HostUser + process.env.PathToCreateKintoUser
        let host = process.env.HostUser + process.env.PathToCreateUserB2B

        let response = await axiosS.axiosPostBodyHeaders(host, body, headers)

        return res.status(200).send(response)

    } catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send(error);
    }
}