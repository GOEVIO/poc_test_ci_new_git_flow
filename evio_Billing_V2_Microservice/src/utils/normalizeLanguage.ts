export function normalizeLanguage(lang: string): 'PT' | 'EN' | 'ES' | 'FR' {
  const normalized = lang.toLowerCase();

  if (['pt', 'pt_pt'].includes(normalized)) return 'PT';
  if (['en', 'en_gb', 'en_us'].includes(normalized)) return 'EN';
  if (['es', 'es_es'].includes(normalized)) return 'ES';
  if (['fr', 'fr_fr'].includes(normalized)) return 'FR';

  return 'PT';
}
