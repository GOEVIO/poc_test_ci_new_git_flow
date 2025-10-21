const Constants = {
    errorMessages : {
        invalidKms: 'Error - Invalid kms',
        invalidEvId: 'Error - Invalid evID',
        invalidChargerType: 'Error - Invalid chargerType',
        invalidSessionId: 'Error - Invalid sessionID',
        invalidUserId: 'Error - Invalid userID'
    },
    minKms: 0,
    maxKms: 10000000,
    listOfChargerTypes: ['001', '002', '003', '004', '005', '006', '007', '008', '009', '010', '011', '012', '013', '015'],
    listTypesAssets: process.env.listTypesAssets ? process.env.listTypesAssets.split(',') : ['TYPECARD', 'TYPEUSER', 'EV'],
    assets : {
        pagination : {
            defaultPage: 1,
            defaultLimit: 10,
            maximumLimit: 100,
        }
    },
    contracts : {
        contractStatusActive : "active",
        contractStatusInactive : "inactive",
        tokenTypeRFID : "RFID",
        tokenTypeAppUser : "APP_USER",
    },
    errorResponses : {
        assets : {
            activateNetwork : {
                code : 'server_asset_error_wrong_object',
                message : 'Invalid asset object'
            },
            notFound : {
                code : 'server_asset_error_not_found',
                message : 'Asset not found'
            },
            forbidden : {
                code : 'server_asset_error_forbidden',
                message : 'Forbidden access to this asset'
            },
            create : {
                code : 'server_asset_error_wrong_object',
                message : 'Invalid asset object'
            },
            delete : {
                code : 'server_asset_error_invalid_id',
                message : 'Invalid asset id'
            },
            update : {
                code : 'server_asset_error_wrong_object',
                message : 'Invalid asset object'
            },
            existingIdTag : {
                code : 'server_asset_error_different_id_tag',
                message : 'RFID tag does not match the previously defined RFID tag'
            },
            existingLicensePlate : {
                code : 'server_asset_error_existing_license_plate',
                message : 'License plate already exists in another asset' 
            }
        }
    }
    
};

module.exports = Constants;