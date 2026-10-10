# App Promemoria

Scopo: app Android (APK via Capacitor) per una persona anziana
poco pratica con il telefono. Gestisce appuntamenti, notifiche e sveglie.

## Regole
- UI semplicissima: un tasto grande "+ Aggiungi", pochi colori, caratteri grandi (min 20px).
- Ogni elemento di UI deve avere testo, mai solo icone.
- Lingue: italiano (predefinito) e arabo (RTL). Tutte le stringhe in src/i18n/,
  nessun testo scritto direttamente nei componenti.
- Ogni appuntamento sceglie: solo notifica, solo sveglia, o entrambi.
- Dati salvati solo sul dispositivo (Capacitor Preferences). Nessun server.
- Non aggiungere dipendenze senza spiegarne il motivo.
- Prima di ogni modifica spiega in due righe cosa cambi e perché.