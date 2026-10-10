import { App } from '@capacitor/app';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import BottoneGrande from '../components/BottoneGrande';
import { chiediPermesso, statoPermesso, type StatoPermesso } from '../promemoria/notifiche';
import { riconcilia } from '../promemoria/pianificatore';
import {
  apriImpostazioniAllarmi,
  apriImpostazioniApp,
  apriImpostazioniBatteria,
  apriImpostazioniSchermoIntero,
  statoPermessi,
  type StatoPermessiSveglia,
} from '../promemoria/sveglia';

type Props = {
  onIndietro: () => void;
};

interface Stato {
  notifiche: StatoPermesso;
  sveglia: StatoPermessiSveglia;
}

export default function ImpostazioniScreen({ onIndietro }: Props) {
  const { t } = useTranslation();
  const [stato, setStato] = useState<Stato | null>(null);
  const [paginaNonAperta, setPaginaNonAperta] = useState(false);

  const aggiorna = useCallback(async () => {
    setStato({ notifiche: await statoPermesso(), sveglia: await statoPermessi() });
  }, []);

  // Si ricontrolla ogni volta che l'utente torna dalle Impostazioni di Android.
  useEffect(() => {
    void aggiorna();
    const ascolto = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void aggiorna();
    });
    return () => {
      void ascolto.then((h) => h.remove());
    };
  }, [aggiorna]);

  async function apriBatteria() {
    setPaginaNonAperta(!(await apriImpostazioniBatteria()));
  }

  // Notifiche: se Android può ancora mostrare la finestra si chiede lì; altrimenti si apre la pagina dell'app.
  async function sistemaNotifiche() {
    if (stato?.notifiche === 'da-chiedere') {
      await chiediPermesso();
      await riconcilia();
      await aggiorna();
    } else {
      await apriImpostazioniApp();
    }
  }

  const righe = stato
    ? [
        { chiave: 'notifiche', ok: stato.notifiche === 'concesso', azione: sistemaNotifiche },
        { chiave: 'allarmi', ok: stato.sveglia.allarmiEsatti, azione: apriImpostazioniAllarmi },
        { chiave: 'schermoIntero', ok: stato.sveglia.schermoIntero, azione: apriImpostazioniSchermoIntero },
      ]
    : [];

  return (
    <main className="schermata">
      <h1 className="titolo">{t('impostazioni.titolo')}</h1>

      <section className="sezione">
        <h2 className="sottotitolo">{t('impostazioni.batteria.titolo')}</h2>
        <p>{t('impostazioni.batteria.spiegazione')}</p>
        {/* Lista numerata vera: il numero si mette dalla parte giusta anche in arabo (RTL). */}
        <ol className="passi">
          <li>{t('impostazioni.batteria.passo1')}</li>
          <li>{t('impostazioni.batteria.passo2')}</li>
          <li>{t('impostazioni.batteria.passo3')}</li>
        </ol>
        {stato && (
          <p className={stato.sveglia.batteria ? 'stato-ok' : 'stato-da-sistemare'}>
            {t(stato.sveglia.batteria ? 'impostazioni.batteria.esclusa' : 'impostazioni.batteria.nonEsclusa')}
          </p>
        )}
        <BottoneGrande testo={t('impostazioni.batteria.apri')} onClick={() => void apriBatteria()} />
        {paginaNonAperta && (
          <p className="errore" role="alert">
            {t('impostazioni.batteria.nonSupportato')}
          </p>
        )}
      </section>

      <section className="sezione">
        <h2 className="sottotitolo">{t('impostazioni.permessi.titolo')}</h2>
        <ul className="lista">
          {righe.map(({ chiave, ok, azione }) => (
            <li key={chiave} className="riga-permesso">
              <p className="riga-permesso-nome">{t(`impostazioni.permessi.${chiave}`)}</p>
              <p className={ok ? 'stato-ok' : 'stato-da-sistemare'}>
                {t(ok ? 'impostazioni.permessi.attivo' : 'impostazioni.permessi.daAttivare')}
              </p>
              {!ok && <BottoneGrande testo={t('avviso.apriImpostazioni')} className="bottone-secondario" onClick={() => void azione()} />}
            </li>
          ))}
        </ul>
      </section>

      <BottoneGrande testo={t('impostazioni.indietro')} className="bottone-secondario bottone-aggiungi" onClick={onIndietro} />
    </main>
  );
}
