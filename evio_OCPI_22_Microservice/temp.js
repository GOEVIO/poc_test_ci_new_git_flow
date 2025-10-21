var date = new Date("2022-04-20T18:06:28.000Z")

if (date.getFullYear() == 2022) {
    console.log("2022")
}
else {
    console.log("2021")
}
const axios = require('axios');
const moment = require('moment')

async function updateCdr(allSessions) {
    const context = "Function updateCdr"
    try {
        for (let session of allSessions) {
            console.log(session.id)
            const headers = {
            }
            let host = `https://ocpi.go-evio.com/api/private/billing/processOnlyCDR/${session.id}`
            await axios.post(host , {} , {headers})
            .catch(error => {
                console.log(`Error on session ${session.id}`)
            })
            await sleep(200)
        }
    } catch (error) {
        console.log(`[${context}] Error ` , error.message)
    }
}

// updateCdr(allSessions)

function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
}
let invoice =  {}
// let attachLines = invoice.attach.chargingSessions.lines 
// let sessions = attachLines.map(obj => Object.values(obj)[0]).flat(1).map(session => { return {startDateTime :  session.startDateTime } }).sort((a, b) => moment(a.startDateTime) - moment(b.startDateTime) ) 
// console.log(sessions)
