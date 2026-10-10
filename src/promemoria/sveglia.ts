import { Capacitor, registerPlugin } from '@capacitor/core';

// Unico file che parla con il plugin nativo "Sveglia" (Kotlin, in android/.../sveglia/).
// Nel browser la sveglia non si può provare: qui tutto è un'operazione vuota e i permessi
// risultano concessi (non c'è nulla da chiedere).

// Testi già tradotti: il lato Android li conserva e li usa anche dopo un riavvio.
export interface TestiSveglia {
  fatto: string;
  rimanda: string;
  canale: string;
  canaleDescrizione: string;
  nonSpenta: string;
}

export interface DatiSveglia {
  id: number; // numId dell'appuntamento
  quando: number; // millisecondi dal 1970
  titolo: string;
  testi: TestiSveglia;
}

export interface StatoPermessiSveglia {
  allarmiEsatti: boolean;
  schermoIntero: boolean;
  batteria: boolean; // true se l'app è già esclusa dal risparmio batteria
}

interface SvegliaPlugin {
  programma(dati: DatiSveglia): Promise<void>;
  annulla(dati: { id: number }): Promise<void>;
  elenco(): Promise<{ ids: number[] }>;
  statoPermessi(): Promise<StatoPermessiSveglia>;
  apriImpostazioniSchermoIntero(): Promise<void>;
  apriImpostazioniAllarmi(): Promise<void>;
  apriImpostazioniBatteria(): Promise<{ aperto: boolean }>;
  apriImpostazioniApp(): Promise<void>;
}

const Sveglia = registerPlugin<SvegliaPlugin>('Sveglia');

// Codice dell'errore che il plugin restituisce quando Android non consente gli allarmi esatti.
export const ERRORE_ALLARMI_NON_CONSENTITI = 'ALLARMI_NON_CONSENTITI';

const nativo = () => Capacitor.isNativePlatform();

// Programma la sveglia o, se esiste già con lo stesso id, la sostituisce.
// Con gli stessi dati di prima il plugin conserva un eventuale "Rimanda 10 minuti".
export async function programma(dati: DatiSveglia): Promise<void> {
  if (!nativo()) return;
  await Sveglia.programma(dati);
}

// Se la sveglia non esiste non succede nulla.
export async function annulla(id: number): Promise<void> {
  if (!nativo()) return;
  await Sveglia.annulla({ id });
}

// Id delle sveglie conservate dal telefono.
export async function elenca(): Promise<number[]> {
  if (!nativo()) return [];
  return (await Sveglia.elenco()).ids;
}

export async function statoPermessi(): Promise<StatoPermessiSveglia> {
  if (!nativo()) return { allarmiEsatti: true, schermoIntero: true, batteria: true };
  return Sveglia.statoPermessi();
}

// true se la pagina si è aperta, false se questo telefono non ce l'ha (l'app mostra allora un messaggio).
export async function apriImpostazioniBatteria(): Promise<boolean> {
  if (!nativo()) return true;
  return (await Sveglia.apriImpostazioniBatteria()).aperto;
}

export async function apriImpostazioniApp(): Promise<void> {
  if (nativo()) await Sveglia.apriImpostazioniApp();
}

export async function apriImpostazioniSchermoIntero(): Promise<void> {
  if (nativo()) await Sveglia.apriImpostazioniSchermoIntero();
}

export async function apriImpostazioniAllarmi(): Promise<void> {
  if (nativo()) await Sveglia.apriImpostazioniAllarmi();
}
