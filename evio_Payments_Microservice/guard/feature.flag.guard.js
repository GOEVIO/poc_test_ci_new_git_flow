const toggle = require('evio-toggle').default;

class FeatureFlagGuard {
    constructor() { }
    static async canActivate(roleName) {
        // Check for a feature  
        const isEnabled = await toggle.isEnable(roleName);

        console.log(`[${roleName}] isEnabled: ${isEnabled}`);

        // Get the feature value
        const values = await toggle.getValue(roleName);
        if (isEnabled) return values ?? isEnabled;
        else return false;
    }
}

module.exports = FeatureFlagGuard;