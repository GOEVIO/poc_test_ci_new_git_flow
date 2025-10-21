export const SERVICE_DESCRIPTIONS: Record<string, Record<string, string>> = {
    SERV221021: {
        'PT': 'Serviço de Carregamento de Veículo Elétrico',
        'PT-PT': 'Serviço de Carregamento de Veículo Elétrico',
        'EN': 'EV Charging session',
        'EN-GB': 'EV Charging session',
        'ES': 'Servicio de Recarga de Vehículo Eléctrico',
        'ES-ES': 'Servicio de Recarga de Vehículo Eléctrico',
        'FR-FR': 'Service de recharge pour véhicule électrique',
    },
    SERV221022: {
        'PT': 'Serviço de Carregamento de Veículo Elétrico',
        'PT-PT': 'Serviço de Carregamento de Veículo Elétrico',
        'EN': 'EV Charging session',
        'EN-GB': 'EV Charging session',
        'ES-ES': 'Servicio de Recarga de Vehículo Eléctrico',
        'FR': 'Service de recharge pour véhicule électrique',
        'FR-FR': 'Service de recharge pour véhicule électrique',
    }
};

export function getServiceDescription(code: string, language: string): string {
    const lang = language.toUpperCase();
    const descs = SERVICE_DESCRIPTIONS[code];
    if (!descs) return code;
    return descs[lang] || descs[lang.split('_')[0]] || descs['EN-GB'];
}