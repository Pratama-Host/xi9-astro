import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // URL produksi untuk canonical URLs dan sitemap
  site: 'https://xi9-mubela.vercel.app',

  // Kompresi HTML output
  compressHTML: true,

  // Konfigurasi build output
  build: {
    assets: '_astro'
  }
});
