import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.michi.app',
  appName: 'michi',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}

export default config
