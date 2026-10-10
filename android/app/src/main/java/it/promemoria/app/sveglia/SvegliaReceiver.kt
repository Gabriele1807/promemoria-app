package it.promemoria.app.sveglia

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

/** Riceve lo scatto dell'allarme (impostato da SvegliaProgrammatore) e avvia il servizio che suona. */
class SvegliaReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != SvegliaProgrammatore.AZIONE_SCATTO) return
        val id = intent.getIntExtra(SvegliaProgrammatore.EXTRA_ID, -1)
        if (id == -1) return

        val servizio = Intent(context, SvegliaService::class.java)
            .setAction(SvegliaService.AZIONE_SUONA)
            .putExtra(SvegliaProgrammatore.EXTRA_ID, id)
        // Lo scatto di un allarme esatto permette di avviare un servizio in primo piano anche dal background.
        ContextCompat.startForegroundService(context, servizio)
    }
}
