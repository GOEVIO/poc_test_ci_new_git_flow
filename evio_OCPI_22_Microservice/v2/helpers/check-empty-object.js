const isNotEmptyObject = (obj) => {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
        return false;
    }
    return Object.keys(obj).length > 0;
}

const isEmptyObject = (obj) => {
    return !isNotEmptyObject(obj);
}

module.exports = { isNotEmptyObject, isEmptyObject };