import NodeCache from 'node-cache';
// Interfaces
import { ICacheObject } from '../interfaces/cacheInterface';

const myCache = new NodeCache({
    checkperiod: 0,
    stdTTL: 0,
    deleteOnExpire: false,
});

const commonLog = '[ cacheController ';

function writeKey(key: string, data: ICacheObject): Boolean {
    const context = `${commonLog} writeKey ]`;
    if (!key) {
        console.error(`${context} Error - Missing input key ${key}`);
        throw new Error('Missing input key');
    }
    myCache.set(key, data);
    return true;
}

function getKey(key: string): ICacheObject | null {
    const context = `${commonLog} getKey]`;
    if (!key) {
        console.error(`${context} Error - Missing input key ${key}`);
        throw new Error('Missing input key');
    }
    const wantedKey = myCache.get(key);
    return wantedKey as ICacheObject;
}

function deleteKey(key: string): Boolean {
    const context = `${commonLog} deleteKey]`;
    if (!key) {
        console.error(`${context} Error - Missing input key ${key}`);
        throw new Error('Missing input key');
    }
    // check if key is in cache
    if (myCache.has(key)) myCache.del(key);

    return true;
}

function getAllCacheKeys(): Object {
    const arrayKeys = myCache.keys();

    if (arrayKeys.length > 0) return myCache.mget(arrayKeys);
    return {};
}

export default {
    writeKey,
    getKey,
    deleteKey,
    getAllCacheKeys,
};
