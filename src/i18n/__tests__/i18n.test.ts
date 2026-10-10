import { describe, expect, it } from 'vitest';
import ar from '../ar.json';
import { formattaData, formattaOra } from '../formatoData';
import it_ from '../it.json';

// "oggi.titolo" → testo, per tutte le foglie del file.
function appiattisci(oggetto: object, prefisso = ''): Record<string, string> {
  const risultato: Record<string, string> = {};
  for (const [chiave, valore] of Object.entries(oggetto)) {
    const percorso = prefisso ? `${prefisso}.${chiave}` : chiave;
    if (typeof valore === 'string') risultato[percorso] = valore;
    else Object.assign(risultato, appiattisci(valore as object, percorso));
  }
  return risultato;
}

const italiano = appiattisci(it_);
const arabo = appiattisci(ar);

const segnaposto = (testo: string) => [...testo.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

describe('traduzioni', () => {
  it('italiano e arabo hanno esattamente le stesse chiavi', () => {
    expect(Object.keys(arabo).sort()).toEqual(Object.keys(italiano).sort());
  });

  it('nessun testo è vuoto', () => {
    for (const [chiave, testo] of [...Object.entries(italiano), ...Object.entries(arabo)]) {
      expect(testo.trim(), chiave).not.toBe('');
    }
  });

  it('i segnaposto {{...}} sono gli stessi nelle due lingue', () => {
    for (const chiave of Object.keys(italiano)) {
      expect(segnaposto(arabo[chiave] ?? ''), chiave).toEqual(segnaposto(italiano[chiave]));
    }
  });

  it('i testi arabi sono davvero in arabo (tranne il pulsante della lingua e il nome dell\'app)', () => {
    const eccezioni = new Set(['app.nome', 'lingua.cambia']);
    for (const [chiave, testo] of Object.entries(arabo)) {
      if (!eccezioni.has(chiave)) expect(/[؀-ۿ]/.test(testo), chiave).toBe(true);
    }
  });

  it('ogni chiave usata nel codice con t(\'...\') esiste', () => {
    const file = import.meta.glob('../../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const usate = new Set<string>();
    for (const [percorso, codice] of Object.entries(file)) {
      if (percorso.includes('__tests__')) continue;
      for (const m of codice.matchAll(/\bt\('([\w.]+)'/g)) usate.add(m[1]);
    }
    expect(usate.size).toBeGreaterThan(10); // la ricerca funziona davvero
    for (const chiave of usate) expect(italiano, chiave).toHaveProperty([chiave]);
  });

  it('le chiavi composte (tipo.*, anticipo.*, notifiche.quanto.*) coprono tutti i valori possibili', () => {
    for (const tipo of ['notifica', 'sveglia', 'entrambi']) expect(italiano).toHaveProperty([`tipo.${tipo}`]);
    for (const min of [0, 15, 30, 60, 120]) expect(italiano).toHaveProperty([`anticipo.${min}`]);
    for (const min of [15, 30, 60, 120]) expect(italiano).toHaveProperty([`notifiche.quanto.${min}`]);
    for (const p of ['notifiche', 'allarmi', 'schermoIntero']) expect(italiano).toHaveProperty([`impostazioni.permessi.${p}`]);
  });
});

describe('formatoData', () => {
  it('data in italiano', () => {
    expect(formattaData('2026-10-10', 'it')).toBe('sabato 10 ottobre 2026');
  });

  it('data in arabo contiene il mese in arabo', () => {
    expect(formattaData('2026-10-10', 'ar')).toContain('أكتوبر');
  });

  it('ora a 24 ore con zeri iniziali in italiano', () => {
    expect(formattaOra('09:05', 'it')).toBe('09:05');
    expect(formattaOra('23:30', 'it')).toBe('23:30');
  });

  it('ora in arabo: sempre a 24 ore, senza indicazioni AM/PM', () => {
    const ora = formattaOra('15:20', 'ar');
    expect(ora).not.toMatch(/[AP]M|ص|م$/);
    expect(ora.length).toBeGreaterThanOrEqual(5);
  });
});
