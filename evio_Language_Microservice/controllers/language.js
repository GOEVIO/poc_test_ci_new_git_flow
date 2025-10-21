const express = require('express');
const router = express.Router();
var Language = require('../models/language');
const hash = require('object-hash');

//========== POST ==========
//Create a new language
router.post('/api/public/language/translation', (req, res, next) => {
    var context = "POST /api/public/language/translation";
    try {
        var language = new Language(req.body);
        validateFields(language, res);
        var query = {
            $and: [
                { languageCode: language.languageCode },
                { languageName: language.languageName }
            ]
        };
        Language.findOne(query, (err, result) => {
            if (err) {
                console.log(`[${context}][findOne] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (result)
                    return res.status(400).send({ auth: false, code: 'server_language_exists', message: "Language already exists" });
                else {
                    Language.createLanguage(language, (err, result) => {
                        if (err) {
                            console.log(`[${context}][createLanguage] Error `, err.message);
                            return res.status(500).send(err.message);
                        }
                        else {
                            if (result)
                                return res.status(200).send(result);
                            else
                                return res.status(400).send({ auth: false, code: 'server_language_not_created', message: "Language not created" });
                        };
                    });
                };
            };
        });
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== PATCH ==========
//Add a new translations
router.patch('/api/public/language/translation', (req, res, next) => {
    var context = "PATCH /api/public/language/translation";
    try {
        var language = req.body;
        if (language.translations === undefined || language.translations.length === 0)
            return res.status(400).send({ auth: false, code: 'server_translations_required', message: "Translations is required" });
        else {
            var query = {
                _id: language._id
            };
            Language.findOne(query, (err, result) => {
                if (err) {
                    console.log(`[${context}][findOne] Error `, err.message);
                    return res.status(500).send(err.message);
                }
                else {
                    if (result) {
                        if (result.translations.length === 0) {
                            result.translations = language.translations;
                            var newValues = { $set: result };
                            updateLanguage(newValues, query)
                                .then((value) => {
                                    if (value) {
                                        return res.status(200).send({ auth: true, code: 'server_update_successfully', message: "Update successfully" });
                                    }
                                    else
                                        return res.status(400).send({ auth: false, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                                })
                                .catch((error) => {
                                    console.log(`[${context}][updateLanguage][.catch] Error `, error.message);
                                    return res.status(500).send(error.message);
                                });
                        }
                        else {
                            getKeys(result, language)
                                .then((value) => {
                                    var newValues = { $set: value };
                                    updateLanguage(newValues, query)
                                        .then((value) => {
                                            if (value)
                                                return res.status(200).send({ auth: true, code: 'server_update_successfully', message: "Update successfully" });
                                            else
                                                return res.status(400).send({ auth: false, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                                        })
                                        .catch((error) => {
                                            console.log(`[${context}][updateLanguage] Error `, error.message);
                                            return res.status(500).send(error.message);
                                        });
                                })
                                .catch((error) => {
                                    console.log(`[${context}][getKeys][.catch] Error `, error.message);
                                    return res.status(500).send(error.message);
                                });
                        };
                    }
                    else
                        return res.status(400).send({ auth: false, code: 'server_translations_not_found', message: "Translations not found for given parameters" });
                };
            });
        };
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== DELETE ==========
//delete a translation
router.delete('/api/public/language/translation', (req, res, next) => {
    var context = "DELETE /api/public/language/translation";
    try {
        var language = req.body;
        if (language.translations.length === 0)
            return res.status(400).send({ auth: false, code: 'server_no_translation_delete', message: "No translations to delete" });
        else {
            var query = {
                _id: language._id
            };

            Language.findOne(query, (err, result) => {
                if (err) {
                    console.log(`[${context}][findOne] Error `, err.message);
                    return res.status(500).send(err.message);
                }
                else {
                    if (result) {
                        const verifyKeys = (translation) => {
                            return new Promise((resolve, reject) => {
                                try {
                                    var found = result.translations.indexOf(result.translations.find((translationDelete) => {
                                        return (translationDelete.key === translation.key && translationDelete.value === translation.value);
                                    }));
                                    if (found >= 0) {
                                        result.translations.splice(found, 1);
                                        resolve(true);
                                    }
                                    else
                                        resolve(true);
                                } catch (error) {
                                    console.log(`[${context}][verifyKeys] Error `, error.message);
                                    reject(error);
                                };
                            });
                        };

                        Promise.all(
                            language.translations.map(translation => verifyKeys(translation))
                        )
                            .then((value) => {
                                var newValues = { $set: result };
                                updateLanguage(newValues, query)
                                    .then((value) => {
                                        if (value)
                                            return res.status(200).send({ auth: true, code: 'server_translation_delete_successfully', message: "Translation delete successfully" });

                                        else
                                            return res.status(400).send({ auth: false, code: 'server_translation_delete_unsuccessfully', message: "Translation delete unsuccessfully" });
                                    })
                                    .catch((error) => {
                                        console.log(`[${context}][updateLanguage][.catch] Error `, error.message);
                                        return res.status(500).send(error.message);
                                    });
                            })
                            .catch((error) => {
                                console.log(`[${context}][translations.map][.catch] Error `, error.message);
                                return res.status(500).send(error.message);
                            });
                    }
                    else
                        return res.status(400).send({ auth: false, code: 'server_translations_not_found', message: "Translations not found for given parameters" });
                };
            });
        };
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//delete a language
router.delete('/api/public/language', (req, res, next) => {
    var context = "DELETE /api/public/language";
    try {
        var languages = req.body
        const deleteLanguage = (language) => {
            return new Promise((resolve, reject) => {
                var query = {
                    _id: language._id
                };
                Language.removeLanguage(query, (err, result) => {
                    if (err) {
                        console.log(`[${context}][deleteLanguage] Error `, err.message);
                        reject(err);
                    }
                    else {
                        if (result)
                            resolve(true);
                        else
                            resolve(false);
                    };
                });
            });
        };
        Promise.all(
            languages.map((language) => {
                deleteLanguage(language)
            })
        )
            .then((value) => {
                if (value)
                    return res.status(200).send({ auth: true, code: 'server_Language_delete_successfully', message: "Language delete successfully" });
                else
                    return res.status(400).send({ auth: false, code: 'server_Language_delete_unsuccessfully', message: "Language delete unsuccessfully" });
            })
            .catch((error) => {
                console.log(`[${context}][.catch] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== GET ==========
//Get all Languages
router.get('/api/public/language/translation', (req, res, next) => {
    var context = "GET /api/public/language/translation";
    try {
        const filter = {};
        if (req.query) {
            filter.query = req.query;
        };
        Language.find(filter.query, (err, translation) => {
            if (err) {
                console.log(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (typeof translation === 'undefined' || translation.length <= 0) {
                    let query = {
                        languageCode: "en"
                    };
                    Language.find(query, (err, translation) => {
                        if (err) {
                            console.log(`[${context}][find] Error `, err.message);
                            return res.status(500).send(err.message);
                        }
                        else {
                            if (typeof translation === 'undefined' || translation.length <= 0) {
                                console.log(`[${context}][Language.find][Not found] Error `, filter.query);
                                return res.status(200).send([]);
                            }
                            else {
                                return res.status(200).send(translation);
                            };
                        };
                    });
                }
                else
                    return res.status(200).send(translation);
            };
        });
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/public/language/checktranslation', (req, res, next) => {
    var context = "GET /api/public/language/checktranslation";
    try {
        if (!req.query.languageCode)
            return res.status(400).send({ auth: false, code: 'server_language_code_specified', message: "Language code must be specified on translation search" });

        const filter = {};
        if (req.query) {
            filter.query = req.query;
        };

        Language.find(filter.query, (err, translation) => {
            if (err) {
                console.log(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (typeof translation === 'undefined' || translation.length <= 0) {
                    var query = {
                        languageCode: "en"
                    };
                    Language.find(query, (err, translation) => {
                        if (err) {
                            console.log(`[${context}][find] Error `, err.message);
                            return res.status(500).send(err.message);
                        }
                        else {
                            if (typeof translation === 'undefined' || translation.length <= 0) {
                                return res.status(400).send({ auth: false, code: 'server_translation_not_found', message: "Translation not found for given parameters" });
                            }
                            else {
                                var newhash = hash(JSON.stringify(translation[0]));
                                return res.status(200).send({ auth: true, translationHash: newhash });
                            };
                        };
                    });
                }
                else {
                    var newhash = hash(JSON.stringify(translation[0]));
                    return res.status(200).send({ auth: true, translationHash: newhash });
                };
            };
        });
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});


function getKeys(language, newLanguage) {
    var context = "Function getKeys";
    return new Promise((resolve, reject) => {
        try {
            const verifyKeys = (translation) => {
                return new Promise((resolve, reject) => {
                    try {
                        var found = language.translations.indexOf(language.translations.find((translationResult) => {
                            return translation.key === translationResult.key;
                        }));
                        if (found < 0) {
                            language.translations.push(translation);
                            resolve(true);
                        }
                        else {
                            if (language.translations[found].value === translation.value) {
                                resolve(false);
                            }
                            else {
                                language.translations[found] = translation;
                                resolve(true);
                            };
                        };
                    } catch (error) {
                        console.log(`[${context}][verifyKeys] Error `, error.message);
                        reject(error);
                    };
                });
            };
            Promise.all(
                newLanguage.translations.map(translation => verifyKeys(translation))
            )
                .then((value) => {
                    resolve(language);
                })
                .catch((error) => {
                    console.log(`[${context}][.catch] Error `, error.message);
                    reject(error);
                });
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function updateLanguage(language, query) {
    var context = "Function updateLanguage";
    return new Promise((resolve, reject) => {
        try {
            Language.updateLanguage(query, language, (err, result) => {
                if (err) {
                    console.log(`[${context}][updateLanguage] Error `, err.message);
                    reject(err);
                }
                else {
                    if (result)
                        resolve(true);
                    else
                        resolve(false);
                };
            });
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function validateFields(language, res) {
    if (!language)
        return res.status(400).send({ auth: false, code: 'server_language_data_required', message: 'Language data is required' });
    //throw new Error('Language data is required');

    if (!language.languageCode)
        return res.status(400).send({ auth: false, code: 'server_language_code_required', message: 'Language code is required' });
    //throw new Error('Language code is required');

    if (!language.languageName)
        return res.status(400).send({ auth: false, code: 'server_language_name_required', message: 'Language name is required' });
    //throw new Error('Language name is required');
};


router.get('/api/private/language/notificationKey', (req, res, next) => {
    var context = "GET /api/private/language/notificationKey";
    try {

        if (!req.query.languageCode) {
            return res.status(400).send({ auth: false, code: 'server_language_code_specified', message: "Language code must be specified on translation search" });
        }

        if (!req.query.key) {
            return res.status(400).send({ auth: false, code: 'server_key_specified', message: "Key must be specified on translation search" });
        }

        Language.findOne({ languageCode: req.query.languageCode }, (err, language) => {
            if (err) {
                console.log(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (language) {
                    let foundTranslation = language.translations.find(item => item.key === req.query.key);
                    if (foundTranslation) {

                        let foundTime = language.translations.find(item => item.key === "notification_time");
                        let foundEnergy = language.translations.find(item => item.key === "notification_energy");

                        let notification = {
                            title: foundTranslation.value,
                            time: foundTime.value,
                            energy: foundEnergy.value
                        }

                        return res.status(200).send(notification);
                    }
                    else {
                        return res.status(400).send({ auth: true, code: 'server_translation_not_found', message: "Translation not found for given parameters" });
                    }
                }
                else
                    return res.status(400).send({ auth: true, code: 'server_translation_not_found', message: "Translation not found for given parameters" });
            };
        });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/language/notificationKey/stop', (req, res, next) => {
    var context = "GET /api/private/language/notificationKey/stop";
    try {

        if (!req.query.languageCode) {
            return res.status(400).send({ auth: false, code: 'server_language_code_specified', message: "Language code must be specified on translation search" });
        }

        if (!req.query.key) {
            return res.status(400).send({ auth: false, code: 'server_key_specified', message: "Key must be specified on translation search" });
        }

        Language.findOne({ languageCode: req.query.languageCode }, (err, language) => {
            if (err) {
                console.log(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (language) {
                    let foundTranslation = language.translations.find(item => item.key === req.query.key);
                    if (foundTranslation) {

                        let foundBodyPrice = language.translations.find(item => item.key === "notification_stop_session_body_price");
                        let foundBodyNoPrice = language.translations.find(item => item.key === "notification_stop_session_body_no_price");

                        let notification = {
                            title: foundTranslation.value,
                            bodyPrice : foundBodyPrice.value,
                            bodyNoPrice : foundBodyNoPrice.value,
                        }

                        return res.status(200).send(notification);
                    }
                    else {
                        return res.status(400).send({ auth: true, code: 'server_translation_not_found', message: "Translation not found for given parameters" });
                    }
                }
                else
                    return res.status(400).send({ auth: true, code: 'server_translation_not_found', message: "Translation not found for given parameters" });
            };
        });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/language/notificationKey/data', (req, res, next) => {
    var context = "GET /api/private/language/notificationKey/data";
    try {

        if (!req.query.languageCode) {
            return res.status(400).send({ auth: false, code: 'server_language_code_specified', message: "Language code must be specified on translation search" });
        }

        if (!req.query.key) {
            return res.status(400).send({ auth: false, code: 'server_key_specified', message: "Key must be specified on translation search" });
        }

        Language.findOne({ languageCode: req.query.languageCode }, (err, language) => {
            if (err) {
                console.log(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (language) {
                    let foundTranslation = language.translations.find(item => item.key === req.query.key);
                    if (foundTranslation) {

                        let foundBodyPrice = language.translations.find(item => item.key === "notification_stop_session_body_price");
                        let foundBodyNoPrice = language.translations.find(item => item.key === "notification_stop_session_body_no_price");

                        let notification = {
                            title: foundTranslation.value,
                            bodyPrice : foundBodyPrice.value,
                            bodyNoPrice : foundBodyNoPrice.value,
                        }

                        return res.status(200).send(notification);
                    }
                    else {
                        return res.status(400).send({ auth: true, code: 'server_translation_not_found', message: "Translation not found for given parameters" });
                    }
                }
                else
                    return res.status(400).send({ auth: true, code: 'server_translation_not_found', message: "Translation not found for given parameters" });
            };
        });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/language/notificationKey/notificationInfo', (req, res, next) => {
    var context = "GET /api/private/language/notificationKey/notificationInfo";
    try {

        if (!req.query.languageCode) {
            return res.status(400).send({ auth: false, code: 'server_language_code_specified', message: "Language code must be specified on translation search" });
        }

        if (!req.query.key) {
            return res.status(400).send({ auth: false, code: 'server_key_specified', message: "Key must be specified on translation search" });
        }

        Language.findOne({ languageCode: req.query.languageCode }, (err, language) => {
            if (err) {
                console.log(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (language) {
                    let foundTranslation = language.translations.filter(item => item.key.includes(req.query.key));
                    if (foundTranslation.length > 0) {
                        return res.status(200).send(foundTranslation);
                    }
                    else {
                        return res.status(400).send({ auth: true, code: 'server_translation_not_found', message: "Translation not found for given parameters" });
                    }
                }
                else
                    return res.status(400).send({ auth: true, code: 'server_translation_not_found', message: "Translation not found for given parameters" });
            };
        });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

module.exports = router;