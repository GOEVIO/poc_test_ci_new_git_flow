class SessionConfig {
    constructor() {
        this.price_kWh = process.env.price_kWh;
        this.max_charge_current = process.env.max_charge_current;
        this.max_charge_time = process.env.max_charge_time;
        this.max_energy_Wh = process.env.max_energy_Wh;
        this.charge_session_price = process.env.charge_session_price;
    }
}

module.exports = SessionConfig;