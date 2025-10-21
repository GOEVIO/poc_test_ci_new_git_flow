const Operator = require('../models/operator');
const { uploadBase64, deleteByUrl } = require('evio-library-commons');

const VALID_TYPES = new Set(['single', 'multiple', 'offline']);
const ICON_TYPE = 'cpoIcon';

function assertType(type) {
    if (!VALID_TYPES.has(type)) {
        const err = new Error(`Invalid type: ${type}. Valid: single|multiple|offline`);
        err.status = 400;
        throw err;
    }
}

/** Create/Update one icon for an operator (base64 -> file -> upsert on operators.icons) */
async function upsertOperatorIcon({ partyId, type, base64, contentType = 'image/png' }) {
    assertType(type);

    const oldIcon = await Operator.findOne(
        { partyId, "icons.type": type },
        { "icons.$": 1 }
    );

    const oldUrl = oldIcon?.icons?.length ? oldIcon.icons[0].url : undefined;

    const upload = await uploadBase64(base64, {
        type: ICON_TYPE,
        keyPrefix: `${partyId}/`,
        contentType,
    });

    const res = oldUrl ? await Operator.updateOne(
        { partyId, "icons.type": type },
        { $set: { "icons.$.url": upload.url } }
    ) : { nModified: 0 };

    if (res.nModified === 0) {
        await Operator.updateOne(
            { partyId },
            { $push: { icons: { type, url: upload.url } } },
            { upsert: true }
        );
    }

    deleteByUrl(oldUrl).catch(() => { console.warn(`Old icon not deleted: ${oldUrl}`); });

    return { partyId, type, url: upload.url };
}

/** Delete one icon (removes from storage and from operators.icons) */
async function deleteOperatorIcon({ partyId, type }) {
    assertType(type);
    const op = await Operator.findOne({ partyId }).select('icons').lean();
    const current = op?.icons?.find(i => i.type === type);

    await Operator.updateOne({ partyId }, { $pull: { icons: { type } } });

    if (current?.url) {
        try { await deleteByUrl(current.url); } catch (_) { /* ignore non-local urls */ }
    }
}

/** Bulk: given partyIds, return a map-like array { partyId, icons: {type,url}[] } */
async function listIconsByPartyIds(partyIds = []) {
    if (!Array.isArray(partyIds) || !partyIds.length) return [];
    const rows = await Operator.find({ partyId: { $in: partyIds } })
        .select('partyId icons')
        .lean();

    return rows.map(r => ({ partyId: r.partyId, icons: r.icons || [] }));
}

module.exports = {
    upsertOperatorIcon,
    deleteOperatorIcon,
    listIconsByPartyIds,
};
