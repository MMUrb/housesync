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
  },
};

export default config;
