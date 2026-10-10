import { beforeEach, describe, expect, it, vi } from 'vitest';

const memoria = new Map<string, string>();
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: memoria.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => void memoria.set(key, value),
    remove: async ({ key }: { key: string }) => void memoria.delete(key),
  },
}));

import { leggiLingua, salvaLingua } from '../impostazioni';

beforeEach(() => memoria.clear());

describe('lingua', () => {
  it('senza nulla di salvato è l\'italiano', async () => {
    expect(await leggiLingua()).toBe('it');
  });

  it('ricorda l\'arabo e poi l\'italiano', async () => {
    await salvaLingua('ar');
    expect(await leggiLingua()).toBe('ar');
    await salvaLingua('it');
    expect(await leggiLingua()).toBe('it');
  });

  it('un valore sconosciuto vale italiano', async () => {
    memoria.set('lingua', 'fr');
    expect(await leggiLingua()).toBe('it');
  });
});
