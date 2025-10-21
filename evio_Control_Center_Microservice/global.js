const mongo_connection = String(process.env.DB_URI).replace('{database}', 'controlCenterDB');

const ldap_connection = `${process.env.LDAP_HOST}`

const mobiePlatformCode = "MobiE";
const girevePlatformCode = "Gireve";


const configsHost = 'http://configs:3028';
const feesConfigEndpoint = `${configsHost}/api/private/config/fees`;


module.exports = {
    mongo_connection: mongo_connection,
    ldap_connection:ldap_connection,
    feesConfigEndpoint:feesConfigEndpoint
}