import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Memoria finta (Preferences) e notifiche finte: nessun telefono necessario.
const { memoria, stato } = vi.hoisted(() => ({
  memoria: new Map<string, string>(),
  stato: {
    permesso: 'concesso' as 'concesso' | 'negato' | 'da-chiedere',
    permessoDopoRichiesta: 'concesso' as 'concesso' | 'negato',
    richieste: 0,
    pendenti: new Map<number, { titolo: string; corpo: string; quando: Date }>(),
    errore: false,
    // Sveglie finte (al posto del plugin Kotlin).
    sveglie: new Map<number, { quando: number; titolo: string; testi: Record<string, string> }>(),
    chiamateAnnullaSveglia: 0,
    allarmiNegati: false,
    erroreSveglia: false,
  },
}));

vi.mock('../sveglia', () => ({
  ERRORE_ALLARMI_NON_CONSENTITI: 'ALLARMI_NON_CONSENTITI',
  programma: async (d: { id: number; quando: number; titolo: string; testi: Record<string, string> }) => {
    if (stato.allarmiNegati) throw Object.assign(new Error('non consentiti'), { code: 'ALLARMI_NON_CONSENTITI' });
    if (stato.erroreSveglia) throw new Error('plugin non disponibile');
    stato.sveglie.set(d.id, { quando: d.quando, titolo: d.titolo, testi: d.testi });
  },
  annulla: async (id: number) => {
    stato.chiamateAnnullaSveglia++;
    stato.sveglie.delete(id);
  },
  elenca: async () => [...stato.sveglie.keys()],
}));

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: memoria.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => void memoria.set(key, value),
    remove: async ({ key }: { key: string }) => void memoria.delete(key),
  },
}));

vi.mock('../notifiche', () => ({
  statoPermesso: async () => stato.permesso,
  chiediPermesso: async () => {
    stato.richieste++;
    stato.permesso = stato.permessoDopoRichiesta;
    return stato.permesso;
  },
  creaCanale: async () => {},
  programma: async (n: { id: number; titolo: string; corpo: string; quando: Date }) => {
    if (stato.errore) throw new Error('plugin non disponibile');
    stato.pendenti.set(n.id, { titolo: n.titolo, corpo: n.corpo, quando: n.quando });
  },
  annulla: async (id: number) => void stato.pendenti.delete(id),
  elencaPendenti: async () => [...stato.pendenti.keys()],
}));

import {
  creaAppuntamento,
  eliminaAppuntamento,
  modificaAppuntamento,
  riconcilia,
} from '../pianificatore';
import i18n from '../../i18n';
import { leggiTutti } from '../../storage/appuntamenti';
import type { NuovoAppuntamento } from '../../storage/modello';

// "Adesso" nei test: 10 ottobre 2026, ore 08:00 (ora locale).
const ADESSO = new Date(2026, 9, 10, 8, 0);

const base: NuovoAppuntamento = {
  titolo: 'Medico',
  data: '2026-10-10',
  ora: '10:00',
  note: '',
  tipo: 'notifica',
  anticipoMinuti: 30,
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(ADESSO);
  memoria.clear();
  stato.permesso = 'concesso';
  stato.permessoDopoRichiesta = 'concesso';
  stato.richieste = 0;
  stato.pendenti.clear();
  stato.errore = false;
  stato.sveglie.clear();
  stato.chiamateAnnullaSveglia = 0;
  stato.allarmiNegati = false;
  stato.erroreSveglia = false;
});

afterEach(() => vi.useRealTimers());

describe('salvataggio', () => {
  it('"notifica" programma una notifica all\'orario meno l\'anticipo, con id = numId', async () => {
    const { appuntamento, notifica } = await creaAppuntamento(base);
    expect(notifica).toBe('programmata');
    const programmata = stato.pendenti.get(appuntamento.numId);
    expect(programmata?.quando).toEqual(new Date(2026, 9, 10, 9, 30));
    expect(programmata?.titolo).toBe('Medico');
  });

  it('"entrambi" programma la notifica', async () => {
    const { notifica } = await creaAppuntamento({ ...base, tipo: 'entrambi' });
    expect(notifica).toBe('programmata');
    expect(stato.pendenti.size).toBe(1);
  });

  it('"sveglia" non programma nessuna notifica', async () => {
    const { notifica } = await creaAppuntamento({ ...base, tipo: 'sveglia' });
    expect(notifica).toBe('non-richiesta');
    expect(stato.pendenti.size).toBe(0);
  });

  it('con anticipo zero, il testo indica l\'ora; le note vengono aggiunte', async () => {
    const { appuntamento } = await creaAppuntamento({ ...base, anticipoMinuti: 0, note: 'Portare la tessera' });
    const corpo = stato.pendenti.get(appuntamento.numId)?.corpo;
    expect(corpo).toContain('10:00');
    expect(corpo).toContain('Portare la tessera');
  });

  it('orario già passato: non programma e lo segnala', async () => {
    const { notifica } = await creaAppuntamento({ ...base, ora: '08:15', anticipoMinuti: 30 });
    expect(notifica).toBe('orario-passato');
    expect(stato.pendenti.size).toBe(0);
  });

  it('se il plugin fallisce, l\'appuntamento resta salvato', async () => {
    stato.errore = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { notifica } = await creaAppuntamento(base);
    expect(notifica).toBe('errore');
    expect(await leggiTutti()).toHaveLength(1);
  });
});

