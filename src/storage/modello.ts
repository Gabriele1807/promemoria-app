export type Lingua = 'it' | 'ar';

export type TipoPromemoria = 'notifica' | 'sveglia' | 'entrambi';

export const TIPI_PROMEMORIA: TipoPromemoria[] = ['notifica', 'sveglia', 'entrambi'];

// Minuti di anticipo selezionabili nel form (0 = all'ora esatta).
export const ANTICIPI_MINUTI = [0, 15, 30, 60, 120] as const;

export interface Appuntamento {
  id: string; // identificatore univoco (UUID)
  // Intero progressivo, mai riusato: servirà come id stabile di notifiche e sveglie (Fasi 3-4).
  numId: number;
  titolo: string;
  data: string; // YYYY-MM-DD, ora locale
  ora: string; // HH:mm, ora locale
  note: string; // può essere vuota
  tipo: TipoPromemoria;
  anticipoMinuti: number;
}

// Dati inseriti dall'utente: id e numId li assegna lo storage.
export type NuovoAppuntamento = Omit<Appuntamento, 'id' | 'numId'>;
