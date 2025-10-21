const Questions = require('../models/questions');
const axios = require("axios");
const { FileTransaction } = require('evio-library-language');
const { retrieveFileTranslationByLanguage } = FileTransaction

module.exports = {
    addQuestions: function (req) {
        let context = "Funciton addQuestions";
        return new Promise((resolve, reject) => {

            if (Object.keys(req.body).length != 0) {

                const question = new Questions(req.body);
                question.createUser = req.headers['userid'];

                validateFields(question)
                    .then(() => {
                        Questions.createQuestions(question, (err, result) => {
                            if (err) {
                                console.log(`[${context}][createQuestions] Error `, err.message);
                                reject(err);
                            }
                            else {
                                if (result)
                                    resolve(result);
                                else
                                    reject({ auth: false, code: 'server_questions_not_created', message: "Question not created" });
                            };
                        });
                    })
                    .catch((error) => {
                        console.log(`[${context}][validateFields] Error `, error.message);
                        reject(error);
                    });

            }
            else {

                reject({ auth: false, code: 'server_question_data_required', message: "Question data is required" });

            };

        });
    },
    updateQuestions: function (req) {
        let context = "Funciton updateQuestions";
        return new Promise((resolve, reject) => {

            let user = req.headers['userid'];
            let question = req.body;

            let query = {
                _id: question._id
            };
            question.modifyUser = user;

            let newValues = { $set: question };

            Questions.updateQuestions(query, newValues, (err, result) => {
                if (err) {

                    console.log(`[${context}][updateQuestions] Error `, err.message);
                    reject(err);

                }
                else {

                    if (Object.keys(result).length != 0)
                        resolve({ auth: true, code: 'server_question_update', message: "Question has been updated" });
                    else
                        reject({ auth: false, code: 'server_question_not_update', message: "Question has not been updated" });

                };
            });
        });
    },
    getQuestions: function (req) {
        let context = "Funciton getQuestions";
        return new Promise((resolve, reject) => {

            let filter = {};
            if (Object.keys(req.query).length != 0) {
                filter.query = req.query;
            };

            Questions.find(filter.query, (err, result) => {
                if (err) {
                    console.log(`[${context}][find] Error `, err.message);
                    reject(err);
                }
                else {
                    if (result.length > 0) {
                        resolve(result);
                    }
                    else {
                        reject({ auth: false, code: 'server_no_questions_found', message: "Questions not found for given parameters" })
                    };
                };
            });

        });
    },
    getPublicQuestions: function (req) {
        let context = "Funciton getPublicQuestions";
        return new Promise(async (resolve, reject) => {
            const { language: lang } = req.headers;

            if (req.query.type && req.query.type != '001' && req.query.type != '002' && req.query.type != '003' && req.query.type != '004' && !req.query.type.includes('001') && !req.query.type.includes('002') && !req.query.type.includes('003') && !req.query.type.includes('004')) {

                let language = await getLanguage(lang);

                let filter = {};
                if (Object.keys(req.query).length != 0) {
                    filter.query = req.query;
                };

                Questions.find(filter.query, (err, result) => {
                    if (err) {
                        console.log(`[${context}][find] Error `, err.message);
                        reject(err);
                    }
                    else {
                        if (result.length != 0) {
                            if(!language) resolve(result);
                            
                            translateQuestions(language, result)
                                .then((result) => {
                                    resolve(result);
                                })
                                .catch((error) => {
                                    console.log(`[${context}][translateQuestions] Error `, error.message);
                                    reject(error);
                                });
                        }
                        else {
                            reject({ auth: false, code: 'server_no_questions_found', message: "Questions not found for given parameters" })
                        };
                    };
                });

            }
            else {

                reject({ auth: false, code: 'server_unsupported_question_type', message: "Unsupported question type" });

            };
        });
    },
    removeQuestions: function (req) {
        let context = "Funciton getPublicQuestions";
        return new Promise(async (resolve, reject) => {

            let user = req.headers['userid'];
            let question = req.body;
            let query = {
                _id: question._id
            };

            Questions.findOne(query, (err, result) => {
                if (err) {
                    console.log(`[${context}][findOne] Error `, err.message);
                    reject(err);
                }
                else {
                    if (result) {
                        result.modifyUser = user;
                        result.active = false;

                        var newValues = { $set: result };
                        Questions.updateQuestions(query, newValues, (err, result) => {
                            if (err) {
                                console.log(`[${context}][updateQuestions] Error `, err.message);
                                reject(err);
                            }
                            else {
                                if (Object.keys(result).length != 0)
                                    resolve({ auth: true, code: 'server_question_disabled', message: "Question has been disabled" });
                                else
                                    reject({ auth: false, code: 'server_question_not_disabled', message: "Question has not been disabled" });
                            };
                        });
                    }
                    else {
                        reject({ auth: false, code: 'server_no_questions_found', message: "Questions not found for given parameters" })
                    };
                };
            });

        });
    },
    getQuestionsIssues: function (req) {
        let context = "Funciton getQuestionsIssues";
        return new Promise((resolve, reject) => {

            let query = req.body;

            Questions.findOne(query, (err, result) => {
                if (err) {
                    console.log(`[${context}][find] Error `, err.message);
                    reject(err);
                };

                resolve(result);

            });

        });
    }
}


//========== FUNCTION ==========
//Function to validate fields received 
function validateFields(question) {
    return new Promise((resolve, reject) => {
        if (!question.questionCode)
            reject({ auth: false, code: 'server_question_required', message: "Question data required" });
        else if (!question.type)
            reject({ auth: false, code: 'server_question_type_required', message: "Question type required" });
        else
            resolve(true);
    });
};

async function getLanguage(language) {
    let context = "Funciton getLanguage";
   try {
        return await retrieveFileTranslationByLanguage({language});
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return null;
    }
};

function translateQuestions(translations, result) {
    let context = "Funciton getLanguage";
    return new Promise((resolve, reject) => {
        result.forEach(question => {
            question.questionCode = translations[question.questionCode] || question.questionCode;

            question.answers.forEach(answer => {
                answer.answer = translations[answer.answer] || answer.answer;
            });
        });

        resolve(result);
    });
};
