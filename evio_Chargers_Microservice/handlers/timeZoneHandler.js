const { find } = require('geo-tz')

module.exports = {
    getTimezoneFromCoordinates: function (chargerGeometryCoordinates) {
        const context = "Function getTimezoneFromCoordinates";
        try {
            return find(chargerGeometryCoordinates[1], chargerGeometryCoordinates[0])[0];
        } catch(error) {
            console.error(`[${context}][find from geo-tz] Error `, error.message);
            return ""
        }

    }
}