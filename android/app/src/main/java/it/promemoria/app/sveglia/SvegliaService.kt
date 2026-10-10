package it.promemoria.app.sveglia

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import it.promemoria.app.R

/**
 * Servizio in primo piano che fa suonare la sveglia: suoneria in loop, vibrazione, notifica a
 * schermo intero con "Fatto" e "Rimanda 10 minuti". Si ferma da solo dopo 5 minuti.
 * Il servizio parla solo con l'archivio e con il programmatore, mai con la parte web dell'app.
 */
@SuppressLint("ApplySharedPref") // commit() voluto: il volume originale deve essere su disco subito, anche se il servizio viene terminato
class SvegliaService : Service() {
    private val gestore = Handler(Looper.getMainLooper())
    private val autoSpegnimento = Runnable { nonSpenta() }
    private var player: MediaPlayer? = null
    private var vibratore: Vibrator? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var idCorrente: Int? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val id = intent?.getIntExtra(SvegliaProgrammatore.EXTRA_ID, -1) ?: -1
        when (intent?.action) {
            AZIONE_SUONA -> suona(id)
            AZIONE_FATTO -> fatto(id)
            AZIONE_RIMANDA -> rimanda(id)
            else -> stopSelf()
        }
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        fermaSuoneria()
        super.onDestroy()
    }

    // --- Azioni ---------------------------------------------------------------------------------

    private fun suona(id: Int) {
        val archivio = SvegliaArchivio(this)
        val sveglia = archivio.trova(id)

        // Android vuole la notifica entro pochi secondi dall'avvio del servizio: la prima cosa da fare.
        creaCanale(sveglia)
        ServiceCompat.startForeground(
            this, ID_NOTIFICA + id, costruisciNotifica(id, sveglia),
            // Il "tipo" del servizio esiste da Android 10; prima non serve.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK else 0,
        )
        if (sveglia == null) { // la sveglia è stata annullata proprio ora
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
            stopSelf()
            return
        }

        // Se un'altra sveglia stava suonando, la nuova prende il suo posto.
        idCorrente?.let { if (it != id) archivio.rimuovi(it) }
        fermaSuoneria()
        idCorrente = id

        accendiWakeLock()
        alzaVolumeSeServe()
        avviaSuoneria()
        avviaVibrazione()
        gestore.postDelayed(autoSpegnimento, DURATA_MASSIMA_MS)
    }

    private fun fatto(id: Int) {
        SvegliaArchivio(this).rimuovi(id)
        chiudi(id)
    }

    private fun rimanda(id: Int) {
        val archivio = SvegliaArchivio(this)
        archivio.trova(id)?.let { sveglia ->
            val nuovoOrario = System.currentTimeMillis() + RINVIO_MS
            try {
                SvegliaProgrammatore(this).programma(id, nuovoOrario)
                archivio.salva(sveglia.copy(quandoAttuale = nuovoOrario))
            } catch (e: SecurityException) {
                // Allarmi esatti non più consentiti: la sveglia resta nell'archivio e l'app lo segnalerà.
            }
        }
        chiudi(id)
    }

    // Dopo 5 minuti senza risposta: si ferma e lascia una notifica per ricordare che non è stata spenta.
    private fun nonSpenta() {
        val id = idCorrente ?: return
        val archivio = SvegliaArchivio(this)
        archivio.trova(id)?.let { sveglia ->
            val notifica = NotificationCompat.Builder(this, ID_CANALE)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle(sveglia.titolo)
                .setContentText(sveglia.testi.nonSpenta)
                .setWhen(sveglia.quandoOriginale)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(intentApriSchermata(id))
                .build()
            getSystemService(NotificationManager::class.java).notify(ID_NOTIFICA_NON_SPENTA + id, notifica)
        }
        archivio.rimuovi(id)
        chiudi(id)
    }

    // Ferma tutto, toglie la notifica e chiude la schermata a schermo intero se è aperta.
    private fun chiudi(id: Int) {
        fermaSuoneria()
        getSystemService(NotificationManager::class.java).cancel(ID_NOTIFICA + id)
        sendBroadcast(Intent(AZIONE_CHIUDI_SCHERMATA).setPackage(packageName))
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    // --- Suono, vibrazione, schermo -------------------------------------------------------------

    private fun avviaSuoneria() {
        val uri = RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
        try {
            player = MediaPlayer().apply {
                // USAGE_ALARM: segue il volume delle sveglie e suona anche con il telefono in silenzioso.
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build(),
                )
                setDataSource(this@SvegliaService, uri)
                isLooping = true
                prepare()
                start()
            }
        } catch (e: Exception) {
            player?.release()
            player = null // senza suono resta almeno la vibrazione
        }
    }

    @Suppress("DEPRECATION")
    private fun avviaVibrazione() {
        val vibratore = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            getSystemService(VibratorManager::class.java).defaultVibrator
        } else {
            getSystemService(Vibrator::class.java)
        }
        this.vibratore = vibratore
        val schema = longArrayOf(0, 800, 600) // pausa, vibra, pausa: si ripete finché non si ferma
        val attributi = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibratore.vibrate(VibrationEffect.createWaveform(schema, 0), attributi)
        } else {
            vibratore.vibrate(schema, 0, attributi) // Android 7
        }
    }

    private fun accendiWakeLock() {
        val pm = getSystemService(PowerManager::class.java)
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "promemoria:sveglia")
            .apply { acquire(DURATA_MASSIMA_MS + 30_000) }
    }

    // Se il volume delle sveglie è sotto il 60% lo porta al 60% finché suona; poi lo ripristina.
    private fun alzaVolumeSeServe() {
        try {
            val audio = getSystemService(AudioManager::class.java)
            val massimo = audio.getStreamMaxVolume(AudioManager.STREAM_ALARM)
            val minimo = (massimo * 6 + 9) / 10 // 60% arrotondato per eccesso
            val attuale = audio.getStreamVolume(AudioManager.STREAM_ALARM)
            if (attuale < minimo) {
                statoVolume().edit()
                    .putInt(CHIAVE_VOLUME_ORIGINALE, attuale)
                    .putInt(CHIAVE_VOLUME_IMPOSTATO, minimo)
                    .commit()
                audio.setStreamVolume(AudioManager.STREAM_ALARM, minimo, 0)
            }
        } catch (e: SecurityException) {
            // Alcuni telefoni (es. con "Non disturbare") non permettono di cambiare il volume: si va avanti.
        }
    }

    // Ripristina il volume solo se è ancora quello che abbiamo impostato (se l'utente l'ha cambiato, non si tocca).
    // Il valore è salvato su disco, così il ripristino funziona anche se il servizio è stato terminato.
    private fun ripristinaVolume() {
        val prefs = statoVolume()
        if (!prefs.contains(CHIAVE_VOLUME_ORIGINALE)) return
        try {
            val audio = getSystemService(AudioManager::class.java)
            val originale = prefs.getInt(CHIAVE_VOLUME_ORIGINALE, -1)
            val impostato = prefs.getInt(CHIAVE_VOLUME_IMPOSTATO, -1)
            if (originale >= 0 && audio.getStreamVolume(AudioManager.STREAM_ALARM) == impostato) {
                audio.setStreamVolume(AudioManager.STREAM_ALARM, originale, 0)
            }
        } catch (e: SecurityException) {
            // vedi alzaVolumeSeServe
        } finally {
            prefs.edit().clear().commit()
        }
    }

    private fun statoVolume() = getSharedPreferences(FILE_STATO_VOLUME, Context.MODE_PRIVATE)

    private fun fermaSuoneria() {
        gestore.removeCallbacks(autoSpegnimento)
        player?.let {
            try { it.stop() } catch (e: IllegalStateException) { /* già fermo */ }
            it.release()
        }
        player = null
        vibratore?.cancel()
        vibratore = null
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
        ripristinaVolume()
        idCorrente = null
    }

    // --- Notifica -------------------------------------------------------------------------------

    // I canali di notifica esistono da Android 8; su Android 7 non servono.
    private fun creaCanale(sveglia: Sveglia?) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val canale = NotificationChannel(
            ID_CANALE,
            sveglia?.testi?.canale ?: getString(R.string.app_name),
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = sveglia?.testi?.canaleDescrizione ?: ""
            setSound(null, null) // il suono lo gestisce il servizio, in loop
            enableVibration(false) // idem per la vibrazione
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(canale)
    }

    private fun costruisciNotifica(id: Int, sveglia: Sveglia?): Notification {
        val builder = NotificationCompat.Builder(this, ID_CANALE)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(sveglia?.titolo ?: getString(R.string.app_name))
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
        if (sveglia != null) {
            val apri = intentApriSchermata(id)
            builder
                .setWhen(sveglia.quandoOriginale) // il sistema mostra l'ora nella lingua del telefono
                .setShowWhen(true)
                .setContentIntent(apri)
                .setFullScreenIntent(apri, true)
                .addAction(0, sveglia.testi.fatto, intentServizio(id, AZIONE_FATTO))
                .addAction(0, sveglia.testi.rimanda, intentServizio(id, AZIONE_RIMANDA))
        }
        return builder.build()
    }

    private fun intentApriSchermata(id: Int): PendingIntent {
        val intent = Intent(this, SvegliaActivity::class.java)
            .putExtra(SvegliaProgrammatore.EXTRA_ID, id)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        return PendingIntent.getActivity(this, id, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }

    // I pulsanti della notifica usano startService (non startForegroundService): non serve una nuova notifica.
    private fun intentServizio(id: Int, azione: String): PendingIntent {
        val intent = Intent(this, SvegliaService::class.java)
            .setAction(azione)
            .putExtra(SvegliaProgrammatore.EXTRA_ID, id)
        // requestCode diverso per "Fatto" e "Rimanda", altrimenti Android li confonderebbe.
        val codice = if (azione == AZIONE_FATTO) id * 2 else id * 2 + 1
        return PendingIntent.getService(this, codice, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }

    companion object {
        const val AZIONE_SUONA = "it.promemoria.app.sveglia.SUONA"
        const val AZIONE_FATTO = "it.promemoria.app.sveglia.FATTO"
        const val AZIONE_RIMANDA = "it.promemoria.app.sveglia.RIMANDA"
        const val AZIONE_CHIUDI_SCHERMATA = "it.promemoria.app.sveglia.CHIUDI_SCHERMATA"

        const val RINVIO_MS = 10 * 60 * 1000L
        const val DURATA_MASSIMA_MS = 5 * 60 * 1000L

        private const val ID_CANALE = "sveglia"
        // Il plugin notifiche usa lo stesso numero dell'appuntamento come id: si sommano
        // due grandi numeri diversi per non sovrascrivere mai le sue notifiche.
        private const val ID_NOTIFICA = 1_000_000
        private const val ID_NOTIFICA_NON_SPENTA = 2_000_000

        private const val FILE_STATO_VOLUME = "sveglia_volume"
        private const val CHIAVE_VOLUME_ORIGINALE = "originale"
        private const val CHIAVE_VOLUME_IMPOSTATO = "impostato"
    }
}
