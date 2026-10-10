import { App as CapacitorApp } from '@capacitor/app';
import { useEffect, useState } from 'react';
import CambioLingua from './components/CambioLingua';
import { riconcilia, type Esiti } from './promemoria/pianificatore';
import FormAppuntamentoScreen from './screens/FormAppuntamentoScreen';
import ImpostazioniScreen from './screens/ImpostazioniScreen';
import OggiScreen from './screens/OggiScreen';
import type { Appuntamento } from './storage/modello';

// Poche schermate: nessuna libreria di navigazione necessaria.
type Vista = { nome: 'oggi' } | { nome: 'impostazioni' } | { nome: 'form'; appuntamento?: Appuntamento };

export default function App() {
  const [vista, setVista] = useState<Vista>({ nome: 'oggi' });
  const [esitiUltimi, setEsitiUltimi] = useState<Esiti>();

  // Allinea notifiche e sveglie agli appuntamenti all'avvio e ogni volta che l'app torna in primo piano.
  useEffect(() => {
    void riconcilia();
    const ascolto = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void riconcilia();
    });
    return () => {
      void ascolto.then((h) => h.remove());
    };
  }, []);

  return (
    <div className="app">
      <CambioLingua />
      {vista.nome === 'form' ? (
        <FormAppuntamentoScreen
          appuntamento={vista.appuntamento}
          onFinito={(esiti) => {
            setEsitiUltimi(esiti);
            setVista({ nome: 'oggi' });
          }}
        />
      ) : vista.nome === 'impostazioni' ? (
        <ImpostazioniScreen onIndietro={() => setVista({ nome: 'oggi' })} />
      ) : (
        <OggiScreen
          esitiUltimi={esitiUltimi}
          onAggiungi={() => setVista({ nome: 'form' })}
          onImpostazioni={() => setVista({ nome: 'impostazioni' })}
          onModifica={(appuntamento) => setVista({ nome: 'form', appuntamento })}
        />
      )}
    </div>
  );
}
