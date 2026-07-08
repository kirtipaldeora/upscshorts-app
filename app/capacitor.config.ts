import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.penni.app',
  appName: 'Penni',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}

export default config
