const express = require('express');
const router = express.Router();
require("dotenv-safe").load();
const axios = require("axios");

const PortugalDistricts = require('../models/portugalDistricts');

const PortugalPostalCodes = require('../models/portugalPostalCode');

let districts = [
    {
        code: 1,
        name: 'Aveiro',
        zone: 'Portugal'
    },
    {
        code: 2,
        name: 'Beja',
        zone: 'Portugal'
    },
    {
        code: 3,
        name: 'Braga',
        zone: 'Portugal'
    },
    {
        code: 4,
        name: 'Bragança',
        zone: 'Portugal'
    },
    {
        code: 5,
        name: 'Castelo Branco',
        zone: 'Portugal'
    },
    {
        code: 6,
        name: 'Coimbra',
        zone: 'Portugal'
    },
    {
        code: 7,
        name: 'Évora',
        zone: 'Portugal'
    },
    {
        code: 8,
        name: 'Faro',
        zone: 'Portugal'
    },
    {
        code: 9,
        name: 'Guarda',
        zone: 'Portugal'
    },
    {
        code: 10,
        name: 'Leiria',
        zone: 'Portugal'
    },
    {
        code: 11,
        name: 'Lisboa',
        zone: 'Portugal'
    },
    {
        code: 12,
        name: 'Portalegre',
        zone: 'Portugal'
    },
    {
        code: 13,
        name: 'Porto',
        zone: 'Portugal'
    },
    {
        code: 14,
        name: 'Santarém',
        zone: 'Portugal'
    },
    {
        code: 15,
        name: 'Setúbal',
        zone: 'Portugal'
    },
    {
        code: 16,
        name: 'Viana do Castelo',
        zone: 'Portugal'
    },
    {
        code: 17,
        name: 'Vila Real',
        zone: 'Portugal'
    },
    {
        code: 18,
        name: 'Viseu',
        zone: 'Portugal'
    },
    {
        code: 31,
        name: 'Ilha da Madeira',
        zone: 'Madeira'
    },
    {
        code: 32,
        name: 'Ilha de Porto Santo',
        zone: 'Madeira'
    },
    {
        code: 41,
        name: 'Ilha de Santa Maria',
        zone: 'Açores'
    },
    {
        code: 42,
        name: 'Ilha de São Miguel',
        zone: 'Açores'
    },
    {
        code: 43,
        name: 'Ilha Terceira',
        zone: 'Açores'
    },
    {
        code: 44,
        name: 'Ilha da Graciosa',
        zone: 'Açores'
    },
    {
        code: 45,
        name: 'Ilha de São Jorge',
        zone: 'Açores'
    },
    {
        code: 46,
        name: 'Ilha do Pico',
        zone: 'Açores'
    },
    {
        code: 47,
        name: 'Ilha do Faial',
        zone: 'Açores'
    },
    {
        code: 48,
        name: 'Ilha das Flores',
        zone: 'Açores'
    },
    {
        code: 49,
        name: 'Ilha do Corvo',
        zone: 'Açores'
    }
];

function createOrUpdateDistricts() {

    districts.forEach(district => {

        PortugalDistricts.updateDistrict({ code: district.code }, { $set: district }, (err, doc) => {
            if (doc != null) {
                console.log("Updated: " + district.code);
            }
            else {
                const new_district = new PortugalDistricts(district);
                PortugalDistricts.createDistrict(new_district, (err, result) => {
                    if (result) {
                        console.log("Created: " + district.code);
                    } else {
                        console.log("Not created");
                    }
                });
            }
        });

    });

}

let postalCodes = [
    {
        "districtCode": 31,
        "postalCodes": [
            9370,
            9385,
            9374,
            9300,
            9304,
            9030,
            9325,
            9000,
            9060,
            9020,
            9050,
            9004,
            9064,
            9054,
            9024,
            9200,
            9225,
            9360,
            9270,
            9350,
            9135,
            9125,
            9100,
            9230,
            9240
        ]
    },
    {
        "districtCode": 32,
        "postalCodes": [
            9400
        ]
    },
    {
        "districtCode": 41,
        "postalCodes": [
            9580
        ]
    },
    {
        "districtCode": 42,
        "postalCodes": [
            9560,
            9630,
            9545,
            9555,
            9500,
            9504,
            9650,
            9675,
            9600,
            9625,
            9680,
            9684
        ]
    },
    {
        "districtCode": 43,
        "postalCodes": [
            9700,
            9701,
            9760
        ]
    },
    {
        "districtCode": 44,
        "postalCodes": [
            9880
        ]
    },
    {
        "districtCode": 45,
        "postalCodes": [
            9850,
            9875,
            9800,
            9804
        ]
    },
    {
        "districtCode": 46,
        "postalCodes": [
            9930,
            9934,
            9950,
            9940,
            9944
        ]
    },
    {
        "districtCode": 47,
        "postalCodes": [
            9900,
            9901,
            9904
        ]
    },
    {
        "districtCode": 48,
        "postalCodes": [
            9960,
            9970
        ]
    },
    {
        "districtCode": 49,
        "postalCodes": [
            9980
        ]
    }
];

function createOrUpdatePostalCodes() {

    postalCodes.forEach(postalCode => {

        PortugalPostalCodes.updatePostalCode({ districtCode: postalCode.districtCode }, { $set: postalCode }, (err, doc) => {
            if (doc != null) {
                console.log("Updated: " + postalCode.districtCode);
            }
            else {
                const new_postalCode = new PortugalPostalCodes(postalCode);
                PortugalPostalCodes.createPostalCode(new_postalCode, (err, result) => {
                    if (result) {
                        console.log("Created: " + postalCode.districtCode);
                    } else {
                        console.log("Not created");
                    }
                });
            }
        });

    });

}

//createOrUpdateDistricts();
//createOrUpdatePostalCodes();

module.exports = router;