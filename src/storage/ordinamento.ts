import type { Appuntamento } from './modello';

// Ordina per data, poi ora, poi titolo. Non modifica l'array ricevuto.
// Data e ora sono stringhe a lunghezza fissa (YYYY-MM-DD, HH:mm): il confronto di testo è corretto.
export function ordina(appuntamenti: Appuntamento[]): Appuntamento[] {
  return [...appuntamenti].sort(
    (a, b) =>
      a.data.localeCompare(b.data) || a.ora.localeCompare(b.ora) || a.titolo.localeCompare(b.titolo),
  );
}

// Istante del promemoria: data e ora dell'appuntamento meno i minuti di anticipo (ora locale).
export function orarioPromemoria(a: Pick<Appuntamento, 'data' | 'ora' | 'anticipoMinuti'>): Date {
  const [anno, mese, giorno] = a.data.split('-').map(Number);
  const [ore, minuti] = a.ora.split(':').map(Number);
  return new Date(anno, mese - 1, giorno, ore, minuti - a.anticipoMinuti);
}

// Data di oggi nel formato YYYY-MM-DD, in ora locale (non UTC).
export function dataLocale(d: Date = new Date()): string {
  const mese = String(d.getMonth() + 1).padStart(2, '0');
  const giorno = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mese}-${giorno}`;
}
