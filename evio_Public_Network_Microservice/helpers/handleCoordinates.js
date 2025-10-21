const {
    verifyIfCoordinatesUpdate,
    isFlagChooseSearchCoordinatesActive,
    returnCoordinatesAccordingToFlag,
    returnCoordinatesAccordingToFlagMap
} = require('evio-library-chargers');

const getGeoQueryAndFeatureFlag = async (req) => {
    const searchCoordinatesFlagActive = await isFlagChooseSearchCoordinatesActive();
    const keyGeoSearch = searchCoordinatesFlagActive ? 'geometry' : 'originalCoordinates';
    const queryGeoSearch = {
        [keyGeoSearch]: {
            $near: {
                $maxDistance: req?.query?.distance || 10,
                $geometry: {
                    type: "Point",
                    coordinates: [parseFloat(req.query.lng), parseFloat(req.query.lat)]
                }
            }
        }
    }

    return { queryGeoSearch, searchCoordinatesFlagActive }
}

module.exports = {
    verifyIfCoordinatesUpdate,
    isFlagChooseSearchCoordinatesActive,
    returnCoordinatesAccordingToFlag,
    returnCoordinatesAccordingToFlagMap,
    getGeoQueryAndFeatureFlag
};
