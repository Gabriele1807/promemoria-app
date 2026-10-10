import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import { caricaLinguaSalvata } from './i18n/lingua';
import './styles.css';
import App from './App';

// Si applica prima la lingua salvata, poi si mostra la pagina: niente "salto" da italiano ad arabo.
void caricaLinguaSalvata().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
