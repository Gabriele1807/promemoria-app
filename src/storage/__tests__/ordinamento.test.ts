import { describe, expect, it } from 'vitest';
import type { Appuntamento } from '../modello';
import { dataLocale, orarioPromemoria, ordina } from '../ordinamento';

function app(parziale: Partial<Appuntamento>): Appuntamento {
  return {
    id: 'x', numId: 1, titolo: 'A', data: '2026-10-10', ora: '09:00',
    note: '', tipo: 'notifica', anticipoMinuti: 0, ...parziale,
  };
}

describe('ordina', () => {
  it('ordina per ora nello stesso giorno', () => {
    const r = ordina([app({ id: 'b', ora: '14:30' }), app({ id: 'a', ora: '08:05' }), app({ id: 'c', ora: '09:00' })]);
    expect(r.map((a) => a.id)).toEqual(['a', 'c', 'b']);
  });

  it('ordina prima per data e poi per ora', () => {
    const r = ordina([
      app({ id: 'domani', data: '2026-10-11', ora: '07:00' }),
      app({ id: 'oggi', data: '2026-10-10', ora: '20:00' }),
    ]);
    expect(r.map((a) => a.id)).toEqual(['oggi', 'domani']);
  });

  it('a pari ora ordina per titolo', () => {
    const r = ordina([app({ id: '2', titolo: 'Zia' }), app({ id: '1', titolo: 'Medico' })]);
    expect(r.map((a) => a.id)).toEqual(['1', '2']);
  });

  it('non modifica l\'array originale', () => {
    const originale = [app({ id: 'b', ora: '10:00' }), app({ id: 'a', ora: '08:00' })];
    ordina(originale);
    expect(originale.map((a) => a.id)).toEqual(['b', 'a']);
  });
});

describe('dataLocale', () => {
  it('formatta YYYY-MM-DD con zeri iniziali, in ora locale', () => {
    expect(dataLocale(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('orarioPromemoria', () => {
  it('toglie i minuti di anticipo', () => {
    expect(orarioPromemoria({ data: '2026-10-10', ora: '10:00', anticipoMinuti: 30 })).toEqual(new Date(2026, 9, 10, 9, 30));
  });

  it('un\'ora di anticipo a cavallo di mezzanotte porta al giorno prima', () => {
    expect(orarioPromemoria({ data: '2026-10-11', ora: '00:30', anticipoMinuti: 60 })).toEqual(new Date(2026, 9, 10, 23, 30));
  });

  it('senza anticipo coincide con l\'ora dell\'appuntamento', () => {
    expect(orarioPromemoria({ data: '2026-03-29', ora: '08:05', anticipoMinuti: 0 })).toEqual(new Date(2026, 2, 29, 8, 5));
  });
});
