import {
    Client, GeocodeResponse, GeocodeResult, PlaceType2
} from '@googlemaps/google-maps-services-js';
import Constants from '../utils/constants';
import { getName } from 'country-list';

export const getAddressInfoByZipCode = async (zipCode: string): Promise<GeocodeResponse> => {
    const client = new Client({});
    return client.geocode({
        params: {
            address: zipCode,
            key: Constants.providers.google.mapsApiKey
        }
    });
};

export const isZipAddressValidToCountry = async (zipCode: string, countryCode: string): Promise<boolean> => {
    const country = getName(countryCode)
    const client = new Client({});
    const result = await client.geocode({
        params: {
            address: `${zipCode} ${country}`,
            key: Constants.providers.google.mapsApiKey
        }
    });

    return result?.data.results.some(
        (data: GeocodeResult) => data.address_components.some(
            (addressComponent) => addressComponent.types.includes(
                PlaceType2.country
            ) && addressComponent.short_name === countryCode
        )
    );
};
