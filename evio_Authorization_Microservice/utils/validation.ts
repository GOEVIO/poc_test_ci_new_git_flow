const checkRequiredFields = (object:object, requiredParams:Array<string>): Array<string> => {
    const validationErrors: Array<string> = [];
    requiredParams.forEach((param) => {
        if (
            !Object.keys(object).includes(param)
            || object[param] == null // 2 equals checks if it's undefined too
            || object[param]?.length < 1
        ) {
            validationErrors.push(`Parameter [${param}] is required`);
        }
    });
    return validationErrors;
};

export {
    checkRequiredFields
};
