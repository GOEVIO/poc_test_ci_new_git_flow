const checkRequiredFields = (object:object, requiredParams:Array<string>): Array<string> => {
    const validationErrors: Array<string> = [];
    requiredParams.forEach((param) => {
        if (
            !Object.keys(object).includes(param)
            || object[param] == null // 2 equals checks if it's undefined too
            || object[param]?.length < 1
        ) {
            validationErrors.push(`Param [${param}] is required`);
        }
    });
    return validationErrors;
};

const isValidName = (name: string): boolean => {
    // PATTERN: letters from any language, whitespaces and special chars . ' - are allowed
    const namePattern: RegExp = /^(?=.{1,100}$)[\p{L}\s.'-]+$/u;
    return namePattern.test(name);
};

const isValidSlug = (slug: string): boolean => {
    // PATTERN: letters between "a"-"z", numbers between 0-9 and special characters _- are allowed
    const slugPattern = /^[a-z0-9_-]+(?:-[a-z0-9]+)*$/g;
    return slugPattern.test(slug);
};

const isValidPortugueseZipCode = (zipCode: string): boolean => {
    const regex: RegExp = /^[0-9]{4}-[0-9]{3}$/;
    return regex.test(zipCode);
};

const isValidEmail = (email: string): boolean => {
    const regexEmailValidation: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regexEmailValidation.test(email);
};

const isValidPortugueseMobilePhone = (mobile: string): boolean => {
    const regexMobileValidation: RegExp = /^[9][1236]\d{7}$/;
    return regexMobileValidation.test(mobile);
};

const isValidPassword = (password: string): boolean => {
    const regexPasswordValidation = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@_$!%*?&])[A-Za-z\d@_$!%*?&]{8,}$/;
    return regexPasswordValidation.test(password);
};

export {
    checkRequiredFields,
    isValidEmail,
    isValidName,
    isValidPassword,
    isValidSlug,
    isValidPortugueseZipCode,
    isValidPortugueseMobilePhone
};
