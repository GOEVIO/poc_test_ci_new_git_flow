import fs from 'fs';

export const saveImageContent = async (imageFileName: string, directoryPath: string, imageContent: string, imagePath: string): Promise<string> => {
    let pathImage = '';
    const base64Image = imageContent.split(';base64,').pop();

    if (!base64Image) {
        throw new Error('Invalid image content');
    }

    switch (process.env.NODE_ENV) {
        case 'production':
            pathImage = `${process.env.HostProd}infrastructures/${imageFileName}`;
            break;
        case 'pre-production':
            pathImage = `${process.env.HostPreProd}infrastructures/${imageFileName}`;
            break;
        default:
            pathImage = `${process.env.HostQA}infrastructures/${imageFileName}`;
            break;
    }

    await fs.promises.mkdir(directoryPath, { recursive: true });

    await fs.promises.writeFile(imagePath, base64Image, { encoding: 'base64' });
    return pathImage;
};

