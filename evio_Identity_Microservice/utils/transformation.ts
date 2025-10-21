import { ICharactersOptions } from '../interfaces/utils.interface';

// Escape all escapable special caracters: \ ^ $ * + ? . ( ) | { } [ ]
const escapeString = (string: string): string => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getRegex = (string: string, caseInsensitive?: boolean): RegExp => {
    const flags = caseInsensitive ? 'i' : '';
    return new RegExp(escapeString(string), flags);
};

const getRandomCharacters = (length: number, includes: ICharactersOptions = {
    lowercase: true,
    uppercase: true,
    numeric: true,
    specialchar: true
}) => {
    const lowercase = includes.lowercase ? 'abcdefghijklmnopqrstuvwxyz' : '';
    const uppercase = includes.uppercase ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : '';
    const numeric = includes.numeric ? '0123456789' : '';
    const specialchar = includes.specialchar ? '@_$!%*?&.' : '';
    const charset = `${lowercase}${uppercase}${numeric}${specialchar}`;
    let randomString = '';

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        randomString += charset[randomIndex];
    }

    return randomString;
};

const generateRandomPassword = (length: number = 12): string => {
    const passwordLength = length > 8 ? length : 8;

    const password = `${
        getRandomCharacters(1, { lowercase: true })
    }${
        getRandomCharacters(1, { specialchar: true })
    }${
        getRandomCharacters(1, { numeric: true })
    }${
        getRandomCharacters(1, { uppercase: true })
    }${
        getRandomCharacters(passwordLength - 4)
    }`;

    return password;
};

export {
    escapeString,
    generateRandomPassword,
    getRandomCharacters,
    getRegex
};
