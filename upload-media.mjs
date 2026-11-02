cat > scripts/upload-media.mjs <<'EOF'
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
  const source = item.source;
  const target = item.targetPath;
  if (!fs.existsSync(source)) {
    console.log('FILE TIDAK DITEMUKAN:', source);
    failed++;
    continue;
  }

  const file = fs.readFileSync(source);
  const contentType = mime[path.extname(source).toLowerCase()] || 'application/octet-stream';

  const { error } = await supabase.storage
    .from(bucket)
    .upload(target, file, {
      contentType,
      upsert: true
    });

  if (error) {
    console.log('GAGAL:', target, '-', error.message);
    failed++;
  } else {
    console.log('BERHASIL:', target);
    success++;
  }
}

console.log(`\nSelesai. Berhasil: ${success}, gagal: ${failed}`);
EOF
