import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'uk.co.housesync',
  appName: 'HouseSync',
  webDir: 'www',
  // App chrome colour while the page loads.
  backgroundColor: '#f6f7fb',
  server: {
    // Load the live, server-rendered site inside the native shell.
    // This keeps the app auto-updated on every deploy (no resubmission
    // needed for content changes) and works with the Supabase auth
    // middleware + API routes that can't be statically exported.
    url: 'https://housesync.co.uk',
    androidScheme: 'https',
    // Bundled branded page shown if the main frame fails to load (offline
    // cold start) instead of the stock WebView network-error screen.
    errorPath: 'error.html',
  },
  plugins: {
    // Without presentationOptions, notifications that arrive while the app is
    // OPEN are silently swallowed on both platforms.
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    // Hold the branded splash over the webview while the remote page loads,
    // instead of flashing a blank near-white frame. The web app dismisses it
    // as soon as it has painted (see SplashHide in the root layout); the
    // 4s ceiling is the safety net so a dead network can't strand the splash.
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 4000,
      launchFadeOutDuration: 200,
    },
  },
};

export default config;
