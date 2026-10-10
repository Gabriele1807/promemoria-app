import { useTranslation } from 'react-i18next';
import { TIPI_PROMEMORIA, type TipoPromemoria } from '../storage/modello';

type Props = {
  valore: TipoPromemoria;
  onCambia: (tipo: TipoPromemoria) => void;
};

// Tre grandi pulsanti con testo; quello scelto è evidenziato (aria-pressed).
export default function SceltaTipo({ valore, onCambia }: Props) {
  const { t } = useTranslation();
  return (
    <div className="scelta-tipo">
      {TIPI_PROMEMORIA.map((tipo) => (
        <button
          key={tipo}
          type="button"
          className="bottone-grande bottone-scelta"
          aria-pressed={valore === tipo}
          onClick={() => onCambia(tipo)}
        >
          {t(`tipo.${tipo}`)}
        </button>
      ))}
    </div>
  );
}
