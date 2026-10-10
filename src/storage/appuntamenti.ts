import { Preferences } from '@capacitor/preferences';
import type { Appuntamento, NuovoAppuntamento } from './modello';
import { ordina } from './ordinamento';

const CHIAVE_LISTA = 'appuntamenti.v1';
const CHIAVE_CORROTTO = 'appuntamenti.corrotto';
const CHIAVE_CONTATORE = 'contatoreNumId';

// Le operazioni di scrittura vanno in coda: due salvataggi ravvicinati
// non devono leggere lo stesso stato e sovrascriversi a vicenda.
let coda: Promise<unknown> = Promise.resolve();
function inCoda<T>(operazione: () => Promise<T>): Promise<T> {
  const risultato = coda.then(operazione, operazione);
  coda = risultato.catch(() => undefined);
  return risultato;
}

async function leggiLista(): Promise<Appuntamento[]> {
  const { value } = await Preferences.get({ key: CHIAVE_LISTA });
  if (value === null) return [];
  try {
    const dati: unknown = JSON.parse(value);
    if (Array.isArray(dati)) return dati as Appuntamento[];
    throw new Error('Formato non valido');
  } catch {
    // Dati rovinati: li metto da parte invece di cancellarli e riparto da una lista vuota.
    await Preferences.set({ key: CHIAVE_CORROTTO, value });
    await Preferences.remove({ key: CHIAVE_LISTA });
    return [];
  }
}

async function scriviLista(lista: Appuntamento[]): Promise<void> {
  await Preferences.set({ key: CHIAVE_LISTA, value: JSON.stringify(lista) });
}

async function prossimoNumId(): Promise<number> {
  const { value } = await Preferences.get({ key: CHIAVE_CONTATORE });
  const numId = (value === null ? 0 : Number(value)) + 1;
  await Preferences.set({ key: CHIAVE_CONTATORE, value: String(numId) });
  return numId;
}

export async function leggiTutti(): Promise<Appuntamento[]> {
  return ordina(await leggiLista());
}

// Appuntamenti di un giorno (YYYY-MM-DD), ordinati per ora.
export async function leggiPerData(data: string): Promise<Appuntamento[]> {
  return ordina((await leggiLista()).filter((a) => a.data === data));
}

export async function leggiUno(id: string): Promise<Appuntamento | undefined> {
  return (await leggiLista()).find((a) => a.id === id);
}

export function creare(dati: NuovoAppuntamento): Promise<Appuntamento> {
  return inCoda(async () => {
    const lista = await leggiLista();
    const nuovo: Appuntamento = { ...dati, id: crypto.randomUUID(), numId: await prossimoNumId() };
    await scriviLista([...lista, nuovo]);
    return nuovo;
  });
}

// Sostituisce i dati dell'appuntamento con lo stesso id; id e numId non cambiano.
export function modificare(id: string, dati: NuovoAppuntamento): Promise<Appuntamento> {
  return inCoda(async () => {
    const lista = await leggiLista();
    const esistente = lista.find((a) => a.id === id);
    if (!esistente) throw new Error(`Appuntamento non trovato: ${id}`);
    const aggiornato: Appuntamento = { ...dati, id: esistente.id, numId: esistente.numId };
    await scriviLista(lista.map((a) => (a.id === id ? aggiornato : a)));
    return aggiornato;
  });
}

// Se l'appuntamento non esiste non fa nulla.
export function eliminare(id: string): Promise<void> {
  return inCoda(async () => {
    const lista = await leggiLista();
    await scriviLista(lista.filter((a) => a.id !== id));
  });
}
