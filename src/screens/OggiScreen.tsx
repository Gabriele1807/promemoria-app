import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AvvisoPermessi from '../components/AvvisoPermessi';
import BottoneGrande from '../components/BottoneGrande';
import { formattaData, formattaOra } from '../i18n/formatoData';
import type { Esiti } from '../promemoria/pianificatore';
import { leggiPerData } from '../storage/appuntamenti';
import type { Appuntamento, Lingua } from '../storage/modello';
import { dataLocale } from '../storage/ordinamento';

type Props = {
  esitiUltimi?: Esiti; // esito di notifica e sveglia dell'ultimo salvataggio
  onAggiungi: () => void;
  onImpostazioni: () => void;
  onModifica: (appuntamento: Appuntamento) => void;
};

export default function OggiScreen({ esitiUltimi, onAggiungi, onImpostazioni, onModifica }: Props) {
  const { t, i18n } = useTranslation();
  const lingua: Lingua = i18n.language === 'ar' ? 'ar' : 'it';
  const [lista, setLista] = useState<Appuntamento[] | null>(null);

  useEffect(() => {
    let attivo = true;
    leggiPerData(dataLocale()).then((r) => attivo && setLista(r));
    return () => {
      attivo = false;
    };
  }, []);

  return (
    <main className="schermata">
      <h1 className="titolo">{t('oggi.titolo')}</h1>
      <p className="data-oggi">{formattaData(dataLocale(), lingua)}</p>

      <AvvisoPermessi />
      {(esitiUltimi?.notifica === 'errore' || esitiUltimi?.sveglia === 'errore') && (
        <p className="errore" role="alert">
          {t('avviso.erroreNotifica')}
        </p>
      )}

      {lista === null ? (
        <p className="messaggio-vuoto">{t('oggi.caricamento')}</p>
      ) : lista.length === 0 ? (
        <p className="messaggio-vuoto">{t('oggi.nessunAppuntamento')}</p>
      ) : (
        <ul className="lista">
          {lista.map((a) => (
            <li key={a.id} className="carta">
              <p className="carta-ora">{formattaOra(a.ora, lingua)}</p>
              <p className="carta-titolo">{a.titolo}</p>
              <p className="carta-tipo">{t(`tipo.${a.tipo}`)}</p>
              {a.note && <p className="carta-note">{a.note}</p>}
              <BottoneGrande testo={t('oggi.modifica')} className="bottone-secondario" onClick={() => onModifica(a)} />
            </li>
          ))}
        </ul>
      )}

      <div className="azioni">
        <BottoneGrande testo={t('oggi.impostazioni')} className="bottone-secondario" onClick={onImpostazioni} />
        <BottoneGrande testo={t('oggi.aggiungi')} onClick={onAggiungi} />
      </div>
    </main>
  );
}
