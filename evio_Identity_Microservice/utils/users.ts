import { IUserDocument, IUserRestrictedReturn } from '../interfaces/users.interface'
import Constants from './constants';
import { customList } from 'country-codes-list';

const removeSensitiveInformation = (user: IUserDocument):IUserRestrictedReturn => ({
    _id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
    mobile: user.mobile,
    internationalPrefix: user.internationalPrefix,
    clientType: user.clientType,
    clientName: user.clientName,
    imageContent: user.imageContent,
    active: user.active,
});

const getCardName = (name: string[]): string => {
    const [firstName, ...rest] = name;
    const lastName = rest.pop();
    return lastName ? `${firstName} ${lastName}` : firstName;
};

const setLanguageUser = (user: IUserDocument, appConfig: any, language: string) : string => {
    //set language preference
    const languageToSet = ( user.language ?? language ?? Constants.defaultLanguage );
    const spltLanguage = languageToSet?.split('_');
    const lang = `${spltLanguage[0]}_${spltLanguage[0].toUpperCase()}`;
    
    return appConfig?.languagesAllowed?.languages && appConfig?.languagesAllowed?.languages.includes(languageToSet) 
    ? languageToSet 
    : appConfig?.languagesAllowed?.languages && appConfig?.languagesAllowed?.languages.includes(lang) 
    ? lang 
    : appConfig?.languagesAllowed?.default ?? Constants.defaultLanguage;  
}

const normalizeCountryCodeToCountryName = (countryCode: string): string|undefined => {
     if (!countryCode || typeof countryCode !== 'string' || countryCode.trim() === '') {
        return undefined; // Default value for invalid input
    }
    const myCountryCodesObject = customList('countryCode','{countryNameEn}');
    return myCountryCodesObject[countryCode] || undefined; // Return the country name or undefined if not found
};

export default {
    removeSensitiveInformation,
    getCardName,
    setLanguageUser,
    normalizeCountryCodeToCountryName
};
