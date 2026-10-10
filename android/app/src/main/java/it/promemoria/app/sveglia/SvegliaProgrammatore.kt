package it.promemoria.app.sveglia

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * Unico punto che parla con AlarmManager.
 * Usa setAlarmClock: è la "sveglia vera" di Android, scatta all'ora esatta anche in risparmio
 * energetico (Doze) e il sistema mostra l'icona della sveglia nella barra di stato.
 */
class SvegliaProgrammatore(private val context: Context) {
    private val alarmManager = context.getSystemService(AlarmManager::class.java)

    /** Dal 12 di Android serve il permesso per gli allarmi esatti; con USE_EXACT_ALARM (13+) è sempre vero. */
    fun puoProgrammare(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager.canScheduleExactAlarms()

    /**
     * Programma (o sostituisce) l'allarme con questo id all'istante [quando].
     * @throws SecurityException se Android non consente gli allarmi esatti
     */
    fun programma(id: Int, quando: Long) {
        val info = AlarmManager.AlarmClockInfo(quando, intentApriApp())
        alarmManager.setAlarmClock(info, intentScatto(id))
    }

    /** Se l'allarme non esiste non fa nulla. */
    fun annulla(id: Int) {
        alarmManager.cancel(intentScatto(id))
    }

    /**
     * Dopo riavvio o cambio ora: riprogramma le sveglie ancora future e toglie dall'archivio
     * quelle scadute (con il telefono spento un allarme non può suonare).
     */
    fun ripristina(archivio: SvegliaArchivio, adesso: Long = System.currentTimeMillis()) {
        for (sveglia in archivio.tutte()) {
            if (sveglia.quandoAttuale > adesso) {
                try {
                    programma(sveglia.id, sveglia.quandoAttuale)
                } catch (e: SecurityException) {
                    // Allarmi esatti non consentiti: l'app lo segnala all'utente alla prossima apertura.
                }
            } else {
                archivio.rimuovi(sveglia.id)
            }
        }
    }

    // Stesso id = stesso PendingIntent: così programma() sostituisce e annulla() trova l'allarme giusto.
    private fun intentScatto(id: Int): PendingIntent {
        val intent = Intent(context, SvegliaReceiver::class.java)
            .setAction(AZIONE_SCATTO)
            .putExtra(EXTRA_ID, id)
        return PendingIntent.getBroadcast(context, id, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }

    // Quello che si apre toccando l'icona della sveglia nella barra di stato: l'app.
    private fun intentApriApp(): PendingIntent {
        val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        return PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_IMMUTABLE)
    }

    companion object {
        const val AZIONE_SCATTO = "it.promemoria.app.sveglia.SCATTO"
        const val EXTRA_ID = "id"
    }
}
