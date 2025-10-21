import { findChargerById, updateCharger } from './charger.repository';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { Charger } from './charger.types';

const IMAGE_DIR = '/usr/src/app/img/chargers/';

const generateFileName = (hwId: string): string => {
    return `${hwId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.jpg`;
};
const getImageUrlByFileName = (fileName: string): string => {
    const hosts = {
        production: process.env.HostProd,
        'pre-production': process.env.HostPreProd
    };
    const filePath = hosts[process.env.NODE_ENV as string] ?? process.env.HostQA;
    return `${filePath}chargers/${fileName}`;
};

const computeHash = (data: string): string => {
    return crypto.createHash('md5').update(data).digest('hex');
};

const isDuplicateImage = async (newBase64: string, charger: Charger): Promise<boolean> => {
    const newHash = computeHash(newBase64);

    for (const imageUrl of charger.imageContent) {
        // Extract the file name from the URL
        const fileName = imageUrl.split('/').pop();
        const filePath = path.join(IMAGE_DIR, fileName || '');
        try {
            // Read the existing file in base64 format
            const existingData = await fs.readFile(filePath, { encoding: 'base64' });
            const existingHash = computeHash(existingData);
            if (existingHash === newHash) {
                return true;
            }
        } catch (error) {
            console.error(`Error reading file ${filePath}:`, error);
        }
    }
    return false;
};

export const getChargerImages = async (chargerId: string): Promise<{ images: string[]; defaultImage?: string }> => {
    const charger: Charger | null = await findChargerById(chargerId);
    if (!charger) throw new Error('Charger not found');
    return { images: charger.imageContent, defaultImage: charger.defaultImage };
};

export const addChargerImages = async (chargerId: string, newImages: string[]): Promise<Charger> => {
    const charger: Charger | null = await findChargerById(chargerId);
    if (!charger) throw new Error('Charger not found');

    if (charger.imageContent.length + newImages.length > 4) {
        throw new Error('Maximum of 4 images allowed per charging station');
    }

    const addedImageUrls: string[] = [];

    for (const image of newImages) {
        const base64Data = image.includes(';base64,')
            ? image.split(';base64,').pop() as string
            : image;

        const duplicate = await isDuplicateImage(base64Data, charger);
        if (duplicate) {
            throw new Error('Duplicate image detected. Cannot add an image that already exists.');
        }

        const fileName = generateFileName(charger.hwId);
        const filePath = path.join(IMAGE_DIR, fileName);

        await fs.mkdir(IMAGE_DIR, { recursive: true });

        await fs.writeFile(filePath, base64Data, { encoding: 'base64' });

        const imageUrl = getImageUrlByFileName(fileName);
        addedImageUrls.push(imageUrl);
    }

    // Append new images to the existing array
    charger.imageContent.push(...addedImageUrls);

    // Set default image if not already set
    if (!charger.defaultImage && charger.imageContent.length > 0) {
        charger.defaultImage = charger.imageContent[0];
    }

    const updatedCharger = await updateCharger(chargerId, {
        imageContent: charger.imageContent,
        defaultImage: charger.defaultImage,
    });
    if (!updatedCharger) throw new Error('Failed to update charger');

    return updatedCharger;
};

export const deleteChargerImage = async (chargerId: string, imageUrl: string): Promise<Charger> => {
    const charger: Charger | null = await findChargerById(chargerId);
    if (!charger) throw new Error('Charger not found');

    const imageIndex = charger.imageContent.findIndex((img) => img === imageUrl);
    if (imageIndex === -1) {
        throw new Error('Image not found');
    }

    // Delete the physical file
    const fileName = imageUrl.split('/').pop();
    const filePath = path.join(IMAGE_DIR, fileName || '');
    try {
        await fs.unlink(filePath);
    } catch (error) {
        console.error(`Error deleting file ${filePath}:`, error);
    }

    // Remove the image from the array
    charger.imageContent.splice(imageIndex, 1);

    // If the removed image was the default, assign the first remaining image as default or clear it
    if (charger.defaultImage === imageUrl) {
        charger.defaultImage = charger.imageContent.length > 0 ? charger.imageContent[0] : '';
    }

    const updatedCharger = await updateCharger(chargerId, {
        imageContent: charger.imageContent,
        defaultImage: charger.defaultImage,
    });
    if (!updatedCharger) throw new Error('Failed to update charger after deletion');

    return updatedCharger;
};

export const setDefaultChargerImage = async (chargerId: string, imageUrl: string): Promise<Charger> => {
    const charger: Charger | null = await findChargerById(chargerId);
    if (!charger) throw new Error('Charger not found');

    if (!charger.imageContent.includes(imageUrl)) {
        throw new Error('Image not found in charger images');
    }

    charger.defaultImage = imageUrl;
    const updatedCharger = await updateCharger(chargerId, { defaultImage: imageUrl });
    if (!updatedCharger) throw new Error('Failed to update charger default image');

    return updatedCharger;
};
