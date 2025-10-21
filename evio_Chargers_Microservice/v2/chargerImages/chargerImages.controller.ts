import { Request, Response } from 'express';
import {
    getChargerImages,
    addChargerImages,
    deleteChargerImage,
    setDefaultChargerImage,
} from './chargerImages.service';

export const listChargerImages = async (req: Request, res: Response) => {
    try {
        const chargerId = req.query.chargerId as string;

        const imagesData = await getChargerImages(chargerId);

        return res.status(200).json(imagesData);
    } catch (error: any) {
        console.error('Error listing charger images:', error.message);
        return res.status(500).send({
            auth: false,
            code: 'internal_server_error',
            message: "Internal server error"
        });
    }
};

export const addImages = async (req: Request, res: Response) => {
    try {
        const chargerId = req.query.chargerId as string;
        const { newImages } = req.body;

        const updatedCharger = await addChargerImages(chargerId, newImages);

        return res.status(200).json({
            images: updatedCharger.imageContent,
            defaultImage: updatedCharger.defaultImage,
        });
    } catch (error: any) {
        console.error('Error adding images:', error.message);
        return res.status(500).send({
            auth: false,
            code: 'internal_server_error',
            message: "Internal server error"
        });
    }
};

export const deleteImage = async (req: Request, res: Response) => {
    try {
        const chargerId = req.query.chargerId as string;
        const { imageUrl } = req.body;

        const updatedCharger = await deleteChargerImage(chargerId, imageUrl);

        return res.status(200).json({
            images: updatedCharger.imageContent,
            defaultImage: updatedCharger.defaultImage,
        });
    } catch (error: any) {
        console.error('Error deleting image:', error.message);
        return res.status(500).send({
            auth: false,
            code: 'internal_server_error',
            message: "Internal server error"
        });
    }
};

export const markDefaultImage = async (req: Request, res: Response) => {
    try {
        const chargerId = req.query.chargerId as string;
        const { imageUrl } = req.body;

        const updatedCharger = await setDefaultChargerImage(chargerId, imageUrl);

        return res.status(200).json({
            images: updatedCharger.imageContent,
            defaultImage: updatedCharger.defaultImage,
        });
    } catch (error: any) {
        console.error('Error marking default image:', error.message);
        return res.status(500).send({
            auth: false,
            code: 'internal_server_error',
            message: "Internal server error"
        });
    }
};
