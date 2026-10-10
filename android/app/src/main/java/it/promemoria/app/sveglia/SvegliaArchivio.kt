package it.promemoria.app.sveglia

import android.annotation.SuppressLint
import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** Testi già tradotti, ricevuti dall'app (src/i18n) e conservati qui: servono anche dopo un riavvio. */
data class TestiSveglia(
    val fatto: String,
    val rimanda: String,
    val canale: String,
    val canaleDescrizione: String,
    val nonSpenta: String,
)

/**
 * Una sveglia programmata.
 * [quandoOriginale] è l'orario deciso dall'app; [quandoAttuale] cambia con "Rimanda 10 minuti".
 * Tutti gli orari sono millisecondi dal 1970 (epoch).
 */
data class Sveglia(
    val id: Int,
    val quandoOriginale: Long,
    val quandoAttuale: Long,
    val titolo: String,
    val testi: TestiSveglia,
)

/**
 * Elenco delle sveglie salvato sul telefono (SharedPreferences, nessun server).
 * Serve a due cose: ritrovare i testi quando suona e riprogrammare tutto dopo il riavvio.
 */
@SuppressLint("ApplySharedPref") // commit() voluto: le sveglie devono essere su disco subito
class SvegliaArchivio(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(NOME_FILE, Context.MODE_PRIVATE)

    @Synchronized
    fun tutte(): List<Sveglia> {
        val grezzo = prefs.getString(CHIAVE_ELENCO, null) ?: return emptyList()
        return try {
            val array = JSONArray(grezzo)
            (0 until array.length()).map { daJson(array.getJSONObject(it)) }
        } catch (e: Exception) {
            emptyList() // dati rovinati: si riparte da zero, l'app riprogramma al prossimo avvio
        }
    }

    fun trova(id: Int): Sveglia? = tutte().firstOrNull { it.id == id }

    /** Aggiunge la sveglia o sostituisce quella con lo stesso id. */
    @Synchronized
    fun salva(sveglia: Sveglia) {
        scrivi(tutte().filter { it.id != sveglia.id } + sveglia)
    }

    /** Se la sveglia non esiste non fa nulla. */
    @Synchronized
    fun rimuovi(id: Int) {
        scrivi(tutte().filter { it.id != id })
    }

    private fun scrivi(elenco: List<Sveglia>) {
        val array = JSONArray()
        elenco.forEach { array.put(inJson(it)) }
        prefs.edit().putString(CHIAVE_ELENCO, array.toString()).commit()
    }

    private fun inJson(s: Sveglia) = JSONObject()
        .put("id", s.id)
        .put("quandoOriginale", s.quandoOriginale)
        .put("quandoAttuale", s.quandoAttuale)
        .put("titolo", s.titolo)
        .put("fatto", s.testi.fatto)
        .put("rimanda", s.testi.rimanda)
        .put("canale", s.testi.canale)
        .put("canaleDescrizione", s.testi.canaleDescrizione)
        .put("nonSpenta", s.testi.nonSpenta)

    private fun daJson(o: JSONObject) = Sveglia(
        id = o.getInt("id"),
        quandoOriginale = o.getLong("quandoOriginale"),
        quandoAttuale = o.getLong("quandoAttuale"),
        titolo = o.getString("titolo"),
        testi = TestiSveglia(
            fatto = o.getString("fatto"),
            rimanda = o.getString("rimanda"),
            canale = o.getString("canale"),
            canaleDescrizione = o.getString("canaleDescrizione"),
            nonSpenta = o.getString("nonSpenta"),
        ),
    )

    private companion object {
        const val NOME_FILE = "sveglie"
        const val CHIAVE_ELENCO = "elenco"
    }
}
