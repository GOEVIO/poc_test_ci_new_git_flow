import { ObjectId } from 'mongoose';

export interface IUserMinimal {
    _id: ObjectId,
    name: string,
    imageContent?: string
}
