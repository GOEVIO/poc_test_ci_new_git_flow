import {
    AvailabilityParameter,
    UpperCaseAvailabilityParameter,
} from '../enum/availability-parameters'

export function changeAvailability(): never
export function changeAvailability(
    availability: AvailabilityParameter,
): AvailabilityParameter
export function changeAvailability(
    availability: AvailabilityParameter | undefined,
): AvailabilityParameter | never
export function changeAvailability(
    availability?: AvailabilityParameter,
): AvailabilityParameter {
    if (!availability) {
        throw (
            'Availability parameter "Operative" or "Inoperative" is required'
        )
    }
    const upperAvailability = availability.toUpperCase() as UpperCaseAvailabilityParameter

    return AvailabilityParameter[upperAvailability]
}
