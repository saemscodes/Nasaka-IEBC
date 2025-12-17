import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nasaka.iebc',
  appName: 'Nasaka IEBC',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    hostname: 'recall254.vercel.app',
    allowNavigation: [
      '*.supabase.co',
      'nominatim.openstreetmap.org',
      '*.openstreetmap.org'
    ]
  },
  android: {
    buildOptions: {
      keystorePath: 'keystore/release.keystore',
      keystorePassword: process.env.KEYSTORE_PASSWORD,
      keystoreAlias: 'nasaka',
      keystoreAliasPassword: process.env.KEYSTORE_ALIAS_PASSWORD,
      releaseType: 'AAB'
    },
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true
  },
  ios: {
    scheme: 'Nasaka IEBC',
    scrollEnabled: true,
    allowsLinkPreview: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: '#007AFF',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: true,
      androidSpinnerStyle: 'large',
      iosSpinnerStyle: 'small',
      spinnerColor: '#ffffff',
      splashFullScreen: true,
      splashImmersive: true,
      layoutName: 'launch_screen',
      useDialog: true
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#007AFF',
      overlay: false
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
      resizeOnFullScreen: true
    },
    Haptics: {
      enabled: true
    }
  }
};

export default config;