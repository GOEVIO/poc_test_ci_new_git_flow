const mongo_connection = String(process.env.DB_URI).replace('{database}', 'ocpiDB')
//const mongo_connection = 'mongodb://localhost:27017/ocpiDB'

const publicNetworkHost = 'http://public-network:3029';
//const publicNetworkHost = 'http://localhost:3029';

const paymentHost = 'http://payments:3017'
//const paymentHost = 'http://localhost:3017'

//var configsHost = 'http://localhost:3028';
var configsHost = 'http://configs:3028';

//var billingHost = 'http://localhost:3030';
var billingHost = 'http://billing:3030';

const evsHost = 'http://evs:3006'

const ocpiHost = 'http://ocpi-22:3019'

const feesConfigEndpoint = `${configsHost}/api/private/config/fees`;
const paymentCheckConditionsEndpoint = `${paymentHost}/api/private/payments/validatePaymentConditions`;
const checkEvDriverEndpoint = `${evsHost}/api/private/evs/evUser`;
const paymentEndpoint = `${paymentHost}/api/private/payments`;
const billingEndpoint = `${billingHost}/api/private/createMobiEBillingDocument`;
const billingRoamingEndpoint = `${billingHost}/api/private/createGireveBillingDocument`;
const billingEndpointWL = `${billingHost}/api/private/billing/createBillingDocumentWL`;
const publicNetworkChargersProxy = `${publicNetworkHost}/api/private/chargers`;
const publicNetworkChargersDetailsProxy = `${publicNetworkHost}/api/private/publicNetwork/details`;
const publicNetworkUpdateChargerRatingProxy = `${publicNetworkHost}/api/private/updateChargerRating`;
const publicNetworkUpdateChargersProxy = `${publicNetworkHost}/api/private/updateMobieChargers`;
const publicNetworkUpdateOrCreateChargersProxy = `${publicNetworkHost}/api/private/updateOrCreateCharger`;
const publicNetworkUpdatePlugStatusProxy = `${publicNetworkHost}/api/private/updatePlugStatus`;
const publicNetworkUpdatePlugPower = `${publicNetworkHost}/api/private/publicNetwork/plugPower`;
const publicNetworkUpdateChargersProxyBulk = `${publicNetworkHost}/api/private/updateMobieChargersBulk`;
const publicNetworkUpdateChargerProxy = `${publicNetworkHost}/api/private/updateMobieCharger`;
const publicNetworkLocationsLastUpdatedProxy = `${publicNetworkHost}/api/private/getLastDateUpdated`;
const publicNetworkLocationsWrongBehaviorProxy = `${publicNetworkHost}/api/private/publicNetwork/wrongBehaviorStation`;
const publicNetworkHubjectChargerByPlugID = `${publicNetworkHost}/api/private/chargerByPlugID`
const evsDeletekmsFromEV = `${evsHost}/api/private/evs/kms`

const mobiePlatformCode = "MobiE";
const girevePlatformCode = "Gireve";
const hubjectPlatformCode = "Hubject";

//Invoice Items
const Item_Energy_OutEmpty_BT = "ISERV21001"; //Energia consumida Fora do Vazio BT (KWH)
const Item_Energy_Empty_BT = "ISERV21002"; //Energia consumida Vazio BT (KWH)
const Item_Energy_OutEmpty_MT = "ISERV21003"; //Energia consumida Fora do Vazio MT (KWH)
const Item_Energy_Empty_MT = "ISERV21004"; //Energia consumida Vazio MT (KWH)
const Item_TAR_OutEmpty_BT = "ISERV21005";//Tarifas Acesso às Redes Fora do Vazio BT
const Item_TAR_Empty_BT = "ISERV21006";//Tarifas Acesso às Redes Vazio BT
const Item_TAR_OutEmpty_MT = "ISERV21007";//Tarifas Acesso às Redes Fora do Vazio MT
const Item_TAR_Empty_MT = "ISERV21008";//Tarifas Acesso às Redes Vazio MT
const Item_OPC_FLAT = "ISERV21009";//Tarifas de utilização dos OPC de ativação (UN)
const Item_OPC_KWH = "ISERV21010";//Tarifas de utilização dos OPC por kWh
const Item_OPC_TIME = "ISERV21011";//Tarifas de utilização dos OPC por min
const Item_IEC = "ISERV21012"; //IEC – Imposto Especial sobre o Consumo
const Item_OTHERS = "ISERV21013"; //Outros
const Item_MobServicesEVIO = "ISERV21014"; //Serviço Mobilidade Elétrica
const Item_Public_Grant = "ISERV21019"; //Apoio Público MOBIE
const Item_OtherNetworks = "ISERV21024"
// ====== New codes from Roaming ====== //
const Item_OPC = "ISERV21020";
const Item_Energy = " ISERV21021";
const Item_TAR = "ISERV21022";
const Item_MobieServices = "ISERV21023";
const Item_RoamingServices = "ISERV21301"


