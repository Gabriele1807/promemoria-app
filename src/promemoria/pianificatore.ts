import i18n, { linguaCorrente } from '../i18n';
import { formattaOra } from '../i18n/formatoData';
import { creare, eliminare, leggiTutti, modificare } from '../storage/appuntamenti';
import type { Appuntamento, NuovoAppuntamento } from '../storage/modello';
import { orarioPromemoria } from '../storage/ordinamento';
import * as notifiche from './notifiche';
import * as sveglia from './sveglia';

// Unico punto da cui l'app programma, aggiorna e cancella i promemoria (notifiche e sveglie).
// Le schermate chiamano solo queste funzioni, mai direttamente i plugin.

export type EsitoNotifica =
  | 'non-richiesta' // il tipo scelto non prevede la notifica
  | 'programmata'
  | 'permesso-negato'
  | 'orario-passato'
  | 'errore';

export type EsitoSveglia =
  | 'non-richiesta' // il tipo scelto non prevede la sveglia
  | 'programmata'
  | 'orario-passato'
  | 'allarmi-non-consentiti' // Android non permette gli allarmi esatti
  | 'errore';

export interface Esiti {
  notifica: EsitoNotifica;
  sveglia: EsitoSveglia;
}

export const vuoleNotifica = (a: Pick<Appuntamento, 'tipo'>) => a.tipo === 'notifica' || a.tipo === 'entrambi';
export const vuoleSveglia = (a: Pick<Appuntamento, 'tipo'>) => a.tipo === 'sveglia' || a.tipo === 'entrambi';

function corpoNotifica(a: Appuntamento): string {
  const t = i18n.t.bind(i18n);
  const ora = formattaOra(a.ora, linguaCorrente());
  const riga =
    a.anticipoMinuti === 0
      ? t('notifiche.corpoOra', { ora })
      : t('notifiche.corpoAnticipo', { quanto: t(`notifiche.quanto.${a.anticipoMinuti}`), ora });
  return a.note ? `${riga}\n${a.note}` : riga;
}

// Rende la notifica di questo appuntamento uguale a ciò che dice il record:
// prima toglie quella vecchia (se c'è), poi ne programma una nuova se serve.
// Chiamarla più volte dà sempre lo stesso risultato.
async function sincronizzaNotifica(
  a: Appuntamento,
  opzioni: { chiediPermesso: boolean },
): Promise<EsitoNotifica> {
  try {
    await notifiche.annulla(a.numId);
    if (!vuoleNotifica(a)) return 'non-richiesta';

    const quando = orarioPromemoria(a);
    if (quando.getTime() <= Date.now()) return 'orario-passato';

    let permesso = await notifiche.statoPermesso();
    if (permesso === 'da-chiedere' && opzioni.chiediPermesso) permesso = await notifiche.chiediPermesso();
    if (permesso !== 'concesso') return 'permesso-negato';

    await notifiche.creaCanale(i18n.t('notifiche.canale'), i18n.t('notifiche.canaleDescrizione'));
    await notifiche.programma({
      id: a.numId,
      titolo: a.titolo,
      corpo: corpoNotifica(a),
      quando,
      idAppuntamento: a.id,
    });
    return 'programmata';
  } catch (errore) {
    console.error('Notifica non programmata', errore);
    return 'errore';
  }
}

function testiSveglia(): sveglia.TestiSveglia {
  return {
    fatto: i18n.t('sveglia.fatto'),
    rimanda: i18n.t('sveglia.rimanda'),
    canale: i18n.t('sveglia.canale'),
    canaleDescrizione: i18n.t('sveglia.canaleDescrizione'),
    nonSpenta: i18n.t('sveglia.nonSpenta'),
  };
}

// Come sincronizzaNotifica, ma per la sveglia. Una differenza importante: se l'orario è già passato
// NON si annulla nulla, perché la sveglia potrebbe essere stata rimandata di 10 minuti ("Rimanda"):
// il telefono la conserva e la cancellerebbe solo l'app, per errore.
// Per lo stesso motivo programma() con gli stessi dati di prima non tocca un eventuale rinvio.
async function sincronizzaSveglia(a: Appuntamento): Promise<EsitoSveglia> {
  try {
    if (!vuoleSveglia(a)) {
      await sveglia.annulla(a.numId);
      return 'non-richiesta';
    }
    const quando = orarioPromemoria(a);
    if (quando.getTime() <= Date.now()) return 'orario-passato';

    await sveglia.programma({ id: a.numId, quando: quando.getTime(), titolo: a.titolo, testi: testiSveglia() });
    return 'programmata';
  } catch (errore) {
    if ((errore as { code?: string }).code === sveglia.ERRORE_ALLARMI_NON_CONSENTITI) {
      return 'allarmi-non-consentiti';
    }
    console.error('Sveglia non programmata', errore);
    return 'errore';
  }
}

export async function sincronizza(
  a: Appuntamento,
  opzioni: { chiediPermesso: boolean } = { chiediPermesso: true },
): Promise<Esiti> {
  const notifica = await sincronizzaNotifica(a, opzioni);
  const esitoSveglia = await sincronizzaSveglia(a);
  return { notifica, sveglia: esitoSveglia };
}

export async function annullaPromemoria(a: Appuntamento): Promise<void> {
  await notifiche.annulla(a.numId);
  await sveglia.annulla(a.numId);
}

export interface Salvato extends Esiti {
  appuntamento: Appuntamento;
}

// Prima si salva l'appuntamento, poi si programmano notifica e sveglia: se qualcosa
// fallisce l'appuntamento resta salvato e riconcilia() riproverà.
export async function creaAppuntamento(dati: NuovoAppuntamento): Promise<Salvato> {
  const appuntamento = await creare(dati);
  return { appuntamento, ...(await sincronizza(appuntamento)) };
}

export async function modificaAppuntamento(id: string, dati: NuovoAppuntamento): Promise<Salvato> {
  const appuntamento = await modificare(id, dati);
  return { appuntamento, ...(await sincronizza(appuntamento)) };
}

// Notifica e sveglia si cancellano prima del record: così non resta mai un avviso "fantasma".
export async function eliminaAppuntamento(a: Appuntamento): Promise<void> {
  await annullaPromemoria(a);
  await eliminare(a.id);
}

// Da chiamare all'avvio e quando l'app torna in primo piano: toglie notifiche e sveglie che non
// corrispondono più a nessun appuntamento e riprogramma quelle mancanti (dopo arresto forzato,
// cambio di fuso orario, permesso appena concesso...). Non mostra mai la finestra dei permessi.
export async function riconcilia(): Promise<void> {
  try {
    const tutti = await leggiTutti();

    const notificheAttese = new Set(tutti.filter(vuoleNotifica).map((a) => a.numId));
    for (const id of await notifiche.elencaPendenti()) {
      if (!notificheAttese.has(id)) await notifiche.annulla(id);
    }

    const sveglieAttese = new Set(tutti.filter(vuoleSveglia).map((a) => a.numId));
    for (const id of await sveglia.elenca()) {
      if (!sveglieAttese.has(id)) await sveglia.annulla(id);
    }

    for (const a of tutti) {
      if (vuoleNotifica(a)) await sincronizzaNotifica(a, { chiediPermesso: false });
      if (vuoleSveglia(a)) await sincronizzaSveglia(a);
    }
  } catch (errore) {
    console.error('Riconciliazione non riuscita', errore);
  }
}