describe('permessi', () => {
  it('se il permesso è da chiedere lo chiede e poi programma', async () => {
    stato.permesso = 'da-chiedere';
    const { notifica } = await creaAppuntamento(base);
    expect(stato.richieste).toBe(1);
    expect(notifica).toBe('programmata');
  });

  it('se l\'utente rifiuta: nessuna notifica, ma l\'appuntamento è salvato', async () => {
    stato.permesso = 'da-chiedere';
    stato.permessoDopoRichiesta = 'negato';
    const { notifica } = await creaAppuntamento(base);
    expect(notifica).toBe('permesso-negato');
    expect(stato.pendenti.size).toBe(0);
    expect(await leggiTutti()).toHaveLength(1);
  });

  it('se è già negato non rifà la richiesta', async () => {
    stato.permesso = 'negato';
    const { notifica } = await creaAppuntamento(base);
    expect(notifica).toBe('permesso-negato');
    expect(stato.richieste).toBe(0);
  });
});

describe('modifica', () => {
  it('cambiando l\'orario resta una sola notifica, con il nuovo orario', async () => {
    const { appuntamento } = await creaAppuntamento(base);
    await modificaAppuntamento(appuntamento.id, { ...base, ora: '12:00' });
    expect(stato.pendenti.size).toBe(1);
    expect(stato.pendenti.get(appuntamento.numId)?.quando).toEqual(new Date(2026, 9, 10, 11, 30));
  });

  it('da "notifica" a "sveglia" cancella la notifica', async () => {
    const { appuntamento } = await creaAppuntamento(base);
    await modificaAppuntamento(appuntamento.id, { ...base, tipo: 'sveglia' });
    expect(stato.pendenti.size).toBe(0);
  });

  it('da "sveglia" a "entrambi" programma la notifica', async () => {
    const { appuntamento } = await creaAppuntamento({ ...base, tipo: 'sveglia' });
    await modificaAppuntamento(appuntamento.id, { ...base, tipo: 'entrambi' });
    expect(stato.pendenti.has(appuntamento.numId)).toBe(true);
  });

  it('cambiando il titolo la notifica mostra il nuovo titolo', async () => {
    const { appuntamento } = await creaAppuntamento(base);
    await modificaAppuntamento(appuntamento.id, { ...base, titolo: 'Dentista' });
    expect(stato.pendenti.get(appuntamento.numId)?.titolo).toBe('Dentista');
  });
});

describe('eliminazione', () => {
  it('cancella la notifica e il record, senza toccare gli altri', async () => {
    const a = (await creaAppuntamento(base)).appuntamento;
    const b = (await creaAppuntamento({ ...base, titolo: 'Altro' })).appuntamento;
    await eliminaAppuntamento(a);
    expect([...stato.pendenti.keys()]).toEqual([b.numId]);
    expect((await leggiTutti()).map((x) => x.id)).toEqual([b.id]);
  });
});

describe('riconcilia', () => {
  it('toglie le notifiche senza appuntamento', async () => {
    stato.pendenti.set(999, { titolo: 'Fantasma', corpo: '', quando: new Date(2026, 9, 10, 9) });
    await riconcilia();
    expect(stato.pendenti.has(999)).toBe(false);
  });

  it('riprogramma le notifiche mancanti', async () => {
    const { appuntamento } = await creaAppuntamento(base);
    stato.pendenti.clear(); // es. arresto forzato dell'app
    await riconcilia();
    expect(stato.pendenti.has(appuntamento.numId)).toBe(true);
  });

  it('non chiede mai il permesso', async () => {
    await creaAppuntamento(base);
    stato.pendenti.clear();
    stato.permesso = 'da-chiedere';
    await riconcilia();
    expect(stato.richieste).toBe(0);
    expect(stato.pendenti.size).toBe(0);
  });

  it('dopo la concessione del permesso programma le notifiche già salvate', async () => {
    stato.permesso = 'negato';
    const { appuntamento } = await creaAppuntamento(base);
    stato.permesso = 'concesso';
    await riconcilia();
    expect(stato.pendenti.has(appuntamento.numId)).toBe(true);
  });
});

