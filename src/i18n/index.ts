import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { Lingua } from '../storage/modello';
import ar from './ar.json';
import it from './it.json';

// Italiano predefinito; arabo da destra a sinistra (RTL).
void i18n.use(initReactI18next).init({
  resources: {
    it: { translation: it },
    ar: { translation: ar },
  },
  lng: 'it',
  fallbackLng: 'it',
  interpolation: { escapeValue: false }, // React fa già l'escape
});

export function linguaCorrente(): Lingua {
  return i18n.language === 'ar' ? 'ar' : 'it';
}

// Imposta lingua e direzione del documento: con l'arabo tutto si specchia (RTL).
export function impostaDocumento(lingua: Lingua): void {
  if (typeof document === 'undefined') return; // nei test non c'è una pagina
  document.documentElement.lang = lingua;
  document.documentElement.dir = lingua === 'ar' ? 'rtl' : 'ltr';
}

i18n.on('languageChanged', (lng) => impostaDocumento(lng === 'ar' ? 'ar' : 'it'));

export default i18n;
