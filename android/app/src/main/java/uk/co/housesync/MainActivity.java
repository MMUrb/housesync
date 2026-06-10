package uk.co.housesync;

import android.webkit.CookieManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onPause() {
        super.onPause();
        // Chromium only commits webview cookies to disk every ~30s, so a cookie
        // set just before the app is swiped away is lost. Flushing on pause
        // guarantees fresh cookies (Supabase session, gate) survive a process kill.
        CookieManager.getInstance().flush();
    }
}
