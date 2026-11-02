import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'astro';

if (!url || !key) {
  console.error('SUPABASE_URL atau SUPABASE_SERVICE_KEY belum terbaca.');
  process.exit(1);
}

const supabase = createClient(url, key);
const manifest = JSON.parse(
  fs.readFileSync('migrations/media-manifest.json', 'utf8')
);

const mime = {
  '.webp': 'image/webp',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.weba': 'audio/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav'
};

let success = 0;
let failed = 0;

for (const item of manifest.files) {
  if (!fs.existsSync(item.source)) {
    console.log('FILE TIDAK DITEMUKAN:', item.source);
    failed++;
    continue;
  }

  const { error } = await supabase.storage.from(bucket).upload(
    item.targetPath,
    fs.readFileSync(item.source),
    {
      contentType: mime[path.extname(item.source).toLowerCase()] || 'application/octet-stream',
      upsert: true
    }
  );

  if (error) {
    console.log('GAGAL:', item.targetPath, error.message);
    failed++;
  } else {
    console.log('BERHASIL:', item.targetPath);
    success++;
  }
}

console.log(`Selesai: ${success} berhasil, ${failed} gagal.`);
