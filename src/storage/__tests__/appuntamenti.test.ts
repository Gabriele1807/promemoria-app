import { beforeEach, describe, expect, it, vi } from 'vitest';

// Preferences finto: una semplice mappa in memoria al posto della memoria del telefono.
const memoria = new Map<string, string>();
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: memoria.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => void memoria.set(key, value),
    remove: async ({ key }: { key: string }) => void memoria.delete(key),
  },
}));

import { creare, eliminare, leggiPerData, leggiTutti, leggiUno, modificare } from '../appuntamenti';
import type { NuovoAppuntamento } from '../modello';

const base: NuovoAppuntamento = {
  titolo: 'Medico', data: '2026-10-10', ora: '10:00', note: '',
  tipo: 'entrambi', anticipoMinuti: 30,
};

beforeEach(() => memoria.clear());

describe('creare', () => {
  it('salva l\'appuntamento con id e numId', async () => {
    const a = await creare(base);
    expect(a.id).toBeTruthy();
    expect(a.numId).toBe(1);
    expect(await leggiUno(a.id)).toEqual(a);
  });

  it('assegna numId progressivi e non li riusa dopo un\'eliminazione', async () => {
    const a = await creare(base);
    await eliminare(a.id);
    const b = await creare(base);
    expect(b.numId).toBe(2);
  });

  it('due salvataggi contemporanei non si sovrascrivono', async () => {
    await Promise.all([creare({ ...base, titolo: 'Uno' }), creare({ ...base, titolo: 'Due' })]);
    expect(await leggiTutti()).toHaveLength(2);
  });
});

describe('leggiPerData', () => {
  it('restituisce solo il giorno richiesto, ordinato per ora', async () => {
    await creare({ ...base, titolo: 'Sera', ora: '20:00' });
    await creare({ ...base, titolo: 'Mattina', ora: '08:00' });
    await creare({ ...base, titolo: 'Domani', data: '2026-10-11' });
    const oggi = await leggiPerData('2026-10-10');
    expect(oggi.map((a) => a.titolo)).toEqual(['Mattina', 'Sera']);
  });

  it('lista vuota se non c\'è nulla', async () => {
    expect(await leggiPerData('2026-10-10')).toEqual([]);
  });
});

describe('modificare', () => {
  it('cambia i dati ma mantiene id e numId', async () => {
    const a = await creare(base);
    const m = await modificare(a.id, { ...base, titolo: 'Dentista', tipo: 'sveglia' });
    expect(m).toMatchObject({ id: a.id, numId: a.numId, titolo: 'Dentista', tipo: 'sveglia' });
    expect(await leggiTutti()).toHaveLength(1);
  });

  it('errore se l\'appuntamento non esiste', async () => {
    await expect(modificare('inesistente', base)).rejects.toThrow();
  });
});

describe('eliminare', () => {
  it('rimuove solo l\'appuntamento indicato', async () => {
    const a = await creare(base);
    const b = await creare({ ...base, titolo: 'Altro' });
    await eliminare(a.id);
    expect((await leggiTutti()).map((x) => x.id)).toEqual([b.id]);
  });

  it('non fa nulla se l\'id non esiste', async () => {
    await creare(base);
    await eliminare('inesistente');
    expect(await leggiTutti()).toHaveLength(1);
  });
});

describe('dati corrotti', () => {
  it('riparte da lista vuota e conserva una copia dei dati rovinati', async () => {
    memoria.set('appuntamenti.v1', '{non è json');
    expect(await leggiTutti()).toEqual([]);
    expect(memoria.get('appuntamenti.corrotto')).toBe('{non è json');
  });
});
