import {
    IUserPassword
} from '../interfaces/users.interface';
import dotenv from 'dotenv-safe';
import { Schema, model } from 'mongoose';
import crypto from "crypto";

dotenv.load();

const userPasswordsSchema = new Schema<IUserPassword>({
    userId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    password: {
        type: String,
        required: true,
    }
}, {
    versionKey: false, // Disable the __v field
    timestamps: { createdAt: false, updatedAt: true }
});

// Create a compound index on userId and password
userPasswordsSchema.index({ userId: 1, password: 1 });

const UserPasswords = model<IUserPassword>('UserPasswords', userPasswordsSchema);

/**
 * Encrypts a password using the crypto library (two times)
 * @param rawPassword
 */
const getEncryptedPassword = (rawPassword: string) => {
    const cryptoAlgorithm = process.env.CRYPTO_ALGORITHM as string;
    const cryptoPassword = process.env.CRYPTO_PASSWORD as string;

    const secretCryptoAlgorithm = process.env.SECRET_CRYPTO_ALGORITHM as string;
    const secretCryptoPassword = process.env.SECRET_CRYPTO_PASSWORD as string;

    const cipher = crypto.createCipher(cryptoAlgorithm, cryptoPassword);
    let encryptedPassword = cipher.update(rawPassword, 'utf8', 'hex');
    encryptedPassword += cipher.final('hex');

    const secretCipher = crypto.createCipher(secretCryptoAlgorithm, secretCryptoPassword);
    encryptedPassword = secretCipher.update(encryptedPassword, 'utf8', 'hex');
    encryptedPassword += secretCipher.final('hex');

    return encryptedPassword;
}

/**
 * Encrypts a user id using the crypto library. Performing toString just to ensure it's a string(for cases that it's not - ObjectID)
 * @param rawUserId
 */
const getEncryptedUserId = (rawUserId: string) => {
    return crypto.createHash('md5').update(rawUserId.toString()).digest('hex');
}


export default module.exports = {
    /**
     * Authenticates a user by checking if the user id and password match the ones in the database
     * @returns the user password object if the user is authenticated
     * @throws an error if the user is not authenticated
     * @param rawUserId
     * @param rawPassword
     */
    authenticate: async (rawUserId: string, rawPassword: string) => {
        const encryptedUserId = getEncryptedUserId(rawUserId);
        const encryptedPassword = getEncryptedPassword(rawPassword);

        return UserPasswords.findOne({
            userId: encryptedUserId,
            password: encryptedPassword
        }).orFail(new Error('Invalid credentials'));
    },
    findPasswordByUserId: async (rawUserId: string) => {
        const encryptedUserId = getEncryptedUserId(rawUserId);

        return UserPasswords.findOne({
            userId: encryptedUserId
        }).lean();
    },
    removePasswordByUserId: async (rawUserId: string) => {
        const encryptedUserId = getEncryptedUserId(rawUserId);

        return UserPasswords.deleteOne({
            userId: encryptedUserId
        });
    },
    updatePassword: async (rawUserId: string, rawPassword: string) => {
        const encryptedPassword = getEncryptedPassword(rawPassword);
        const encryptedUserId = getEncryptedUserId(rawUserId);

        return UserPasswords.findOneAndUpdate(
            { userId: encryptedUserId },
            {
                $set: { password: encryptedPassword }
            },
            {
                upsert: true,
                new: true
            }
        );
    },
    /**
     * Performs upsert approach just to prevent duplicates (we have unique index as well)
     * @param rawUserId
     * @param rawPassword
     */
    addPassword: async (rawUserId: string, rawPassword: string) => {
        const encryptedPassword = getEncryptedPassword(rawPassword);
        const encryptedUserId = getEncryptedUserId(rawUserId);

        return UserPasswords.findOneAndUpdate(
            { userId: encryptedUserId },
            {
                $set: { password: encryptedPassword }
            },
            {
                upsert: true,
                new: true
            }
        );
    },
    /**
     * Adds a password to the database with one round of hashing
     * Performs upsert approach just to prevent duplicates (we have unique index as well)
     * @param rawUserId
     * @param oneRoundPasswordHashed
     */
    addPasswordWithOneHash: async (rawUserId: string, oneRoundPasswordHashed: string) => {
        const encryptedUserId = getEncryptedUserId(rawUserId);
        const secretCryptoAlgorithm = process.env.SECRET_CRYPTO_ALGORITHM as string;
        const secretCryptoPassword = process.env.SECRET_CRYPTO_PASSWORD as string;

        const secretCipher = crypto.createCipher(secretCryptoAlgorithm, secretCryptoPassword);
        oneRoundPasswordHashed = secretCipher.update(oneRoundPasswordHashed, 'utf8', 'hex');
        oneRoundPasswordHashed += secretCipher.final('hex');

        return UserPasswords.findOneAndUpdate(
            { userId: encryptedUserId },
            {
                $set: { password: oneRoundPasswordHashed }
            },
            {
                upsert: true,
                new: true
            }
        );
    }
};