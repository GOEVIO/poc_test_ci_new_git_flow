import { ObjectId } from 'mongoose';

export interface ICacheObject {
    online: Boolean;
    lastChanged: Date;
    controllerId: ObjectId
    isSubscribed?: Boolean;
}
