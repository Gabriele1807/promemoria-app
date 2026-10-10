package it.promemoria.app.sveglia

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Android cancella tutti gli allarmi quando il telefono si riavvia (e li sposta se cambia l'ora o il fuso).
 * Questo componente riceve quegli eventi e rimette le sveglie nell'AlarmManager leggendo l'archivio.
 * Non serve aprire l'app.
 */
class AvvioReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED,
            Intent.ACTION_MY_PACKAGE_REPLACED, // dopo un aggiornamento dell'app
            -> SvegliaProgrammatore(context).ripristina(SvegliaArchivio(context))
        }
    }
}
