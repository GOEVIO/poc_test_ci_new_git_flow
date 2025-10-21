/* eslint-disable operator-linebreak */
const { FileTransaction } = require('evio-library-language').default;
const Constants = require('../utils/constants');
const { getUserByEmail } = require('./identityService');

async function getTranslations(languageCode) {
  const context = 'Function getTranslations';
  try {
    const translations =
      await FileTransaction.retrieveFileTranslationByLanguage({
        component: 'email',
        project: 'evio',
        language: languageCode,
      });

    return Object.entries(translations).map(([key, value]) => ({
      key,
      value,
    }));
  } catch (error) {
    console.error(
      `[${context}] Error retrieving translations: ${JSON.stringify(error)}`,
    );
    return null;
  }
}

async function getTranslationsAccordingToUser(
  userEmail,
  clientName,
  preferredLanguage,
) {
  const { supportEmail } = Constants.company.evio;

  let language = preferredLanguage || Constants.supportedLanguages.portuguese;
  const isSupportEVIO = userEmail === supportEmail;

  if (!isSupportEVIO) {
    const user = await getUserByEmail(userEmail, clientName);
    language = user ? user.language : Constants.supportedLanguages.english;
  }

  const translations = await getTranslations(language);

  return { translations, isSupportEVIO, language };
}

module.exports = { getTranslationsAccordingToUser };
