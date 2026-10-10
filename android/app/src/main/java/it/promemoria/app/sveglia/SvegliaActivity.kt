package it.promemoria.app.sveglia

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import androidx.core.content.ContextCompat
import it.promemoria.app.R
import java.text.DateFormat
import java.util.Date

/**
 * Schermata a schermo intero della sveglia: si apre sopra il blocco schermo e accende lo schermo.
 * Mostra titolo e ora e due pulsanti grandi. Il suono non è qui: lo gestisce SvegliaService.
 */
class SvegliaActivity : Activity() {
    private var id = -1

    // Quando il servizio chiude la sveglia (per esempio dal pulsante della notifica), si chiude anche la schermata.
    private val chiusura = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) = finish()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        mostraSopraBlocco()
        setContentView(R.layout.activity_sveglia)
        ContextCompat.registerReceiver(
            this, chiusura, IntentFilter(SvegliaService.AZIONE_CHIUDI_SCHERMATA), ContextCompat.RECEIVER_NOT_EXPORTED,
        )
        mostraSveglia()
    }

    // Se suona un'altra sveglia mentre la schermata è aperta, si ricarica con i dati della nuova.
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        mostraSveglia()
    }

    override fun onDestroy() {
        unregisterReceiver(chiusura)
        super.onDestroy()
    }

    private fun mostraSveglia() {
        id = intent.getIntExtra(SvegliaProgrammatore.EXTRA_ID, -1)
        val sveglia = SvegliaArchivio(this).trova(id)
        if (sveglia == null) { // già spenta o annullata
            finish()
            return
        }
        findViewById<TextView>(R.id.titolo).text = sveglia.titolo
        findViewById<TextView>(R.id.ora).text =
            DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(sveglia.quandoOriginale))
        findViewById<Button>(R.id.pulsanteFatto).apply {
            text = sveglia.testi.fatto
            setOnClickListener { inviaAlServizio(SvegliaService.AZIONE_FATTO) }
        }
        findViewById<Button>(R.id.pulsanteRimanda).apply {
            text = sveglia.testi.rimanda
            setOnClickListener { inviaAlServizio(SvegliaService.AZIONE_RIMANDA) }
        }
    }

    // Il servizio ferma suono e vibrazione, poi la schermata si chiude.
    private fun inviaAlServizio(azione: String) {
        startService(
            Intent(this, SvegliaService::class.java)
                .setAction(azione)
                .putExtra(SvegliaProgrammatore.EXTRA_ID, id),
        )
        finish()
    }

    @Suppress("DEPRECATION")
    private fun mostraSopraBlocco() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
            )
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }
}
