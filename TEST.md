# TEST.md — Prova dell'app Promemoria sul telefono

Questa lista serve a provare, su un telefono vero, ciò che il computer non può verificare: notifiche, sveglie, schermo spento, riavvio, silenzioso, arabo. Si segna ogni riga con ✅ (ok) o ❌ (non va) e si scrive cosa è successo.

## 1. Dov'è l'APK e come metterlo sul telefono

**File:** `C:\Users\Gabriele\Downloads\Promemoria\android\app\build\outputs\apk\debug\app-debug.apk` (circa 4 MB, APK di debug: si installa a mano, non è per il Play Store).

**Metodo A — cavo USB e copia (il più semplice)**
1. Collega il telefono al PC con il cavo e, sul telefono, scegli "Trasferimento file".
2. Copia `app-debug.apk` nella cartella **Download** del telefono (in Esplora risorse: *Questo PC → [nome telefono] → Memoria interna → Download*).
3. Sul telefono apri **I miei file → Download → app-debug.apk** e premi *Installa*. Se Android lo chiede, consenti "Installa app sconosciute" a I miei file.
4. Se c'è già una versione installata, l'installazione la aggiorna e **tiene gli appuntamenti**.

**Metodo B — da PC con `adb`** (serve il "Debug USB" attivo: *Impostazioni → Info telefono → Informazioni software → tocca 7 volte "Numero build"*, poi *Opzioni sviluppatore → Debug USB*)
```
C:\Users\Gabriele\Android\sdk\platform-tools\adb.exe install -r "C:\Users\Gabriele\Downloads\Promemoria\android\app\build\outputs\apk\debug\app-debug.apk"
```

**Come rifare l'APK** (dopo aver cambiato qualcosa), da PowerShell nella cartella del progetto:
```
npm run build
npx cap sync android
$env:JAVA_HOME = "C:\Users\Gabriele\Android\jdk-21"
$env:ANDROID_HOME = "C:\Users\Gabriele\Android\sdk"
cd android
.\gradlew.bat assembleDebug
```

## 2. Cosa è già stato controllato dal computer
- 68 test automatici passati (storage, ordinamento, notifiche, sveglie, traduzioni IT/AR).
- Build pulita dell'APK e controllo Android Lint senza errori.
- Permessi dell'APK finale controllati: **nessun `INTERNET`**; ci sono notifiche, allarmi esatti, schermo intero, servizio in primo piano, vibrazione, avvio dopo riavvio.
- Il sito web (schermate, italiano/arabo, RTL, form, Impostazioni) provato nel browser a larghezza telefono.

**Non è mai stato provato su un telefono: tutto ciò che segue.**

## 3. Prima di tutto
| | Prova | Esito / note |
|---|---|---|
| [ ] | L'app **si apre** e mostra "Oggi" con "Nessun appuntamento oggi" e il pulsante "+ Aggiungi". *(In questa versione ho tolto il permesso INTERNET: se la pagina restasse bianca, segnalarlo subito.)* | |
| [ ] | Testi grandi e leggibili; i pulsanti si toccano senza difficoltà. | |

## 4. La checklist principale
> **Trucco per non aspettare:** crea gli appuntamenti per **3-4 minuti più avanti**. Per provare l'anticipo, scegli "All'ora esatta" o calcola l'orario di conseguenza.

