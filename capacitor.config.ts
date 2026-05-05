import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nasaka.app',
  appName: 'Nasaka',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'nasakaiebc.civiceducationkenya.com'
  }
};

export default config;
