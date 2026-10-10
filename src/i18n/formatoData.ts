import type { Lingua } from '../storage/modello';

const LOCALE: Record<Lingua, string> = { it: 'it-IT', ar: 'ar' };

// "2026-10-10" → "sabato 10 ottobre 2026" (o l'equivalente in arabo).
export function formattaData(data: string, lingua: Lingua): string {
  const [anno, mese, giorno] = data.split('-').map(Number);
  return new Intl.DateTimeFormat(LOCALE[lingua], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(anno, mese - 1, giorno));
}

// "09:05" → ora a 24 ore nella lingua scelta.
export function formattaOra(ora: string, lingua: Lingua): string {
  const [ore, minuti] = ora.split(':').map(Number);
  return new Intl.DateTimeFormat(LOCALE[lingua], {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(2000, 0, 1, ore, minuti));
}
