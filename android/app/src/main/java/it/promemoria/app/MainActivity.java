package it.promemoria.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import it.promemoria.app.sveglia.SvegliaPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // I plugin locali vanno registrati prima di super.onCreate.
        registerPlugin(SvegliaPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
