package it.promemoria.app.sveglia

import android.app.NotificationManager
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Il ponte tra l'app web (JavaScript) e la parte Android della sveglia.
 * In JavaScript si chiama "Sveglia": programma, annulla, elenco, statoPermessi e le due
 * funzioni che aprono le Impostazioni di Android. Qui non c'è logica: decide tutto l'app web.
 */
@CapacitorPlugin(name = "Sveglia")
class SvegliaPlugin : Plugin() {
    private val programmatore by lazy { SvegliaProgrammatore(context) }
    private val archivio by lazy { SvegliaArchivio(context) }

    /** programma({ id, quando (ms dal 1970), titolo, testi: { fatto, rimanda, canale, canaleDescrizione, nonSpenta } }) */
    @PluginMethod
    fun programma(call: PluginCall) {
        val id = call.getInt("id")
        val quando = call.data.optLong("quando", -1L)
        val testiJs = call.getObject("testi")
        if (id == null || quando <= 0 || testiJs == null) {
            call.reject("Dati della sveglia mancanti")
            return
        }
        val titolo = call.getString("titolo") ?: ""
        val testi = TestiSveglia(
            fatto = testiJs.optString("fatto"),
            rimanda = testiJs.optString("rimanda"),
            canale = testiJs.optString("canale"),
            canaleDescrizione = testiJs.optString("canaleDescrizione"),
            nonSpenta = testiJs.optString("nonSpenta"),
        )

        val esistente = archivio.trova(id)
        val invariata = esistente != null && esistente.quandoOriginale == quando &&
            esistente.titolo == titolo && esistente.testi == testi
        if (invariata) {
            // Stessi dati di prima: si conserva un eventuale "Rimanda". Si riarma l'allarme solo se è ancora
            // nel futuro (ripara il caso in cui Android l'abbia perso, per esempio dopo un arresto forzato).
            if (esistente!!.quandoAttuale > System.currentTimeMillis()) {
                try {
                    programmatore.programma(id, esistente.quandoAttuale)
                } catch (e: SecurityException) {
                    call.reject("Allarmi esatti non consentiti", ERRORE_ALLARMI_NON_CONSENTITI)
                    return
                }
            }
            call.resolve()
            return
        }

        if (!programmatore.puoProgrammare()) {
            call.reject("Allarmi esatti non consentiti", ERRORE_ALLARMI_NON_CONSENTITI)
            return
        }
        try {
            programmatore.programma(id, quando)
        } catch (e: SecurityException) {
            call.reject("Allarmi esatti non consentiti", ERRORE_ALLARMI_NON_CONSENTITI)
            return
        }
        archivio.salva(Sveglia(id, quandoOriginale = quando, quandoAttuale = quando, titolo = titolo, testi = testi))
        call.resolve()
    }

    /** annulla({ id }): toglie l'allarme e la sveglia dall'archivio. Se non esiste non fa nulla. */
    @PluginMethod
    fun annulla(call: PluginCall) {
        val id = call.getInt("id")
        if (id == null) {
            call.reject("id mancante")
            return
        }
        programmatore.annulla(id)
        archivio.rimuovi(id)
        call.resolve()
    }

    /** elenco(): { ids: number[] } con gli id delle sveglie in archivio. */
    @PluginMethod
    fun elenco(call: PluginCall) {
        val ids = JSArray()
        archivio.tutte().forEach { ids.put(it.id) }
        call.resolve(JSObject().put("ids", ids))
    }

    /** statoPermessi(): { allarmiEsatti, schermoIntero, batteria } — batteria: true se l'app è già esclusa dal risparmio. */
    @PluginMethod
    fun statoPermessi(call: PluginCall) {
        val schermoIntero = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            context.getSystemService(NotificationManager::class.java).canUseFullScreenIntent()
        } else {
            true
        }
        val batteria = context.getSystemService(PowerManager::class.java)
            .isIgnoringBatteryOptimizations(context.packageName)
        call.resolve(
            JSObject()
                .put("allarmiEsatti", programmatore.puoProgrammare())
                .put("schermoIntero", schermoIntero)
                .put("batteria", batteria),
        )
    }

    /**
     * Apre la pagina di Android con l'elenco delle app e il risparmio batteria
     * (Intent ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS, non serve nessun permesso).
     * Risponde { aperto: false } se questo telefono non ha quella pagina: l'app mostra allora un messaggio.
     */
    @PluginMethod
    fun apriImpostazioniBatteria(call: PluginCall) {
        val aperto = try {
            context.startActivity(
                Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
            true
        } catch (e: ActivityNotFoundException) {
            false
        }
        call.resolve(JSObject().put("aperto", aperto))
    }

    /** Apre le impostazioni generali dell'app (da lì si riattivano per esempio le notifiche). */
    @PluginMethod
    fun apriImpostazioniApp(call: PluginCall) {
        apri(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
        call.resolve()
    }

    /** Apre la pagina di Android dove si consente alla sveglia di aprirsi a schermo intero (Android 14+). */
    @PluginMethod
    fun apriImpostazioniSchermoIntero(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            apri(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT)
        } else {
            apri(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
        }
        call.resolve()
    }

    /** Apre la pagina di Android per consentire gli allarmi esatti (serve solo su Android 12). */
    @PluginMethod
    fun apriImpostazioniAllarmi(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            apri(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
        } else {
            apri(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
        }
        call.resolve()
    }

    // Se la pagina precisa non esiste su questo telefono, ripiega sulle impostazioni generali dell'app.
    private fun apri(azione: String) {
        val uri = Uri.parse("package:${context.packageName}")
        try {
            context.startActivity(Intent(azione, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (e: ActivityNotFoundException) {
            context.startActivity(
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
        }
    }

    private companion object {
        const val ERRORE_ALLARMI_NON_CONSENTITI = "ALLARMI_NON_CONSENTITI"
    }
}
