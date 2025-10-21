const mongoose = require('mongoose');

require("dotenv-safe").load();


const { Schema } = mongoose;

const image = new Schema({
    url: { type: String },
    thumbnail: { type: String },
    category: { type: String },
    type: { type: String },
    width: { type: Number },
    height: { type: Number }
}, { _id: false });

const businessDetails = new Schema({
    name: { type: String },
    website: { type: String },
    logo: { type: image }
}, { _id: false });

const roles = new Schema({
    role: { type: String },
    party_id: { type: String },
    country_code: { type: String },
    business_details: { type: businessDetails }
}, { _id: false });

const credentialsModel = new Schema({
    token: {
        type: String
    },
    url: {
        type: String
    },
    roles: [roles],
   
},
    {
        timestamps: true
    }
);

var Credentials = module.exports = mongoose.model('mobie_credentials', credentialsModel);