describe('sveglia', () => {
  it('"sveglia" programma l\'allarme (id = numId, orario meno anticipo) e non la notifica', async () => {
    const { appuntamento, sveglia, notifica } = await creaAppuntamento({ ...base, tipo: 'sveglia' });
    expect(sveglia).toBe('programmata');
    expect(notifica).toBe('non-richiesta');
    expect(stato.pendenti.size).toBe(0);
    expect(stato.sveglie.get(appuntamento.numId)?.quando).toBe(new Date(2026, 9, 10, 9, 30).getTime());
    expect(stato.sveglie.get(appuntamento.numId)?.titolo).toBe('Medico');
  });

  it('passa al plugin i testi tradotti', async () => {
    const { appuntamento } = await creaAppuntamento({ ...base, tipo: 'sveglia' });
    expect(stato.sveglie.get(appuntamento.numId)?.testi).toEqual({
      fatto: 'Fatto',
      rimanda: 'Rimanda 10 minuti',
      canale: 'Sveglie',
      canaleDescrizione: 'Sveglie dei tuoi appuntamenti',
      nonSpenta: 'Sveglia non spenta',
    });
  });

  it('"entrambi" programma sia la notifica sia la sveglia', async () => {
    const { appuntamento, notifica, sveglia } = await creaAppuntamento({ ...base, tipo: 'entrambi' });
    expect(notifica).toBe('programmata');
    expect(sveglia).toBe('programmata');
    expect(stato.pendenti.has(appuntamento.numId)).toBe(true);
    expect(stato.sveglie.has(appuntamento.numId)).toBe(true);
  });

  it('"notifica" non programma nessuna sveglia', async () => {
    const { sveglia } = await creaAppuntamento(base);
    expect(sveglia).toBe('non-richiesta');
    expect(stato.sveglie.size).toBe(0);
  });

  it('cambiando orario la sveglia viene sostituita (una sola, con l\'orario nuovo)', async () => {
    const { appuntamento } = await creaAppuntamento({ ...base, tipo: 'sveglia' });
    await modificaAppuntamento(appuntamento.id, { ...base, tipo: 'sveglia', ora: '12:00' });
    expect(stato.sveglie.size).toBe(1);
    expect(stato.sveglie.get(appuntamento.numId)?.quando).toBe(new Date(2026, 9, 10, 11, 30).getTime());
  });

  it('da "sveglia" a "notifica" cancella la sveglia e programma la notifica', async () => {
    const { appuntamento } = await creaAppuntamento({ ...base, tipo: 'sveglia' });
    await modificaAppuntamento(appuntamento.id, { ...base, tipo: 'notifica' });
    expect(stato.sveglie.size).toBe(0);
    expect(stato.pendenti.has(appuntamento.numId)).toBe(true);
  });

  it('da "notifica" a "entrambi" aggiunge la sveglia', async () => {
    const { appuntamento } = await creaAppuntamento(base);
    await modificaAppuntamento(appuntamento.id, { ...base, tipo: 'entrambi' });
    expect(stato.sveglie.has(appuntamento.numId)).toBe(true);
    expect(stato.pendenti.has(appuntamento.numId)).toBe(true);
  });

  it('l\'eliminazione cancella notifica e sveglia, senza toccare le altre', async () => {
    const a = (await creaAppuntamento({ ...base, tipo: 'entrambi' })).appuntamento;
    const b = (await creaAppuntamento({ ...base, tipo: 'entrambi', titolo: 'Altro' })).appuntamento;
    await eliminaAppuntamento(a);
    expect([...stato.pendenti.keys()]).toEqual([b.numId]);
    expect([...stato.sveglie.keys()]).toEqual([b.numId]);
  });

  it('orario già passato: non programma la sveglia e lo segnala', async () => {
    const { sveglia } = await creaAppuntamento({ ...base, tipo: 'sveglia', ora: '08:15' });
    expect(sveglia).toBe('orario-passato');
    expect(stato.sveglie.size).toBe(0);
  });

  it('allarmi esatti non consentiti: lo segnala e l\'appuntamento resta salvato', async () => {
    stato.allarmiNegati = true;
    const { sveglia } = await creaAppuntamento({ ...base, tipo: 'sveglia' });
    expect(sveglia).toBe('allarmi-non-consentiti');
    expect(await leggiTutti()).toHaveLength(1);
  });

  it('errore generico del plugin: segnala "errore" e l\'appuntamento resta salvato', async () => {
    stato.erroreSveglia = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { sveglia } = await creaAppuntamento({ ...base, tipo: 'sveglia' });
    expect(sveglia).toBe('errore');
    expect(await leggiTutti()).toHaveLength(1);
  });

  it('un errore della sveglia non impedisce di programmare la notifica ("entrambi")', async () => {
    stato.erroreSveglia = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { appuntamento, notifica } = await creaAppuntamento({ ...base, tipo: 'entrambi' });
    expect(notifica).toBe('programmata');
    expect(stato.pendenti.has(appuntamento.numId)).toBe(true);
  });
});

