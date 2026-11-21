/*
 * The app's only screen: Capacitor's web view showing the game (web/), plus the app's
 * own plugin, which must be registered before Capacitor starts (PhonePlugin.java).
 */
package com.hivedone.whoshotit;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PhonePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
