import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.twende.store',
  appName: 'Aletwende Store',
  webDir: 'www',
  server: { url: process.env.CAP_SERVER_URL || 'https://YOUR-STORE-LIVE-URL', cleartext: false },
}

export default config
