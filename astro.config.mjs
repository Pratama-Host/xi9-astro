import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

// SSR diperlukan agar API admin, cookie sesi, dan query Supabase berjalan di server.
export default defineConfig({
  site: 'https://xi9-mubela.vercel.app',
  output: 'server',
  adapter: vercel(),
  compressHTML: true,
  build: {
    assets: '_astro',
  },
});
