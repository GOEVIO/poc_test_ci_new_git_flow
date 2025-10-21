// Validator for checking if all keys of given object are not null
type EnvironmentVariables<T> = {
    [K in keyof T]: NonNullable<T[K]>;
};
// if true there is an unset key, false all key have values
export function isUnsetKeysVariables<T>(obj: T): boolean {
    const context = '[ validator objectValidator isUnsetKeysVariables]';
    try {
        let flagNull = false;
        for (const key in obj) {
            const value = obj[key];
            if (value === null) flagNull = true;

            // check by type
            switch (typeof value) {
                case 'object':
                    if (isUnsetKeysVariables(value)) flagNull = true;
                    break;
                case 'string':
                    if (value === 'undefined') flagNull = true;
                    break;
                case 'number':
                    if (Number.isNaN(value)) flagNull = true;
                    break;
                case 'undefined':
                    flagNull = true;
                    break;
                default:
                    break;
            }
            if (flagNull) {
                console.error(`${context} Error - Key ${key} is Missing his value`);
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error(`${context} Error - `, error.message);
        return true;
    }
}
