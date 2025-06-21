import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fieldops.app',
  appName: 'FieldOps MVP',
  webDir: 'out',
  server: {
    androidScheme: 'https'
  }
};

export default config;
