import {
    verifyIfCoordinatesUpdate,
    isFlagChooseSearchCoordinatesActive,
    returnCoordinatesAccordingToFlag,
    returnCoordinatesAccordingToFlagMap
} from 'evio-library-chargers'

const getGeoQueryAndFeatureFlag = async (req) => {
    const searchCoordinatesFlagActive = await isFlagChooseSearchCoordinatesActive();
    const keyGeoSearch = searchCoordinatesFlagActive ? 'geometry' : 'originalCoordinates';
    const queryGeoSearch = {
        [keyGeoSearch]: {
            $near: {
                $maxDistance: req.query.distance,
                $geometry: {
                    type: "Point",
                    coordinates: [parseFloat(req.query.lng), parseFloat(req.query.lat)]
                }
            }
        }
    }

    return { queryGeoSearch, searchCoordinatesFlagActive }
}

export {
    verifyIfCoordinatesUpdate,
    returnCoordinatesAccordingToFlag,
    returnCoordinatesAccordingToFlagMap,
    getGeoQueryAndFeatureFlag,
    isFlagChooseSearchCoordinatesActive
}
