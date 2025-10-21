require("dotenv-safe").load();
const axios = require("axios");
const moment = require('moment');
const { getCode } = require('country-list');
const Constants = require('../utils/constants')

module.exports = {
    createInvoiceDate: function (paymentFound) {
        const context = "Function createInvoiceDate";
        return new Promise(async (resolve, reject) => {
            try {

                let sessionsId;
                //console.log("paymentFound", paymentFound);
                if (paymentFound.listOfSessionsMonthly.length > 0) {
                    sessionsId = await getSessionsIds(paymentFound.listOfSessionsMonthly);
                } else {
                    sessionsId = paymentFound.sessionId;
                };

                //TODO
                let listOfSessions = await getSessions(sessionsId);
                //let listChargerType = [];

                console.log("listOfSessions.length", listOfSessions.length);

                let invoice = {

                    paymentId: paymentFound._id,
                    header: {
                        userId: paymentFound.userIdToBilling,
                        chargerType: "",
                        clientname: "",
                        source: "evio",
                        ceme: ""
                    },
                    lines: []

                };

                let footer = {
                    total_exc_vat: 0,
                    total_inc_vat: 0
                };

                let others = 0;
                let activationFee = 0;
                let attachLines = [];

                let totalTime = 0;
                let numberSessions = listOfSessions.length;
                let totalPower = 0;
                let lines = [];
                var vatPrice;
                let totalPrices = {
                    'evio': {
                        total_exc_vat: 0,
                        total_inc_vat: 0,
                    },
                    'other': {
                        total_exc_vat: 0,
                        total_inc_vat: 0,
                    },
                    'hyundai': {
                        total_exc_vat: 0,
                        total_inc_vat: 0,
                    },
                    'goCharge': {
                        total_exc_vat: 0,
                        total_inc_vat: 0,
                    },
                    'klc': {
                        total_exc_vat: 0,
                        total_inc_vat: 0,
                    },
                    'kinto': {
                        total_exc_vat: 0,
                        total_inc_vat: 0,
                    },
                }

                let optionalCountryCodeToVAT = null;

                if (listOfSessions.length === 0) {

                    resolve(false);

                } else {

                    Promise.all(listOfSessions.map(session => {

                        return new Promise(async (resolve, reject) => {

                            session = JSON.parse(JSON.stringify(session));

                            //console.log("session", session);

                            invoice.header.chargerType = session.chargerType;
                            invoice.header.clientname = session.clientName;
                            //invoice.header.ceme = session.clientName;
                            if (session.clientName === process.env.clientNameSC || session.clientName === process.env.clientNameHyundai || session.clientName === process.env.clientNameKLC || session.clientName === process.env.WhiteLabelKinto) {
                                switch (session.chargerType) {
                                    case '011':
                                        invoice.header.ceme = process.env.clientNameSC;
                                        break;
                                    case '012':
                                        invoice.header.ceme = process.env.clientNameHyundai;
                                        break;
                                    case process.env.chargerTypeKLC:
                                        invoice.header.ceme = process.env.clientNameKLC;
                                        break;
                                    case process.env.chargerTypeKinto:
                                        invoice.header.ceme = process.env.WhiteLabelKinto;
                                        break;
                                    default:
                                        invoice.header.ceme = process.env.clientNameEVIO;
                                        break;
                                };
                            } else {
                                invoice.header.ceme = process.env.clientNameEVIO
                            };

                            let { invoiceCode, invoiceDescription } = getBillingCodesAndTotalPrices(session, totalPrices)
                            let invoiceLine = await getInvoiceLines(session, invoiceCode, invoiceDescription);

                            lines.push(invoiceLine);

                            totalTime += session.timeCharged;
                            totalPower += session.totalPower;
                            footer.total_exc_vat += session.totalPrice.excl_vat;
                            footer.total_inc_vat += session.totalPrice.incl_vat;
                            // chargingSessionsEVIO += session.totalPrice.excl_vat

                            let evioTimeCost = 0;
                            let evioEnergyCost = 0;


                            let use_energy = 0;
                            let use_time = 0;

                            if (session.tariffId != '-1') {
                                if (session?.tariff?.tariffType === process.env.TariffByPower) {
                                    evioEnergyCost = session?.tariff?.tariff?.chargingAmount?.value ?? 0;
                                    use_energy = session.costDetails.costDuringCharge;
                                } else {
                                    evioTimeCost = session?.tariff?.tariff?.chargingAmount?.value ?? 0;
                                    use_time = session.costDetails.costDuringCharge;
                                }
                            }

                            activationFee += session.costDetails.activationFee;

                            //console.log("session", session);
                            vatPrice = session.fees.IVA;

                            try {
                                optionalCountryCodeToVAT = session.fees?.countryCode ??  getCode(session.address?.country);
                            } catch (error) {
                                console.log(`[${context}] Error when fetching country code for session.address.country`, error.message, session.address.country);
                            }

                            let timeDuringParking;
                            if (session.costDetails.timeDuringParking == undefined) {
                                timeDuringParking = 0;
                            } else {
                                timeDuringParking = session.costDetails.timeDuringParking;
                            }

                            if(session.localStartDate) {
                                session.startDate = session.localStartDate
                            }
                            
                            var attachLine = {
                                "date": moment(session.startDate).format("DD/MM/YYYY"),
                                "startTime": moment(session.startDate).format("HH:mm"),//.getTime().format("HH:mm"),
                                "duration": new Date(session.costDetails.totalTime * 1000).toISOString().substr(11, 5),
                                "city": session.address.city,
                                "network": getNetwork(session),
                                "hwId": session.hwId,
                                "totalPower": parseFloat(session.costDetails.totalPower / 1000).toFixed(2),
                                "charging_duration": new Date(session.costDetails.timeCharged * 1000).toISOString().substr(11, 5),
                                //Added time charged after charging
                                "after_charging_duration": new Date(timeDuringParking * 1000).toISOString().substr(11, 5),
                                "use_energy": use_energy,
                                "use_time": use_time,
                                "opcFlatCost": session.costDetails.activationFee,
                                //"charging_parking": session.costDetails.parkingDuringCharging,
                                //Added charging tariff
                                "charging_parking": session?.tariff?.tariff?.chargingAmount?.value ?? 0,
                                //"charging_after_parking": session.costDetails.parkingAmount,
                                //Added parking tariff
                                "charging_after_parking": session?.tariff?.tariff?.parkingAmount?.value ?? 0,
                                "total_exc_vat": session.totalPrice.excl_vat,
                                //"vat": parseFloat(session.fees.IVA * 100).toFixed(2),
                                "vat": parseFloat(session.fees.IVA * 100),
                                "total_inc_vat": session.totalPrice.incl_vat,
                                "partyId": session?.party_id
                            }

                            attachLines.push(attachLine);

                            resolve(true);

                        });

                    })).then(() => {
                        invoice.lines = lines;
                        // others += activationFee;

                        // let vatPriceServicesEVIO = 0;
                        // if (others > 0) {
                        //     vatPriceServicesEVIO = parseFloat((others * vatPrice).toFixed(2))
                        // }
                        let evioTotalVat = totalPrices.evio.total_inc_vat - totalPrices.evio.total_exc_vat
                        let otherTotalVat = totalPrices.other.total_inc_vat - totalPrices.other.total_exc_vat
                        let hyundaiTotalVat = totalPrices.hyundai.total_inc_vat - totalPrices.hyundai.total_exc_vat
                        let goChargeTotalVat = totalPrices.goCharge.total_inc_vat - totalPrices.goCharge.total_exc_vat
                        let klcTotalVat = totalPrices.klc.total_inc_vat - totalPrices.klc.total_exc_vat
                        let kintoTotalVat = totalPrices.kinto.total_inc_vat - totalPrices.kinto.total_exc_vat

                        var body = {
                            optionalCountryCodeToVAT,
                            invoice: invoice,
                            attach: {
                                overview: {
                                    footer: footer,
                                    lines: {
                                        evio_services: {
                                            total_exc_vat: 0,
                                            vat: 0
                                        },
                                        evio_network: {
                                            total_exc_vat: Number(totalPrices.evio.total_exc_vat.toFixed(2)),
                                            vat: Number(evioTotalVat.toFixed(2))
                                        },
                                        mobie_network: { total_exc_vat: 0, vat: 0 },
                                        other_networks: {
                                            total_exc_vat: Number(totalPrices.other.total_exc_vat.toFixed(2)),
                                            vat: Number(otherTotalVat.toFixed(2))
                                        },
                                        hyundai_network: {
                                            total_exc_vat: Number(totalPrices.hyundai.total_exc_vat.toFixed(2)),
                                            vat: Number(hyundaiTotalVat.toFixed(2))
                                        },
                                        goCharge_network: {
                                            total_exc_vat: Number(totalPrices.goCharge.total_exc_vat.toFixed(2)),
                                            vat: Number(goChargeTotalVat.toFixed(2))
                                        },
                                        klc_network: {
                                            total_exc_vat: Number(totalPrices.klc.total_exc_vat.toFixed(2)),
                                            vat: Number(klcTotalVat.toFixed(2))
                                        },
                                        kinto_network: {
                                            total_exc_vat: Number(totalPrices.kinto.total_exc_vat.toFixed(2)),
                                            vat: Number(kintoTotalVat.toFixed(2))
                                        },
                                    }
                                },
                                chargingSessions: {
                                    header: {
                                        sessions: numberSessions,
                                        totalTime: new Date(totalTime * 1000).toISOString().substr(11, 8),
                                        totalEnergy: parseFloat(totalPower / 1000).toFixed(2) + " KWh"
                                    },
                                    lines: attachLines,
                                    footer: footer
                                }
                            }

                        };
                        resolve(body);
                    })

                };

            }
            catch (error) {
                console.error(`[${context}] Error `, error.message);
                reject(error)
            }

        });
    },
    createInvoiceDatePhysicalCard: function (paymentFound) {
        const context = "Function createInvoiceDate";
        return new Promise(async (resolve, reject) => {
            try {

                //TODo billing services EVIO
            }
            catch (error) {
                console.error(`[${context}] Error `, error.message);
                reject(error)
            }

        });
    },
};

