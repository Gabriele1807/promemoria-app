import { Preferences } from '@capacitor/preferences';
import type { Lingua } from './modello';

const CHIAVE_LINGUA = 'lingua';

// L'italiano è la lingua predefinita: vale anche se non c'è nulla di salvato o il valore è strano.
export async function leggiLingua(): Promise<Lingua> {
  const { value } = await Preferences.get({ key: CHIAVE_LINGUA });
  return value === 'ar' ? 'ar' : 'it';
}

export async function salvaLingua(lingua: Lingua): Promise<void> {
  await Preferences.set({ key: CHIAVE_LINGUA, value: lingua });
}
