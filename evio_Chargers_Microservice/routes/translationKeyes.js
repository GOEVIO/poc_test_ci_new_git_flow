const express = require('express');
const router = express.Router();
const TranslationKeys = require('../models/translationKeys')

router.get('/api/private/chargers/translation', (req, res, next) => {
    const context = "GET /api/private/translation";
    try {

        if (!req.query.key) {
            console.error(`${context} Error - Missing input`);
            return res.status(400).send({ auth: false, code: 'server_translationKey_required', message: 'Translation key required' });
        }
        let translationKey = []
        if (!Array.isArray(req.query.key)) translationKey.push(req.query.key)
        else translationKey = req.query.key

        let query = {
            translationKey: { $in: translationKey },
            active: true
        }
        const filter = {
            key: 1,
            value: 1,
            translationKey: 1
        }
        let responseObject = {}
        TranslationKeys.find(query, filter).then((translations) => {
            for (let key of translationKey) {
                if (translations.length < 1) {
                    responseObject[`${key}`] = {}
                } else {
                    let translationObject = {}
                    for (let transKey of translations) {
                        if (transKey.translationKey !== key) continue
                        translationObject[`${transKey.key}`] = `${transKey.value}`
                    }
                    responseObject[`${key}`] = translationObject
                }
            }

            return res.status(200).send({ 'translationKeys': responseObject });
        }).catch((error) => {
            console.error(`[${context}] Error `, error.message);
            return res.status(500).send({ auth: false, code: 'server_error', message: 'Server Error' });
        })
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send({ auth: false, code: 'server_error', message: 'Server Error' });
    }
})


router.post('/api/private/chargers/translation', (req, res, next) => {
    const context = "POST /api/private/translation";
    try {
        const translationKey = req.body.translationKey
        const key = req.body.key
        const value = req.body.value
        if (!translationKey || !key || !value) {
            console.error(`${context} Error - Missing input`);
            return res.status(400).send({ auth: false, code: 'server_input_required', message: 'Missing input data' });
        }

        TranslationKeys.findOne({ "translationKey": translationKey, "key": key }).then((translations) => {
            if (translations) {
                console.log(`${context} - key already exists`);
                return res.status(400).send({ auth: false, code: 'translation_key_exists', message: 'Translation key already exists' });
            }

            const newKeyTranslation = new TranslationKeys({
                "translationKey": translationKey,
                "key": key,
                "value": value,
                "active": true
            })
            newKeyTranslation.save().then((savedObject) => {
                return res.status(200).send(savedObject);
            }).catch((error) => {
                console.error(`[${context}] Error `, error.message);
                return res.status(500).send({ auth: false, code: 'server_error', message: 'Server Error' });
            })
        }).catch((error) => {
            console.error(`[${context}] Error `, error.message);
            return res.status(500).send({ auth: false, code: 'server_error', message: 'Server Error' });
        })
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send({ auth: false, code: 'server_error', message: 'Server Error' });
    }
})

router.patch('/api/private/chargers/translation', (req, res, next) => {
    const context = "PATCH /api/private/translation";
    try {
        const translationKey = req.body.translationKey
        const key = req.body.key
        const value = req.body.value

        if (!translationKey || !key || !value) {
            console.error(`${context} Error - Missing input`);
            return res.status(400).send({ auth: false, code: 'server_input_required', message: 'Missing input data' });
        }
        const query = {
            "translationKey": translationKey,
            "key": key,
            "active": true
        }
        TranslationKeys.findOneAndUpdate(query, { $set: { "value": value } }, { new: true }).then((updatedTranslations) => {
            if (!updatedTranslations) {
                console.log(`[${context}] Warning - Translation key or key not found in BD`);
                return res.status(400).send({ auth: false, code: 'missing_translation_key', message: `TranslationKey or key doesn't exist` });

            } else return res.status(200).send(updatedTranslations);
        }).catch((error) => {
            console.error(`[${context}] Error `, error.message);
            return res.status(500).send({ auth: false, code: 'server_error', message: 'Server Error' });
        })
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send({ auth: false, code: 'server_error', message: 'Server Error' });
    }
})

router.patch('/api/private/chargers/translation/status', (req, res, next) => {
    const context = "PATCH /api/private/translation/status";
    try {
        const translationKey = req.body.translationKey
        const key = req.body.key
        const active = req.body.active

        if (!translationKey || !key || (active !== false && active !== true)) {
            console.error(`${context} Error - Missing input`);
            return res.status(400).send({ auth: false, code: 'server_input_required', message: 'Missing input data' });
        }
        const query = {
            "translationKey": translationKey,
            "key": key,
        }
        TranslationKeys.findOneAndUpdate(query, { $set: { "active": active } }, { new: true }).then((updatedTranslations) => {
            if (!updatedTranslations) {
                console.log(`[${context}] Warning - Translation key or key not found in BD`);
                return res.status(400).send({ auth: false, code: 'missing_translation_key', message: `TranslationKey or key doesn't exist` });

            } else return res.status(200).send(updatedTranslations);
        }).catch((error) => {
            console.error(`[${context}] Error `, error.message);
            return res.status(500).send({ auth: false, code: 'server_error', message: 'Server Error' });
        })
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send({ auth: false, code: 'server_error', message: 'Server Error' });
    }
})


module.exports = router;