//========== FUNCTION ==========
function getInvoiceLines(session, code, description) {
    var context = "Function getLines";
    return new Promise((resolve, reject) => {
        let quantity = 1;
        // let unitPrice = parseFloat(session.totalPrice.excl_vat.toFixed(2));
        let unitPrice = session.totalPrice.incl_vat / (1 + session.fees.IVA);
        let uom = "UN";//'min'
        /*if (session.tariffId !== "-1") {
            switch (session.tariff.tariff.chargingAmount.uom.toUpperCase()) {
                case 'S':
                    quantity = session.timeCharged;
                    break;
                case 'MIN':
                    quantity = session.timeCharged / 60;
                    break;
                case 'H':
                    quantity = session.timeCharged / 3600;
                    break;
                case 'KWH':
                    quantity = session.totalPower / 1000;
                    break;
                default:
                    quantity = session.timeCharged / 60;
                    break;
            };
            unitPrice = session.tariff.tariff.chargingAmount.value;
            uom = session.tariff.tariff.chargingAmount.uom

        } else {
            quantity = session.timeCharged / 60;
        }

        quantity = parseFloat(quantity.toFixed(2));*/


        let line = {
            code,
            description,
            unitPrice: unitPrice,
            uom: uom,
            quantity: quantity,
            vat: session.fees.IVA,
            discount: 0,
            total: 0
        };
        if (session?.fees?.IVA == 0) {
            line.taxExemptionReasonCode = Constants.TAX_EXEMPTION_REASON_CODE_M40;
        }
        //console.log("line", line);
        resolve(line);

    });
};

