import { Request, Response, NextFunction } from 'express';

export const imageSizeValidator = (req: Request, res: Response, next: NextFunction) => {
    const newImages = req.body.newImages;
    if (!newImages || !Array.isArray(newImages)) {
        return res.status(400).json({
            auth: false,
            code: 'server_error_invalid_images_array',
            message: 'The field "newImages" must be an array of base64-encoded images.'
        });
    }

    for (const image of newImages) {
        const base64Data = image.includes(';base64,')
            ? image.split(';base64,').pop()!
            : image;

        if (!base64Data) {
            return res.status(400).json({
                auth: false,
                code: 'server_error_invalid_image_format',
                message: 'One or more images have an invalid base64 format.'
            });
        }

        const buffer = Buffer.from(base64Data, 'base64');
        if (buffer.length > 800 * 1024) {
            return res.status(400).json({
                auth: false,
                code: 'server_error_image_too_large',
                message: 'One or more images exceed the maximum size of 800KB.'
            });
        }
    }

    next();
};
