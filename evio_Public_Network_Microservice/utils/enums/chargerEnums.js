require("dotenv-safe").load();

const ChargerEnums = {
    operationalStatus: {
        approved: process.env.OperationalStatusApproved,
        removed: process.env.OperationalStatusRemoved,
    },
    subStatus:{
        approved: process.env.SubStatusApproved,
        removed: process.env.SubStatusRemoved,
    },
    network: {
        mobie: process.env.NetworkMobiE
    },
    chargerType: {
        tesla: process.env.ChargerTypeTesla,
        mobie: "004",
        gireve: "010",
        hubject: "015",
    },
    chargerStatus: {
        statusUnavailable:"50",
        status: process.env.ChargerStatus
    },
    stations:{
        tesla: "tesla",
        public: "public"
    }
};

module.exports = ChargerEnums;