function getSessions(sessionsId) {
    var context = "Function getSessions";
    return new Promise(async (resolve, reject) => {
        try {

            let host = process.env.HostCharger + process.env.PathGetSessionsBilling + "/" + sessionsId;

            axios.get(host)
                .then(response => {
                    resolve(response.data);
                })
                .catch(error => {
                    console.error(`[${context}] Error `, error.message);
                    resolve([]);
                })
        }
        catch (error) {
            console.error(`[${context}] Error `, error.message);
            resolve([]);
        }

    });
};

function getSessionsIds(listOfSessionsMonthly) {
    var context = "Function getSessionsIds";
    return new Promise(async (resolve, reject) => {
        let sessionsId = [];

        Promise.all(
            listOfSessionsMonthly.map(session => {
                return new Promise(resolve => {
                    if (!process.env.PublicNetworkChargerType.includes(session.chargerType)) {
                        sessionsId.push(session.sessionId);
                        resolve(true);
                    } else {
                        resolve(false);
                    };
                });
            })
        ).then(() => {

            resolve(sessionsId);

        });

    });
};

function getBillingCodesAndTotalPrices(session, totalPrices) {
    var context = "Function getBillingCodesAndTotalPrices";

    try {
        if (session.clientName === process.env.clientNameEVIO) {
            if (process.env.WhiteLabelChargerType.includes(session.chargerType)) {
                // totalPrices.chargingSessionsOtherNetworks += session.totalPrice.excl_vat
                totalPrices.other.total_inc_vat += session.totalPrice.incl_vat
                totalPrices.other.total_exc_vat += (session.totalPrice.incl_vat / (1 + session.fees.IVA))
                return {
                    invoiceCode: process.env.OtherNetworksInvoiceCode,
                    invoiceDescription: process.env.OtherNetworksInvoiceDescription
                }
            } else {
                // totalPrices.chargingSessionsEVIO += session.totalPrice.excl_vat
                totalPrices.evio.total_inc_vat += session.totalPrice.incl_vat
                totalPrices.evio.total_exc_vat += (session.totalPrice.incl_vat / (1 + session.fees.IVA))
                return {
                    invoiceCode: process.env.EVIOInvoiceCode,
                    invoiceDescription: process.env.EVIOInvoiceDescription
                }
            }
        } else if (session.clientName === process.env.clientNameHyundai) {
            if (process.env.WhiteLabelChargerType.includes(session.chargerType)) {
                if (session.chargerType === process.env.chargerTypeHyundai) {
                    // totalPrices.chargingSessionsHyundai += session.totalPrice.excl_vat
                    totalPrices.hyundai.total_inc_vat += session.totalPrice.incl_vat
                    totalPrices.hyundai.total_exc_vat += (session.totalPrice.incl_vat / (1 + session.fees.IVA))
                    return {
                        invoiceCode: process.env.HyundaiInvoiceCode,
                        invoiceDescription: process.env.HyundaiInvoiceDescription
                    }
                } else {
                    // totalPrices.chargingSessionsOtherNetworks += session.totalPrice.excl_vat
                    totalPrices.other.total_inc_vat += session.totalPrice.incl_vat
                    totalPrices.other.total_exc_vat += (session.totalPrice.incl_vat / (1 + session.fees.IVA))
                    return {
                        invoiceCode: process.env.OtherNetworksInvoiceCode,
                        invoiceDescription: process.env.OtherNetworksInvoiceDescription
                    }
                }
            } else {
                // totalPrices.chargingSessionsEVIO += session.totalPrice.excl_vat
                totalPrices.evio.total_inc_vat += session.totalPrice.incl_vat
                totalPrices.evio.total_exc_vat += (session.totalPrice.incl_vat / (1 + session.fees.IVA))
                return {
                    invoiceCode: process.env.EVIOInvoiceCode,
                    invoiceDescription: process.env.EVIOInvoiceDescription
                }
            }
        } else if (session.clientName === process.env.clientNameSC) {
            if (process.env.WhiteLabelChargerType.includes(session.chargerType)) {
                if (session.chargerType === process.env.chargerTypeGoCharge) {
                    // totalPrices.chargingSessionsGoCharge += session.totalPrice.excl_vat
                    totalPrices.goCharge.total_inc_vat += session.totalPrice.incl_vat
                    totalPrices.goCharge.total_exc_vat += (session.totalPrice.incl_vat / (1 + session.fees.IVA))
                    return {
                        invoiceCode: process.env.GoChargeInvoiceCode,
                        invoiceDescription: process.env.GoChargeInvoiceDescription
                    }
                } else {
                    // totalPrices.chargingSessionsOtherNetworks += session.totalPrice.excl_vat
                    totalPrices.other.total_inc_vat += session.totalPrice.incl_vat
                    totalPrices.other.total_exc_vat += (session.totalPrice.incl_vat / (1 + session.fees.IVA))
                    return {
                        invoiceCode: process.env.OtherNetworksInvoiceCode,
                        invoiceDescription: process.env.OtherNetworksInvoiceDescription
                    }
                }
            } else {
                // totalPrices.chargingSessionsEVIO += session.totalPrice.excl_vat
                totalPrices.evio.total_inc_vat += session.totalPrice.incl_vat
                totalPrices.evio.total_exc_vat += (session.totalPrice.incl_vat / (1 + session.fees.IVA))
                return {
                    invoiceCode: process.env.EVIOInvoiceCode,
                    invoiceDescription: process.env.EVIOInvoiceDescription
                }
            }
        } else if (session.clientName === process.env.clientNameKLC) {
            if (process.env.WhiteLabelChargerType.includes(session.chargerType)) {
                if (session.chargerType === process.env.chargerTypeKLC) {
                    // totalPrices.chargingSessionsGoCharge += session.totalPrice.excl_vat
                    totalPrices.klc.total_inc_vat += session.totalPrice.incl_vat
                    totalPrices.klc.total_exc_vat += (session.totalPrice.incl_vat / (1 + session.fees.IVA))
                    return {
                        invoiceCode: process.env.KLCInvoiceCode,
                        invoiceDescription: process.env.KLCInvoiceDescription
                    }
                } else {
                    // totalPrices.chargingSessionsOtherNetworks += session.totalPrice.excl_vat
                    totalPrices.other.total_inc_vat += session.totalPrice.incl_vat
                    totalPrices.other.total_exc_vat += (session.totalPrice.incl_vat / (1 + session.fees.IVA))
                    return {
                        invoiceCode: process.env.OtherNetworksInvoiceCode,
                        invoiceDescription: process.env.OtherNetworksInvoiceDescription
                    }
                }
            } else {
                // totalPrices.chargingSessionsEVIO += session.totalPrice.excl_vat
                totalPrices.evio.total_inc_vat += session.totalPrice.incl_vat
                totalPrices.evio.total_exc_vat += (session.totalPrice.incl_vat / (1 + session.fees.IVA))
                return {
                    invoiceCode: process.env.EVIOInvoiceCode,
                    invoiceDescription: process.env.EVIOInvoiceDescription
                }
            }
        } else if (session.clientName === process.env.WhiteLabelKinto) {
            if (process.env.WhiteLabelChargerType.includes(session.chargerType)) {
                if (session.chargerType === process.env.chargerTypeKinto) {
                    totalPrices.kinto.total_inc_vat += session.totalPrice.incl_vat
                    totalPrices.kinto.total_exc_vat += (session.totalPrice.incl_vat / (1 + session.fees.IVA))
                    return {
                        invoiceCode: process.env.KintoInvoiceCode,
                        invoiceDescription: process.env.KintoInvoiceDescription
                    }
                } else {
                    totalPrices.other.total_inc_vat += session.totalPrice.incl_vat
                    totalPrices.other.total_exc_vat += (session.totalPrice.incl_vat / (1 + session.fees.IVA))
                    return {
                        invoiceCode: process.env.OtherNetworksInvoiceCode,
                        invoiceDescription: process.env.OtherNetworksInvoiceDescription
                    }
                }
            } else {
                totalPrices.evio.total_inc_vat += session.totalPrice.incl_vat
                totalPrices.evio.total_exc_vat += (session.totalPrice.incl_vat / (1 + session.fees.IVA))
                return {
                    invoiceCode: process.env.EVIOInvoiceCode,
                    invoiceDescription: process.env.EVIOInvoiceDescription
                }
            }
        } else {
            // totalPrices.chargingSessionsEVIO += session.totalPrice.excl_vat
            totalPrices.evio.total_inc_vat += session.totalPrice.incl_vat
            totalPrices.evio.total_exc_vat += (session.totalPrice.incl_vat / (1 + session.fees.IVA))
            return {
                invoiceCode: process.env.EVIOInvoiceCode,
                invoiceDescription: process.env.EVIOInvoiceDescription
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        // totalPrices.chargingSessionsEVIO += session.totalPrice.excl_vat
        totalPrices.evio.total_inc_vat += session.totalPrice.incl_vat
        totalPrices.evio.total_exc_vat += (session.totalPrice.incl_vat / (1 + session.fees.IVA))
        return {
            invoiceCode: process.env.EVIOInvoiceCode,
            invoiceDescription: process.env.EVIOInvoiceDescription
        }
    }
}

function getNetwork(session) {
    try {
        if (session.chargerType === process.env.chargerTypeGoCharge) {
            return "Go.Charge"
        } else if (session.chargerType === process.env.chargerTypeHyundai) {
            return "Hyundai"
        } else if (session.chargerType === process.env.chargerTypeKLC) {
            return process.env.NetworkKLC
        } else if (session.chargerType === process.env.chargerTypeKinto) {
            return process.env.NetworkKinto
        } else {
            return "EVIO"
        }
    } catch (error) {
        return "EVIO"
    }
}
