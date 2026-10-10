# Come funzionano le notifiche

Questo file spiega in modo semplice cosa succede quando si crea, si cambia o si elimina un appuntamento. Le sveglie (Fase 4) sono un'altra cosa e non sono ancora fatte.

## L'idea in una frase

Per ogni appuntamento con tipo **"Solo notifica"** o **"Notifica e sveglia"** il telefono riceve la richiesta: *"mostra questa notifica a quest'ora"*. Poi pensa a tutto Android, anche se l'app è chiusa.

## A che ora arriva

`orario dell'appuntamento − minuti di anticipo`

Esempio: appuntamento alle 10:00 con "30 minuti prima" → la notifica arriva alle 9:30. Il calcolo è in `orarioPromemoria()` (`src/storage/ordinamento.ts`) e usa sempre l'ora del telefono.

## Il numero che lega notifica e appuntamento

Ogni appuntamento ha un numero (`numId`): 1, 2, 3… Non si riusa mai, nemmeno dopo aver eliminato un appuntamento. La notifica ha **lo stesso numero**: per questo si può trovare, cambiare o cancellare senza sbagliare.

## Chi fa cosa

| File | Compito |
|---|---|
| `src/promemoria/pianificatore.ts` | Il "capo": decide cosa programmare o cancellare. Le schermate parlano solo con lui. |
| `src/promemoria/notifiche.ts` | Il "traduttore": parla con il plugin di Capacitor (permessi, canale, programma, annulla). |
| `src/components/AvvisoPermessi.tsx` | Mostra il messaggio se le notifiche sono bloccate. |

## Cosa succede nei vari casi

**Salvo un appuntamento nuovo**
1. Viene salvato sul telefono.
2. Il pianificatore controlla il tipo. Se è "Solo sveglia" non fa nulla.
3. Controlla il permesso; se non è ancora stato chiesto, compare la finestra di Android.
4. Programma la notifica con lo stesso numero dell'appuntamento.

**Modifico un appuntamento**: si toglie sempre la notifica vecchia e se ne programma una nuova (se serve). Così funzionano tutti i casi: nuovo orario, nuovo titolo, passaggio da "notifica" a "sveglia" (la notifica sparisce) e viceversa. Non possono restare due notifiche per lo stesso appuntamento.

**Elimino un appuntamento**: prima si cancella la notifica, poi il record. Se si facesse al contrario e qualcosa andasse storto, resterebbe una notifica "fantasma".

**Apro l'app, o ci torno** (`riconcilia()`): l'app confronta gli appuntamenti con le notifiche in attesa. Toglie quelle senza appuntamento e rimette quelle che mancano. Serve se Android ha fermato l'app, se il telefono ha cambiato fuso orario o se il permesso è stato appena concesso. **Non** mostra mai la finestra dei permessi.

**Riavvio del telefono**: le notifiche programmate le ripristina il plugin da solo.

## Permessi

- **Notifiche (Android 13 e superiori)**: l'app lo chiede la prima volta che si salva un appuntamento con notifica. Sotto Android 13 non serve chiederlo.
- **Se l'utente dice "No"**: l'appuntamento viene salvato lo stesso, ma in "Oggi" compare un riquadro con il messaggio *"Le notifiche sono bloccate… Impostazioni, App, Promemoria, Notifiche"* e il pulsante **Riprova**. Dopo un secondo rifiuto Android non mostra più la finestra: bisogna attivarle dalle Impostazioni del telefono. Quando l'utente torna nell'app, il riquadro sparisce da solo e le notifiche già salvate vengono programmate.
- **Orario esatto**: l'app dichiara il permesso `USE_EXACT_ALARM` (Android 13+), concesso in automatico, e `SCHEDULE_EXACT_ALARM` fino ad Android 12. Così la notifica arriva al minuto giusto e l'utente non deve attivare nulla. Il plugin chiede l'arrivo anche se il telefono è in risparmio energetico (`allowWhileIdle`).

## Orario già passato

Se l'orario della notifica è già passato (con "Solo notifica" o "Notifica e sveglia"), il form non salva e mostra *"L'orario dell'avviso è già passato"*. Il controllo si fa solo se orario, anticipo o tipo sono nuovi o cambiati, così si può ancora correggere il titolo di un appuntamento vecchio.

## Cosa NON si può provare nel browser

Nel browser le notifiche programmate sono operazioni vuote (il codice gira, ma non compare nulla). Solo sul telefono si verifica che:
- la finestra dei permessi compaia davvero e il rifiuto mostri il riquadro;
- la notifica arrivi all'ora giusta, con schermo spento e anche in risparmio energetico;
- dopo modifica o eliminazione non arrivi quella vecchia;
- dopo il riavvio del telefono le notifiche ci siano ancora;
- il suono, la vibrazione e l'icona della notifica.

Dettagli ancora da verificare sul telefono:
- l'icona della notifica è quella generica di Android: un'icona dedicata si può aggiungere più avanti;
- il testo della notifica si decide al momento di programmarla: al cambio lingua l'app lo rifà da sola (`cambiaLingua` chiama `riconcilia`), ma va provato sul telefono che la notifica già programmata cambi davvero lingua;
- la fusione dei permessi nel manifest Android (`maxSdkVersion` su `SCHEDULE_EXACT_ALARM`) è da controllare con la prima build.

## Se qualcosa non va, sul telefono

Con il cavo USB e `adb`:
- `adb shell dumpsys alarm | findstr promemoria` → mostra gli allarmi in attesa;
- `adb shell dumpsys notification` → mostra le notifiche e il canale "Promemoria".
