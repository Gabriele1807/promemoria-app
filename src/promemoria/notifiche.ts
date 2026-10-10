import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

// Unico file che parla con il plugin delle notifiche. Nel browser le notifiche
// programmate non si possono provare: qui tutto è un'operazione vuota e il
// permesso risulta "concesso" (non c'è nulla da chiedere).

export type StatoPermesso = 'concesso' | 'negato' | 'da-chiedere';

const CANALE = 'promemoria';

const nativo = () => Capacitor.isNativePlatform();

function traduci(stato: string): StatoPermesso {
  if (stato === 'granted') return 'concesso';
  if (stato === 'denied') return 'negato';
  return 'da-chiedere'; // 'prompt' e 'prompt-with-rationale'
}

export async function statoPermesso(): Promise<StatoPermesso> {
  if (!nativo()) return 'concesso';
  const { display } = await LocalNotifications.checkPermissions();
  return traduci(display);
}

// Mostra la finestra di sistema (Android 13+). Se l'utente ha già rifiutato
// più volte, Android non la mostra più e restituisce subito "negato".
export async function chiediPermesso(): Promise<StatoPermesso> {
  if (!nativo()) return 'concesso';
  const { display } = await LocalNotifications.requestPermissions();
  return traduci(display);
}

// Dal 8.0 di Android ogni notifica appartiene a un "canale". Crearlo più volte è innocuo.
export async function creaCanale(nome: string, descrizione: string): Promise<void> {
  if (!nativo()) return;
  await LocalNotifications.createChannel({
    id: CANALE,
    name: nome,
    description: descrizione,
    importance: 4, // alta: suono e comparsa a schermo
    visibility: 1, // visibile anche con il telefono bloccato
    vibration: true,
  });
}

export interface DatiNotifica {
  id: number; // numId dell'appuntamento: stesso id = stessa notifica
  titolo: string;
  corpo: string;
  quando: Date;
  idAppuntamento: string;
}

export async function programma(n: DatiNotifica): Promise<void> {
  if (!nativo()) return;
  await LocalNotifications.schedule({
    notifications: [
      {
        id: n.id,
        title: n.titolo,
        body: n.corpo,
        channelId: CANALE,
        schedule: { at: n.quando, allowWhileIdle: true },
        extra: { idAppuntamento: n.idAppuntamento },
      },
    ],
  });
}

// Se la notifica non esiste non succede nulla.
export async function annulla(id: number): Promise<void> {
  if (!nativo()) return;
  await LocalNotifications.cancel({ notifications: [{ id }] });
}

// Id delle notifiche ancora in attesa di partire.
export async function elencaPendenti(): Promise<number[]> {
  if (!nativo()) return [];
  const { notifications } = await LocalNotifications.getPending();
  return notifications.map((n) => n.id);
}
