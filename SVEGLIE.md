# Come funzionano le sveglie

Le sveglie sono per gli appuntamenti con tipo **"Solo sveglia"** o **"Notifica e sveglia"**. A differenza della notifica (Fase 3, vedi `NOTIFICHE.md`), la sveglia suona in loop finché non la si spegne. La parte Android è scritta in Kotlin, senza librerie esterne, in `android/app/src/main/java/it/promemoria/app/sveglia/`.

## Cosa succede

1. **Si salva l'appuntamento** → `pianificatore.ts` chiama il plugin `Sveglia` (`programma`) con l'ora esatta, il titolo e i testi già tradotti ("Fatto", "Rimanda 10 minuti"…).
2. **`SvegliaProgrammatore`** programma l'allarme con `AlarmManager.setAlarmClock`: è la sveglia "vera" di Android, scatta in orario anche in risparmio energetico. `SvegliaArchivio` ne conserva i dati sul telefono.
3. **All'ora esatta** `SvegliaReceiver` avvia `SvegliaService`: suono di sveglia di sistema in loop (anche in silenzioso), vibrazione, schermo acceso, notifica con "Fatto" e "Rimanda 10 minuti".
4. **`SvegliaActivity`** si apre a schermo intero sopra il blocco: titolo, ora e due pulsanti grandi.
   - **Fatto**: ferma tutto e toglie la sveglia.
   - **Rimanda 10 minuti**: ferma il suono e riprogramma la stessa sveglia fra 10 minuti. Si può rimandare più volte.
5. **Dopo 5 minuti senza risposta** si ferma da sola e lascia la notifica "Sveglia non spenta".

Dopo un **riavvio**, un cambio di ora o di fuso, o un aggiornamento dell'app, `AvvioReceiver` rimette le sveglie future. Quelle scadute a telefono spento non suonano.

## Modifica ed eliminazione
Si comportano come per le notifiche: ogni cambio di orario, titolo o tipo sostituisce o toglie la sveglia con lo stesso numero (`numId`). L'eliminazione cancella sveglia e notifica prima del record.

**"Rimanda" e riconcilia:** quando l'orario originale è già passato, l'app non annulla nulla: potrebbe esserci una sveglia rimandata. Inoltre `programma` con gli stessi dati di prima conserva il rinvio. Tutto questo è coperto da test.

## Permessi (cosa e perché)
| Permesso | Scelta |
|---|---|
| Allarmi esatti | **`USE_EXACT_ALARM`** (Android 13+): concesso in automatico, non revocabile, pensato per sveglie e calendari. L'utente non deve fare nulla. Su Android 12 resta `SCHEDULE_EXACT_ALARM` (da attivare nelle Impostazioni: l'app mostra un riquadro con il pulsante). L'APK si installa a mano, quindi il limite del Play Store non conta. |
| Schermo intero | `USE_FULL_SCREEN_INTENT`: su Android 14+ può essere **negato** per un APK fuori dal Play Store. Se lo è, la sveglia suona lo stesso e compare la notifica con i pulsanti, ma la schermata non si apre da sola; in "Oggi" compare un riquadro con "Apri impostazioni". |
| Servizio in primo piano | `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_MEDIA_PLAYBACK`: per suonare anche con l'app chiusa. |
| Altri | `VIBRATE`, `WAKE_LOCK`, `RECEIVE_BOOT_COMPLETED`. |

I riquadri della sveglia compaiono solo se esiste un appuntamento futuro con sveglia.

## Schermata Impostazioni (batteria e permessi)
Si apre dal pulsante "Impostazioni" in "Oggi". Contiene:
- **Batteria**: una spiegazione in italiano e in arabo per togliere Promemoria dal risparmio batteria (passi per Samsung/One UI), una riga che dice se l'app è già esclusa (`PowerManager.isIgnoringBatteryOptimizations`) e il pulsante **"Apri impostazioni batteria"**. Usa l'Intent `android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS`: apre l'elenco delle app e **non richiede nessun permesso in più**. Se il telefono non ha quella pagina, compare un messaggio con il percorso da fare a mano.
- **Cosa è attivo**: notifiche, allarmi all'ora esatta, sveglia a schermo intero. Ognuno mostra "Attivo" o "Da attivare", e in questo caso un pulsante "Apri impostazioni". Lo stato si aggiorna quando l'utente torna dalle Impostazioni di Android.

