const toggle = require('evio-toggle').default;

function validateFeatureFlag(featureFlag) {
    return async (req, res, next) => {
        try {
            const featureFlagEnabled = await toggle.isEnable(featureFlag);
            if (!featureFlagEnabled) {
                return res.status(403).send({ message: "Forbidden access to this resource" });
            }
            next();
        } catch (err) {
            return res.status(403).send({ message: "Forbidden access to this resource" });
        }
    };
}

module.exports = {
    validateFeatureFlag
};