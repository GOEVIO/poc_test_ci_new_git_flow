// Models
import TranslationKeys from '../models/translationKeys';

const commonLog = '[utils translations ';

async function getTranslationKeys(translationKey) {
    const context = `${commonLog} getTranslationKeys]`;
    try {
        if (!translationKey) {
            console.error(`[${context}] Error - Missing input translationKey`);
            throw new Error(`Missing input translationKey`);
        }
        const query = {
            translationKey: translationKey,
            active: true,
        };
        const filter = {
            key: 1,
            value: 1,
        };
        const translations = await TranslationKeys.find(query, filter);
        if (!translations) return {};

        let returnObject = {};
        for (const translationObject of translations) {
            returnObject[translationObject.key] = translationObject.value;
        }
        return returnObject;
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        throw error;
    }
}

export { getTranslationKeys };
