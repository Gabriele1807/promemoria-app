import { App } from '@capacitor/app';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { chiediPermesso, statoPermesso } from '../promemoria/notifiche';
import { riconcilia, vuoleSveglia } from '../promemoria/pianificatore';
import { apriImpostazioniAllarmi, apriImpostazioniSchermoIntero, statoPermessi } from '../promemoria/sveglia';
import { leggiTutti } from '../storage/appuntamenti';
import { orarioPromemoria } from '../storage/ordinamento';
import BottoneGrande from './BottoneGrande';

interface Problemi {
  notificheNegate: boolean;
  allarmiNegati: boolean;
  schermoIntero: boolean;
}

const NESSUN_PROBLEMA: Problemi = { notificheNegate: false, allarmiNegati: false, schermoIntero: false };

// Mostra un riquadro per ogni permesso che manca. Si ricontrolla ogni volta che l'app torna in
// primo piano (l'utente può averlo attivato dalle Impostazioni). I riquadri della sveglia compaiono
// solo se esiste un appuntamento futuro con sveglia: niente avvisi inutili a chi non la usa.
export default function AvvisoPermessi() {
  const { t } = useTranslation();
  const [problemi, setProblemi] = useState<Problemi>(NESSUN_PROBLEMA);

  const controlla = useCallback(async () => {
    const notificheNegate = (await statoPermesso()) === 'negato';
    const haSveglieFuture = (await leggiTutti()).some(
      (a) => vuoleSveglia(a) && orarioPromemoria(a).getTime() > Date.now(),
    );
    if (!haSveglieFuture) {
      setProblemi({ ...NESSUN_PROBLEMA, notificheNegate });
      return;
    }
    const permessi = await statoPermessi();
    setProblemi({
      notificheNegate,
      allarmiNegati: !permessi.allarmiEsatti,
      schermoIntero: !permessi.schermoIntero,
    });
  }, []);

  useEffect(() => {
    void controlla();
    const ascolto = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void controlla();
    });
    return () => {
      void ascolto.then((h) => h.remove());
    };
  }, [controlla]);

  async function riprovaNotifiche() {
    await chiediPermesso();
    await riconcilia(); // se ora è concesso, programma le notifiche già salvate
    await controlla();
  }

  return (
    <>
      {problemi.notificheNegate && (
        <section className="errore" role="alert">
          <p>{t('avviso.permessoNegato')}</p>
          <BottoneGrande testo={t('avviso.riprova')} className="bottone-secondario" onClick={riprovaNotifiche} />
        </section>
      )}
      {problemi.allarmiNegati && (
        <section className="errore" role="alert">
          <p>{t('avviso.allarmiEsatti')}</p>
          <BottoneGrande
            testo={t('avviso.apriImpostazioni')}
            className="bottone-secondario"
            onClick={() => void apriImpostazioniAllarmi()}
          />
        </section>
      )}
      {problemi.schermoIntero && (
        <section className="errore" role="alert">
          <p>{t('avviso.schermoIntero')}</p>
          <BottoneGrande
            testo={t('avviso.apriImpostazioni')}
            className="bottone-secondario"
            onClick={() => void apriImpostazioniSchermoIntero()}
          />
        </section>
      )}
    </>
  );
}
