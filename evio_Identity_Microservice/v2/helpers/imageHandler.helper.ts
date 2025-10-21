import { promises as fs } from 'fs';
import path from 'path';
import {IGroupCSUser} from '../interfaces/groupCSUsers.interface';

export async function saveImageContent(group: IGroupCSUser): Promise<IGroupCSUser> {
    const context = 'Function saveImageContent';

    try {
        const dateNow = Date.now();
        const fileName = `${group._id}_${dateNow}.jpg`;
        const filePath = path.resolve('/usr/src/app/img/groupCSUsers', fileName);

        const base64Image = group.imageContent?.split(';base64,').pop() ?? '';
        if (!base64Image) {
            throw new Error(`[${context}] base64 image content is empty or invalid`);
        }

        let host = process.env.HostQAGroupCSUsers;
        if (process.env.NODE_ENV === 'production') {
            host = process.env.HostProdGroupCSUsers ?? host;
        } else if (process.env.NODE_ENV === 'pre-production') {
            host = process.env.HostPreProdGroupCSUsers ?? host;
        }

        const imageUrl = `${host}${fileName}`;

        await fs.writeFile(filePath, base64Image, { encoding: 'base64' });

        group.imageContent = imageUrl;
        return group;

    } catch (error: any) {
        console.error(`[${context}] Error saving image:`, error.message);
        throw error;
    }
}

export async function removeImageContent(groupCSUsers: IGroupCSUser): Promise<IGroupCSUser> {
    const context = 'Function removeImageContent';

    const imageContent = groupCSUsers.imageContent;
    if (!imageContent) {
        return groupCSUsers;
    }

    try {
        const imageFilename = path.basename(imageContent);
        const imagePath = path.resolve('/usr/src/app/img/groupCSUsers', imageFilename);

        await fs.unlink(imagePath).catch(err => {
            console.warn(`[${context}][fs.unlink] Warning: Could not delete image`, err.message);
        });

        groupCSUsers.imageContent = '';
        return groupCSUsers;

    } catch (error: any) {
        console.error(`[${context}] Error`, error.message);
        throw error;
    }
}
