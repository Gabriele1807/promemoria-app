import { riconcilia } from '../promemoria/pianificatore';
import type { Lingua } from '../storage/modello';
import { leggiLingua, salvaLingua } from '../storage/impostazioni';
import i18n, { impostaDocumento } from './index';

// All'avvio, prima di mostrare la pagina: applica la lingua salvata (italiano se non c'è nulla).
export async function caricaLinguaSalvata(): Promise<void> {
  let lingua: Lingua = 'it';
  try {
    lingua = await leggiLingua();
  } catch {
    // memoria non leggibile: si parte in italiano
  }
  await i18n.changeLanguage(lingua);
  impostaDocumento(lingua); // anche se la lingua non cambia, lang e dir vanno impostati
}

// Cambia lingua e la ricorda. I testi di notifiche e sveglie si fissano quando vengono programmate,
// quindi si riconcilia: vengono riprogrammate con i testi nella nuova lingua.
export async function cambiaLingua(lingua: Lingua): Promise<void> {
  await i18n.changeLanguage(lingua);
  await salvaLingua(lingua);
  await riconcilia();
}
