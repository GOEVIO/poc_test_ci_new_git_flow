// The directFields is array with fields we need to update when session receive cdr and there not necessary a validation before
const directFieldsOCPI = [
    'status', 
    'transactionId', 
    'timeCharged', 
    'totalPower', 
    'kwh', 
    'CO2Saved', 
    'finalPrices', 
    'invoiceLines',
    'invoiceId'
];

export const mapFieldsToUpdateOcpi = (session: any) => ([
    ...directFieldsOCPI.map(field => ({
        name: field,
        sessionValue: session?.[field]
    })),
    {
        name: 'plugId',
        sessionValue: session?.connector_id || '',
    },
    {
        name: 'chargerOwner',
        sessionValue: session?.chargeOwnerId || '',
    },
    {
        name: 'startDate',
        sessionValue: session?.start_date_time ? new Date(session?.start_date_time) : '',
    },
    {
        name: 'stopDate',
        sessionValue: session?.end_date_time ? new Date(session?.end_date_time) : '',
    },
    {
        name: 'totalPrice',
        sessionValue: {
            excl_vat: session?.total_cost?.excl_vat || 0,
            incl_vat: session?.total_cost?.incl_vat || 0,
        }
    },
    {
        name: 'authType',
        sessionValue: session?.cdr_token?.type || '',
    },
    {
        name: 'sessionId',
        sessionValue: session?.id || '',
    },
    {
        name: 'idTag',
        sessionValue: session?.token_uid || '',
    },
    {
        name: 'hwId',
        sessionValue: session?.location_id || '',
    },
    {
        name: 'fleetId',
        sessionValue: session?.fleetDetails?._id || '',
    },
    {
        name: 'estimatedPrice',
        sessionValue: session?.total_cost?.incl_vat || 0,
    },
    {
        name: 'finalPrice',
        sessionValue: session?.total_cost?.incl_vat || 0,
    },
    {
        name: 'acceptKMs',
        sessionValue: session?.acceptKMs || false,
    },
    {
        name: 'updateKMs',
        sessionValue: session?.updateKMs || false,
    }
])