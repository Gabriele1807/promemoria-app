import { useTranslation } from 'react-i18next';
import { cambiaLingua } from '../i18n/lingua';
import BottoneGrande from './BottoneGrande';

// Sempre visibile in alto. Il testo "عربي / Italiano" è lo stesso nelle due lingue ed è sempre
// scritto da sinistra a destra, così il pulsante ha lo stesso aspetto in italiano e in arabo.
export default function CambioLingua() {
  const { t, i18n } = useTranslation();
  const prossima = i18n.language === 'ar' ? 'it' : 'ar';

  return (
    <div className="barra-lingua">
      <BottoneGrande
        testo={t('lingua.cambia')}
        dir="ltr"
        className="bottone-secondario"
        onClick={() => void cambiaLingua(prossima)}
      />
    </div>
  );
}
