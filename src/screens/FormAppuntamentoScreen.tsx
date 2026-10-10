import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import BottoneGrande from '../components/BottoneGrande';
import SceltaTipo from '../components/SceltaTipo';
import { creaAppuntamento, eliminaAppuntamento, modificaAppuntamento, type Esiti } from '../promemoria/pianificatore';
import { ANTICIPI_MINUTI, type Appuntamento, type NuovoAppuntamento } from '../storage/modello';
import { dataLocale, orarioPromemoria } from '../storage/ordinamento';

type Props = {
  // Se presente si modifica quell'appuntamento, altrimenti se ne crea uno nuovo.
  appuntamento?: Appuntamento;
  onFinito: (esiti?: Esiti) => void;
};

export default function FormAppuntamentoScreen({ appuntamento, onFinito }: Props) {
  const { t } = useTranslation();
  const [dati, setDati] = useState<NuovoAppuntamento>({
    titolo: appuntamento?.titolo ?? '',
    data: appuntamento?.data ?? dataLocale(),
    ora: appuntamento?.ora ?? '',
    note: appuntamento?.note ?? '',
    tipo: appuntamento?.tipo ?? 'notifica',
    anticipoMinuti: appuntamento?.anticipoMinuti ?? 0,
  });
  const [errore, setErrore] = useState<string | null>(null);
  const [confermaElimina, setConfermaElimina] = useState(false);

  const cambia = <K extends keyof NuovoAppuntamento>(campo: K, valore: NuovoAppuntamento[K]) =>
    setDati((d) => ({ ...d, [campo]: valore }));

  async function salva(e: FormEvent) {
    e.preventDefault();
    if (!dati.titolo.trim()) return setErrore(t('form.erroreTitolo'));
    if (!dati.data) return setErrore(t('form.erroreData'));
    if (!dati.ora) return setErrore(t('form.erroreOra'));
    // Con notifica o sveglia, un orario già passato non ha senso. Lo si controlla solo se
    // l'orario è nuovo o cambiato, così si possono ancora correggere le note di un appuntamento passato.
    const orarioCambiato =
      !appuntamento ||
      appuntamento.data !== dati.data ||
      appuntamento.ora !== dati.ora ||
      appuntamento.anticipoMinuti !== dati.anticipoMinuti ||
      appuntamento.tipo !== dati.tipo;
    if (orarioCambiato && orarioPromemoria(dati).getTime() <= Date.now()) {
      return setErrore(t('form.erroreOrarioPassato'));
    }
    try {
      const pulito = { ...dati, titolo: dati.titolo.trim(), note: dati.note.trim() };
      const { notifica, sveglia } = appuntamento
        ? await modificaAppuntamento(appuntamento.id, pulito)
        : await creaAppuntamento(pulito);
      onFinito({ notifica, sveglia });
    } catch {
      setErrore(t('form.erroreSalvataggio'));
    }
  }

  async function conferma() {
    if (!appuntamento) return;
    try {
      await eliminaAppuntamento(appuntamento);
      onFinito();
    } catch {
      setConfermaElimina(false);
      setErrore(t('form.erroreSalvataggio'));
    }
  }

  if (confermaElimina) {
    return (
      <main className="schermata">
        <h1 className="titolo">{t('form.confermaElimina')}</h1>
        <BottoneGrande testo={t('form.siElimina')} className="bottone-pericolo" onClick={conferma} />
        <BottoneGrande testo={t('form.noTieni')} className="bottone-secondario" onClick={() => setConfermaElimina(false)} />
      </main>
    );
  }

  return (
    <main className="schermata">
      <h1 className="titolo">{appuntamento ? t('form.titoloModifica') : t('form.titoloNuovo')}</h1>

      <form className="form" onSubmit={salva} noValidate>
        <label className="campo">
          <span className="etichetta">{t('form.campoTitolo')}</span>
          <input className="input" type="text" value={dati.titolo} onChange={(e) => cambia('titolo', e.target.value)} />
        </label>

        <label className="campo">
          <span className="etichetta">{t('form.campoData')}</span>
          <input className="input" type="date" value={dati.data} onChange={(e) => cambia('data', e.target.value)} />
        </label>

        <label className="campo">
          <span className="etichetta">{t('form.campoOra')}</span>
          <input className="input" type="time" value={dati.ora} onChange={(e) => cambia('ora', e.target.value)} />
        </label>

        <label className="campo">
          <span className="etichetta">{t('form.campoNote')}</span>
          <textarea className="input" rows={3} value={dati.note} onChange={(e) => cambia('note', e.target.value)} />
        </label>

        <div className="campo">
          <span className="etichetta">{t('form.campoTipo')}</span>
          <SceltaTipo valore={dati.tipo} onCambia={(tipo) => cambia('tipo', tipo)} />
        </div>

        <label className="campo">
          <span className="etichetta">{t('form.campoAnticipo')}</span>
          <select className="input" value={dati.anticipoMinuti} onChange={(e) => cambia('anticipoMinuti', Number(e.target.value))}>
            {ANTICIPI_MINUTI.map((min) => (
              <option key={min} value={min}>{t(`anticipo.${min}`)}</option>
            ))}
          </select>
        </label>

        {errore && <p className="errore" role="alert">{errore}</p>}

        <button type="submit" className="bottone-grande">{t('form.salva')}</button>
        <BottoneGrande testo={t('form.annulla')} className="bottone-secondario" onClick={() => onFinito()} />
        {appuntamento && (
          <BottoneGrande testo={t('form.elimina')} className="bottone-pericolo" onClick={() => setConfermaElimina(true)} />
        )}
      </form>
    </main>
  );
}
