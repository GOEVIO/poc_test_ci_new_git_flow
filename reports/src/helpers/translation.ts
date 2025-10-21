import { FileTransaction } from 'evio-library-language';

const keys = {
  MONTHLY_REPORT: '{{MONTHLY_REPORT}}',
  GROUPED_BY: '{{GROUPED_BY}}',
  TIME_PERIOD: '{{TIME_PERIOD}}',
  TOTAL: '{{TOTAL}}',
  SESSIONS: '{{SESSIONS}}',
  ENERGY: '{{ENERGY}}',
  CHARGING_TIME: '{{CHARGING_TIME}}',
  COST_EXCL_VAT: '{{COST_EXCL_VAT}}',
  LOCATION: '{{LOCATION}}',
  APT: '{{APT}}',
  CHARGER: '{{CHARGER}}',
  DATE: '{{DATE}}',
  DURATION: '{{DURATION}}',
  CHARGING_STATION: '{{CHARGING_STATION}}',
  NETWORK: '{{NETWORK}}',
  TOTAL_EXCL_VAT: '{{TOTAL_EXCL_VAT}}',
  EMAIL_REPORT_IS_READY_SUBJECT: '{{EMAIL_REPORT_IS_READY_SUBJECT}}',
};

export async function translate(
  language: string,
): Promise<Record<string, string>> {
  const translationFile =
    await FileTransaction.retrieveFileTranslationByLanguage({
      language,
      project: 'evio',
      component: 'shared',
    });
  Object.keys(keys).forEach((key) => {
    if (translationFile[key]) {
      keys[key] = translationFile[key];
    }
  });
  return keys;
}