const SessionStatusRunning = "ACTIVE";
const SessionStatusStopped = "COMPLETED";
const SessionStatusFailed = "INVALID";
const SessionStatusToStart = "PENDING";
const SessionStatusToStop = "PENDING_STOP";
const SessionStatusExpired = "EXPIRED";
const SessionStatusSuspended = "SUSPENDED"; // for now, just means malformed cdr from mobie and waiting for their correction before processing payment
const SessionStatusInvalidSystem = "INVALID";

// SFTP Variables 

const fullDateLength = 8
const evioFinalEnum = "_EVIO_FINAL_"
const dayDateFormat = "YYYYMMDD"
const monthDateFormat = "YYYYMM"

//https://[ceme_server]/ocpi/emsp/2.2/

module.exports = {
    SessionStatusToStop: SessionStatusToStop,
    SessionStatusRunning: SessionStatusRunning,
    SessionStatusStopped: SessionStatusStopped,
    SessionStatusFailed: SessionStatusFailed,
    SessionStatusToStart: SessionStatusToStart,
    SessionStatusExpired: SessionStatusExpired,
    SessionStatusSuspended: SessionStatusSuspended,
    SessionStatusInvalidSystem,
    Item_Energy_OutEmpty_BT: Item_Energy_OutEmpty_BT,
    Item_Energy_Empty_BT: Item_Energy_Empty_BT,
    Item_Energy_OutEmpty_MT: Item_Energy_OutEmpty_MT,
    Item_Energy_Empty_MT: Item_Energy_Empty_MT,
    Item_TAR_OutEmpty_BT: Item_TAR_OutEmpty_BT,
    Item_TAR_Empty_BT: Item_TAR_Empty_BT,
    Item_TAR_OutEmpty_MT: Item_TAR_OutEmpty_MT,
    Item_TAR_Empty_MT: Item_TAR_Empty_MT,
    Item_OPC_FLAT: Item_OPC_FLAT,
    Item_OPC_KWH: Item_OPC_KWH,
    Item_OPC_TIME: Item_OPC_TIME,
    Item_IEC: Item_IEC,
    Item_OTHERS: Item_OTHERS,
    Item_MobServicesEVIO: Item_MobServicesEVIO,
    Item_Public_Grant: Item_Public_Grant,
    Item_OtherNetworks: Item_OtherNetworks,
    mongo_connection: mongo_connection,
    paymentEndpoint: paymentEndpoint,
    billingEndpoint: billingEndpoint,
    billingRoamingEndpoint: billingRoamingEndpoint,
    billingEndpointWL: billingEndpointWL,
    publicNetworkChargersProxy: publicNetworkChargersProxy,
    publicNetworkUpdateChargersProxy: publicNetworkUpdateChargersProxy,
    publicNetworkUpdatePlugStatusProxy: publicNetworkUpdatePlugStatusProxy,
    publicNetworkUpdateChargersProxyBulk: publicNetworkUpdateChargersProxyBulk,
    publicNetworkUpdateChargerProxy: publicNetworkUpdateChargerProxy,
    publicNetworkUpdateOrCreateChargersProxy: publicNetworkUpdateOrCreateChargersProxy,
    publicNetworkLocationsWrongBehaviorProxy: publicNetworkLocationsWrongBehaviorProxy,
    publicNetworkHubjectChargerByPlugID: publicNetworkHubjectChargerByPlugID,
    mobiePlatformCode: mobiePlatformCode,
    girevePlatformCode: girevePlatformCode,
    hubjectPlatformCode: hubjectPlatformCode,
    publicNetworkLocationsLastUpdatedProxy: publicNetworkLocationsLastUpdatedProxy,
    publicNetworkUpdateChargerRatingProxy: publicNetworkUpdateChargerRatingProxy,
    publicNetworkChargersDetailsProxy: publicNetworkChargersDetailsProxy,
    paymentCheckConditionsEndpoint: paymentCheckConditionsEndpoint,
    checkEvDriverEndpoint: checkEvDriverEndpoint,
    feesConfigEndpoint: feesConfigEndpoint,
    Item_OPC: Item_OPC,
    Item_Energy: Item_Energy,
    Item_TAR: Item_TAR,
    Item_MobieServices: Item_MobieServices,
    Item_RoamingServices: Item_RoamingServices,
    ocpiHost,
    publicNetworkUpdatePlugPowerProxy: publicNetworkUpdatePlugPower,
    fullDateLength: fullDateLength,
    evioFinalEnum: evioFinalEnum,
    dayDateFormat: dayDateFormat,
    monthDateFormat: monthDateFormat,
    evsDeletekmsFromEV: evsDeletekmsFromEV
}