describe('riconcilia (sveglie)', () => {
  const testi = { fatto: 'x', rimanda: 'x', canale: 'x', canaleDescrizione: 'x', nonSpenta: 'x' };

  it('toglie le sveglie senza appuntamento', async () => {
    stato.sveglie.set(999, { quando: 1, titolo: 'Fantasma', testi });
    await riconcilia();
    expect(stato.sveglie.has(999)).toBe(false);
  });

  it('toglie la sveglia di un appuntamento che non è più "sveglia" o "entrambi"', async () => {
    const { appuntamento } = await creaAppuntamento(base); // solo notifica
    stato.sveglie.set(appuntamento.numId, { quando: 1, titolo: 'Vecchia', testi });
    await riconcilia();
    expect(stato.sveglie.has(appuntamento.numId)).toBe(false);
  });

  it('riprogramma le sveglie mancanti', async () => {
    const { appuntamento } = await creaAppuntamento({ ...base, tipo: 'sveglia' });
    stato.sveglie.clear(); // es. arresto forzato dell'app
    await riconcilia();
    expect(stato.sveglie.has(appuntamento.numId)).toBe(true);
  });

  it('NON annulla una sveglia rimandata: se l\'orario originale è passato non la tocca', async () => {
    const { appuntamento } = await creaAppuntamento({ ...base, tipo: 'sveglia' });
    // Passa l'orario della sveglia (09:30) e l'utente preme "Rimanda 10 minuti": il telefono la conserva.
    vi.setSystemTime(new Date(2026, 9, 10, 9, 31));
    stato.chiamateAnnullaSveglia = 0;
    await riconcilia();
    expect(stato.chiamateAnnullaSveglia).toBe(0);
    expect(stato.sveglie.has(appuntamento.numId)).toBe(true);
  });

  it('con "entrambi", dopo l\'orario riconcilia non cancella la sveglia rimandata', async () => {
    const { appuntamento } = await creaAppuntamento({ ...base, tipo: 'entrambi' });
    vi.setSystemTime(new Date(2026, 9, 10, 9, 31));
    await riconcilia();
    expect(stato.sveglie.has(appuntamento.numId)).toBe(true);
  });
});

describe('lingua', () => {
  afterEach(async () => {
    await i18n.changeLanguage('it');
  });

  it('con l\'arabo, sveglia e notifica ricevono i testi in arabo', async () => {
    await i18n.changeLanguage('ar');
    const { appuntamento } = await creaAppuntamento({ ...base, tipo: 'entrambi' });
    const s = stato.sveglie.get(appuntamento.numId);
    expect(s?.testi.fatto).toBe('تم');
    expect(s?.testi.rimanda).toBe('تأجيل 10 دقائق');
    expect(stato.pendenti.get(appuntamento.numId)?.corpo).toMatch(/[؀-ۿ]/);
  });

  it('riconcilia dopo il cambio lingua riprogramma sveglia e notifica con i nuovi testi', async () => {
    const { appuntamento } = await creaAppuntamento({ ...base, tipo: 'entrambi' });
    expect(stato.sveglie.get(appuntamento.numId)?.testi.fatto).toBe('Fatto');
    await i18n.changeLanguage('ar');
    await riconcilia();
    expect(stato.sveglie.get(appuntamento.numId)?.testi.fatto).toBe('تم');
    expect(stato.pendenti.get(appuntamento.numId)?.corpo).toMatch(/[؀-ۿ]/);
  });
});