Il Kotlin ha due metodi in più (`apriImpostazioniBatteria`, `apriImpostazioniApp`) e `statoPermessi` ora risponde anche `batteria`.

Non ho usato `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` (la finestra "Consenti" con un tocco): richiederebbe il permesso `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` nel manifest. Si può aggiungere dopo la prova sul Samsung, se i passi a mano risultassero troppo difficili.

## Volume
Se il volume delle sveglie è **sotto il 60%**, durante la sveglia viene portato al 60% e poi ripristinato (solo se l'utente non lo ha cambiato nel frattempo). Il valore originale è salvato su disco, così il ripristino funziona anche se il servizio viene terminato.

## Cosa è verificato e cosa NO

**Verificato qui:**
- il progetto compila (`gradlew assembleDebug`) con tutto il Kotlin;
- `lint` Android: 0 errori. Ha trovato funzioni di Android 8 usate senza controllo (su Android 7 la sveglia si sarebbe bloccata): ora sono protette. minSdk resta 24;
- 53 test vitest passati (17 per le sveglie: programmazione, cambio tipo, eliminazione, errori, riconciliazione che non tocca un rinvio);
- l'app web funziona nel browser (le operazioni sulla sveglia sono vuote).

**NON verificato — da provare su un telefono vero** (nessuna di queste cose si vede nel browser né nei test):
- l'allarme scatta all'ora esatta, anche con schermo spento e in risparmio energetico;
- la schermata si apre sopra il blocco e accende lo schermo; il comportamento con il permesso schermo intero negato (Android 14+);
- il suono suona in loop, anche in modalità silenziosa e con "Non disturbare";
- vibrazione, **"Fatto"** e **"Rimanda 10 minuti"** (dalla schermata e dai pulsanti della notifica);
- spegnimento automatico dopo 5 minuti e notifica "Sveglia non spenta";
- volume portato al 60% e ripristinato;
- ripristino dopo riavvio, cambio ora e fuso;
- l'avvio del servizio dal background su Android 14/15 (se fallisse, il piano B è la notifica a schermo intero);
- il comportamento sul Samsung con il risparmio batteria, prima e dopo aver escluso l'app dalla schermata Impostazioni;
- che il pulsante "Apri impostazioni batteria" apra davvero la pagina giusta sul Samsung, che la riga "già escluso" diventi verde dopo aver cambiato l'impostazione, e che i nomi delle voci One UI scritti nelle istruzioni («Non ottimizzare», «Senza restrizioni», «App mai in stop») corrispondano a quelli del telefono, in italiano e in arabo;
- con "Notifica e sveglia" notifica e sveglia scattano insieme: da valutare se è fastidioso.

Comandi utili con il telefono collegato:
- `adb install -r android\app\build\outputs\apk\debug\app-debug.apk`
- `adb shell dumpsys alarm | findstr promemoria` → allarmi in attesa
- `adb logcat | findstr -i Sveglia` → messaggi dell'app

## Limiti noti
- Se suonano due sveglie insieme, la nuova prende il posto della precedente.
- Il testo delle sveglie si fissa quando le si programma: al cambio lingua l'app le riprogramma con i testi nuovi (`cambiaLingua` chiama `riconcilia`). Effetto collaterale: una sveglia **già rimandata** di 10 minuti perde il rinvio e torna all'orario originale, che per lei è passato, quindi non suona più. Da provare sul telefono.
- L'ora scritta nella schermata a schermo intero segue la lingua del telefono, non quella dell'app.
- Il suono è quello di sveglia predefinito del telefono; non è selezionabile dall'app.