| | Prova | Esito / note |
|---|---|---|
| [ ] | **Creare "Solo notifica"**: al momento giusto arriva la notifica con il titolo e il testo corretti. La prima volta Android chiede il permesso per le notifiche: concederlo. | |
| [ ] | **Creare "Solo sveglia"**: all'ora esatta si apre la schermata a schermo intero, suona e vibra. | |
| [ ] | **Creare "Notifica e sveglia"**: arrivano entrambe. Annotare se averle insieme è fastidioso. | |
| [ ] | **Modificare** un appuntamento (cambia ora o titolo) e verificare che la notifica/sveglia **si aggiorni**: arriva solo alla nuova ora, **non** alla vecchia, e una sola volta. | |
| [ ] | **Modificare il tipo** ("Solo notifica" → "Solo sveglia" e viceversa): arriva solo l'avviso del tipo nuovo. | |
| [ ] | **Eliminare** un appuntamento e verificare che la notifica e la sveglia **spariscano**: alla vecchia ora non arriva nulla. | |
| [ ] | **Riavvio del telefono**: dopo il riavvio gli appuntamenti sono ancora in "Oggi" e le notifiche/sveglie future arrivano ancora (anche senza aprire l'app). | |
| [ ] | **Schermo spento**: con schermo spento e telefono bloccato arrivano la notifica e la sveglia; la sveglia **accende lo schermo** e si vede sopra il blocco. | |
| [ ] | **Modalità silenziosa** (e poi anche "Non disturbare"): la sveglia **suona comunque**. Annotare cosa succede alla notifica. | |
| [ ] | **Cambio lingua in arabo**: premendo "عربي / Italiano" tutto passa in arabo, il layout è **da destra a sinistra** e allineato bene, in "Oggi", nel form e nelle Impostazioni. | |
| [ ] | La lingua scelta **resta** dopo aver chiuso e riaperto l'app. | |

## 5. La sveglia nei dettagli
| | Prova | Esito / note |
|---|---|---|
| [ ] | La schermata mostra titolo e ora, con **"Fatto"** e **"Rimanda 10 minuti"** grandi e ben leggibili. | |
| [ ] | **"Fatto"**: il suono e la vibrazione si fermano e la schermata si chiude. Non suona più. | |
| [ ] | **"Rimanda 10 minuti"**: si ferma, e dopo 10 minuti suona di nuovo. Si può rimandare più volte. | |
| [ ] | I pulsanti **della notifica** ("Fatto" / "Rimanda 10 minuti") funzionano come quelli della schermata. | |
| [ ] | **Nessuna risposta**: dopo **5 minuti** la sveglia si spegne da sola e resta la notifica "Sveglia non spenta". | |
| [ ] | **Volume**: metti il volume delle sveglie quasi a zero (*Impostazioni → Suoni → Volume*) e lancia una sveglia: suona comunque **forte abbastanza** (≥ 60%). A fine sveglia il volume torna com'era. | |
| [ ] | Con il telefono **in uso e sbloccato**, la sveglia compare comunque (schermata o notifica con pulsanti). | |
| [ ] | **Cambio lingua con una sveglia già programmata**: la sveglia usa i testi della nuova lingua. *(Nota: una sveglia già rimandata perde il rinvio.)* | |

## 6. Permessi e messaggi di errore
| | Prova | Esito / note |
|---|---|---|
| [ ] | **Negare le notifiche** alla richiesta: l'appuntamento si salva lo stesso e in "Oggi" compare il riquadro rosso con le istruzioni e il pulsante "Riprova". | |
| [ ] | Dopo aver attivato le notifiche dalle Impostazioni di Android e tornato nell'app, il riquadro **sparisce** e le notifiche già salvate vengono programmate. | |
| [ ] | **Impostazioni → "Cosa è attivo"**: notifiche, allarmi all'ora esatta e sveglia a schermo intero mostrano lo stato giusto; i pulsanti "Apri impostazioni" aprono la pagina giusta. | |
| [ ] | **Schermo intero negato (Android 14 o superiore)**: la sveglia suona lo stesso e arriva la notifica con i pulsanti; in "Oggi" compare il riquadro con "Apri impostazioni". Annotare la versione di Android. | |
| [ ] | Provare a creare un appuntamento con **orario già passato**: l'app non lo salva e mostra il messaggio. | |

## 7. Batteria e Samsung
| | Prova | Esito / note |
|---|---|---|
| [ ] | **Impostazioni → "Apri impostazioni batteria"** apre la pagina giusta di Android. | |
| [ ] | I **nomi delle voci** scritti nelle istruzioni («Non ottimizzare», «Senza restrizioni», «App mai in stop») corrispondono a quelli del telefono, **in italiano e in arabo**. Annotare le differenze. | |
| [ ] | Dopo aver escluso l'app, la riga diventa **verde** ("Tutto a posto…"). | |
| [ ] | **Prova lunga:** programma una sveglia per la mattina dopo, lascia il telefono fermo e con schermo spento **tutta la notte**, **senza** aprire l'app. Suona all'ora giusta? (Provala sia **prima** sia **dopo** aver escluso l'app dal risparmio batteria.) | |
| [ ] | Con il **risparmio energetico attivo** (modalità "Risparmio energetico" di Samsung) la sveglia suona lo stesso. | |

## 8. Casi strani
| | Prova | Esito / note |
|---|---|---|
| [ ] | **Arresto forzato** (*Impostazioni → App → Promemoria → Termina*): riaprendo l'app le notifiche e le sveglie future tornano programmate. | |
| [ ] | **Cambio dell'ora** del telefono (avanti di qualche ora e poi indietro) o **cambio di fuso**: le sveglie future restano all'ora giusta. | |
| [ ] | **Due sveglie alla stessa ora**: suona l'ultima; la prima viene sostituita. Annotare se è accettabile. | |
| [ ] | Aggiornare l'app installando di nuovo l'APK: **gli appuntamenti restano**. | |

## 9. Prova con la persona che userà l'app
Fai provare il prototipo **presto** alla persona a cui è destinato e annota le sue reazioni qui sotto, con le sue parole.

| Data | Cosa ha provato | Cosa ha detto / dove si è bloccato | Cosa cambiare |
|---|---|---|---|
| | Aggiungere un appuntamento | | |
| | Capire "Solo notifica / Solo sveglia / Notifica e sveglia" | | |
| | Spegnere la sveglia ("Fatto") | | |
| | Cambiare lingua | | |
| | Dimensione dei testi e dei pulsanti | | |

## 10. Se qualcosa non va
Con il telefono collegato e il Debug USB attivo (usare `adb.exe` indicato sopra):
- `adb.exe shell dumpsys alarm | findstr promemoria` → sveglie e notifiche in attesa.
- `adb.exe shell dumpsys notification | findstr -i promemoria` → notifiche e canali.
- `adb.exe logcat -d | findstr -i "Sveglia Capacitor"` → messaggi dell'app.

Documenti di dettaglio: `NOTIFICHE.md` (come funzionano le notifiche) e `SVEGLIE.md` (sveglie, permessi, volume, limiti noti).
