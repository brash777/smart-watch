import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import es from './locales/es.json';

/*
 * Every text the user sees lives in locales/es.json and is read with t('key'). The keys are
 * typed (i18next.d.ts), so a missing key fails the typecheck.
 */

export const resources = { es: { translation: es } } as const;

void i18next.use(initReactI18next).init({
  lng: 'es',
  fallbackLng: 'es',
  resources,
  // The resources are bundled, so i18n is ready before the first render.
  initAsync: false,
  interpolation: { escapeValue: false },
});

export { i18next };
