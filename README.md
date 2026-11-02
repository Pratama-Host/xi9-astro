# Website Kelas TKJ XI-9

Website Astro untuk kelas XI-9 Teknik Komputer dan Jaringan, SMK Muhammadiyah Belitang.

## Menjalankan proyek

```bash
npm install
npm run dev
```

Build produksi:

```bash
npm run build
npm run preview
```

Aplikasi menggunakan Astro server output dan adapter Vercel. Integrasi runtime Supabase, API admin, dan halaman publik sudah tersedia. Jika Supabase belum dikonfigurasi atau query gagal, halaman publik memakai data cadangan dari `src/data/G.json`; file media lokal lama yang sudah tidak tersedia tidak dipanggil sebagai fallback.

## Setup Lanjutan — Supabase, Storage, dan Admin

Integrasi Supabase berjalan melalui server Astro. Konfigurasi proyek dan kredensial tetap dikelola pemilik proyek melalui environment variable, bukan ditanam di source code.

### 1. Buat proyek Supabase dan isi environment variable

1. Buka [Supabase](https://supabase.com/) dan buat akun/proyek baru.
2. Pilih organisasi, nama proyek, password database, dan region yang sesuai. Simpan password database di pengelola password; password tersebut berbeda dari `ADMIN_PASSWORD`.
3. Setelah proyek aktif, buka **Project Settings → API** (atau halaman API Keys sesuai tampilan dashboard).
4. Salin **Project URL** ke `SUPABASE_URL`.
5. Ambil key server dengan hak akses service role/bypass RLS (umumnya bernama `service_role` pada tampilan legacy atau secret server key pada tampilan key yang lebih baru) ke `SUPABASE_SERVICE_KEY`. Jangan gunakan publishable/anon key untuk variabel ini.
6. Buat password panjang untuk panel admin dan secret acak minimal 32 karakter untuk menandatangani sesi.
7. Salin `.env.example` menjadi `.env`, lalu isi nilainya sendiri:

```dotenv
SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
SUPABASE_SERVICE_KEY=PASTE_SERVER_SECRET_KEY_HERE
SUPABASE_STORAGE_BUCKET=astro
ADMIN_PASSWORD=GANTI_DENGAN_PASSWORD_ADMIN_YANG_KUAT
ADMIN_SESSION_SECRET=GANTI_DENGAN_SECRET_ACAK_MINIMAL_32_KARAKTER
```

Nilai di atas hanya format contoh/placeholder, bukan kredensial yang valid. Jangan commit `.env` ke Git. `.gitignore` sudah mengecualikannya.

Untuk membuat secret lokal, contoh perintah (jalankan sendiri):

```bash
openssl rand -base64 48
```

Nilai dibaca dari environment server saat runtime melalui `process.env`. `SUPABASE_SERVICE_KEY` hanya dipakai di server oleh `src/lib/supabase.ts`. Jangan mengganti namanya menjadi `PUBLIC_SUPABASE_SERVICE_KEY`, jangan mengirimnya ke browser, dan jangan menyimpannya di repo.

### 2. Buat bucket Storage

1. Di dashboard Supabase, buka **Storage → New bucket**.
2. Gunakan nama bucket `astro`, sesuai konfigurasi proyek saat ini.
3. Aktifkan **Public bucket** agar browser dapat menampilkan foto/logo/audio yang dipakai situs publik.
4. Simpan bucket.
5. Struktur object yang dipakai aplikasi:

```text
astro/
├── anggota/                 # foto profil anggota
├── galeri/                  # foto kenangan/galeri
└── assets-global/
    ├── logo/                # logo situs
    └── audio/               # audio latar global
```

Upload foto anggota dapat langsung dikaitkan ke NIS (opsional), upload galeri otomatis membuat item galeri dengan caption, dan upload logo/audio global otomatis memperbarui pengaturan situs. Bucket publik berarti URL media dapat dibaca publik; jangan menaruh dokumen pribadi di bucket ini.

### 3. Schema dasar dan migration CMS

Schema dasar `migrations/schema.sql` membuat tabel inti `site_settings`, `anggota`, `guru`, `skills`, dan `galeri`. Karena schema dan seed inti proyek ini sudah pernah berhasil dijalankan, **jangan jalankan ulang schema atau seed tanpa kebutuhan yang jelas**.

Untuk mengaktifkan CMS tambahan, jalankan satu kali migration additive berikut melalui **Supabase → SQL Editor → New query**:

`migrations/20261101_cms.sql`

Migration ini menambah kolom dan tabel CMS tanpa menghapus tabel atau baris lama. Setelah selesai, tabel CMS tambahan `site_pages`, `site_navigation`, `site_sections`, `media_assets`, `content_revisions`, dan `admin_audit_logs` akan tersedia. Migration juga mengisi navigasi dan section berdasarkan route/markup aktual yang sudah ada.

Jika menyiapkan proyek Supabase yang benar-benar baru, jalankan `schema.sql`, seed yang telah ditinjau, lalu migration CMS tersebut. Untuk proyek saat ini yang schema dan seed-nya sudah ada, jalankan migration tambahan saja.

Tabel inti yang sudah ada:
- `site_settings`
- `anggota`
- `guru`
- `skills`
- `galeri`

Operasi database aplikasi dilakukan dari server Astro. Jangan mengirim service-role key ke browser.

### 4. Generate seed SQL dan daftar upload media

Setelah schema disiapkan (atau kapan saja sebelum seed), jalankan dari root proyek:

```bash
npm run migrate:data
```

Perintah ini **tidak terkoneksi ke Supabase** dan tidak mengunggah file. Script hanya membaca `src/data/G.json`, lalu menghasilkan:

- `migrations/seed.generated.sql` — perintah INSERT/UPSERT untuk `site_settings`, `anggota`, `guru`, `skills`, dan `galeri`.
- `migrations/media-manifest.json` — daftar sumber file lokal, path object target di bucket, lokasi referensi kode, dan status apakah file sumber ditemukan dalam arsip.

Tinjau kedua file tersebut sebelum digunakan. Selanjutnya:

1. Jika seed belum pernah dijalankan pada proyek baru, buka `migrations/seed.generated.sql` di Supabase SQL Editor setelah schema dasar berhasil. Untuk database proyek saat ini yang sudah berisi data, jangan jalankan seed ulang hanya untuk mengaktifkan CMS.
2. Manifest media adalah catatan migrasi sumber lama. Media yang sudah berhasil dipindahkan ke Supabase tidak perlu diunggah ulang.
3. Manifest snapshot arsip awal mencatat 26 referensi media yang file binernya tidak disertakan dalam ZIP sumber. Pada proyek Termux berjalan, file lokal telah dipindahkan ke backup dan media telah berhasil diunggah ke Supabase Storage. Karena itu, **jangan mengulang upload 26 media lama** hanya karena manifest arsip mencatat file sumber missing.
4. Seed SQL lama mengubah path media yang dikenal menjadi referensi `storage://...`. Lapisan data server mengubah referensi tersebut menjadi URL publik Storage. URL eksternal yang valid tetap dipertahankan. Upload media baru melalui CMS akan otomatis mengindeks file di media library.

Seed memakai UPSERT untuk kunci unik (NIS, nama guru/skill, dan path galeri), sehingga dapat dijalankan ulang setelah ditinjau. Seed tidak menghapus row tambahan yang dibuat kemudian.

### 5. Konfigurasi deployment Vercel

1. Push proyek ke repository Git yang terhubung ke Vercel.
2. Di Vercel, buka **Project → Settings → Environment Variables**.
3. Tambahkan `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_STORAGE_BUCKET`, `ADMIN_PASSWORD`, dan `ADMIN_SESSION_SECRET` untuk environment yang dipakai (Production, Preview, Development sesuai kebutuhan).
4. Simpan lalu redeploy.
5. Jangan menaruh secret di prefiks `PUBLIC_`.

Untuk pengembangan lokal, isi `.env` dan jalankan `npm run dev`. Untuk deployment, isi environment variable melalui Vercel, bukan mengunggah `.env`.

### 6. Masuk dan mengganti password admin

- URL panel: `/pengembang/admin`.
- Login dibandingkan di server dengan `ADMIN_PASSWORD`.
- Sesi disimpan di cookie `HttpOnly`, `SameSite=Strict`, dan ditandatangani HMAC memakai `ADMIN_SESSION_SECRET`. Masa berlaku sesi maksimum 8 jam.
- Ubah `ADMIN_PASSWORD` di `.env` lokal atau Environment Variables Vercel, lalu restart/redeploy. Disarankan mengganti `ADMIN_SESSION_SECRET` bersamaan agar semua sesi lama tidak berlaku.
- Pastikan password kuat dan jangan membagikannya. Panel memiliki operasi tambah/edit/hapus anggota dan upload media. Endpoint admin memeriksa sesi; URL API tidak dapat digunakan hanya dengan mengetahui alamatnya.

### 7. CMS: modul dan batasan yang diketahui

Dashboard `/pengembang/admin` menyediakan dashboard ringkasan, CRUD anggota, galeri, konten global, koleksi guru/keahlian, pengaturan section, tampilan, navigasi, SEO per halaman, media library, backup, dan pemulihan revisi. Rincian integrasi setiap modul tersedia di `docs/CMS-IMPLEMENTATION.md`.

Halaman publik tetap memakai fallback dari `src/data/G.json` ketika Supabase tidak tersedia. Referensi lama `/assets/...` yang sudah tidak tersedia dinetralkan agar tidak menghasilkan request 404.

Pengaturan identitas, hero, visi-misi, statistik, prestasi, wali kelas, profil developer, TKJ, countdown, sosial media, footer, dan tampilan disimpan di JSONB `site_settings`. Data anggota, guru, keahlian, dan galeri tetap memakai tabel relasional yang sudah ada. Metadata SEO per halaman, navigasi, section, media, revisi, dan aktivitas menggunakan tabel tambahan dari migration CMS.

Media library menampilkan metadata `media_assets` dan mencoba menemukan objek Storage lama yang belum terindeks. Angka ukuran yang ditampilkan adalah total file yang berhasil dibaca/diindeks, bukan kuota total bucket Supabase. Backup JSON tidak berisi binary media; file media tetap berada di Supabase Storage.

Penyimpanan CMS saat ini langsung dipublikasikan ke halaman publik pada request berikutnya (SSR). Fitur draft/preview publik terpisah belum diterapkan. Revisi konten dapat dipulihkan dari menu Sistem. Penggantian password admin tetap mengikuti mekanisme `ADMIN_PASSWORD` melalui environment variable; form ganti password mandiri belum tersedia.

### 8. Perubahan pada `astro.config.mjs`

Sebelumnya proyek tidak memasang adapter server dan menggunakan konfigurasi build tanpa server output. Refactor ini mengubah konfigurasi menjadi:

- `output: 'server'` agar halaman dapat membaca data Supabase saat request dan route API dapat berjalan.
- `adapter: vercel()` dari `@astrojs/vercel` agar build server Astro kompatibel dengan deployment Vercel.
- `site`, `compressHTML`, dan nama folder aset build `_astro` tetap dipertahankan.

Perubahan ini membuat halaman Astro berjalan melalui server runtime Vercel, bukan seluruh halaman dihasilkan sebagai static-only output. File statis di `public/` tetap disajikan sebagai aset statis.

## Daftar file refactor (untuk review diff)

### Diubah

- `.gitignore` — mengabaikan file environment lokal dan `.vercel`.
- `astro.config.mjs` — mengaktifkan server output dan adapter Vercel.
- `package.json` — menambahkan dependency `@astrojs/vercel`, `@supabase/supabase-js`, dan script `migrate:data`.
- `public/404.html` — mencoba memakai logo global dari API settings, fallback ke file statis lama.
- `public/offline.html` — mencoba memakai logo global dari API settings, fallback ke file statis lama.
- `public/audio-player.html` — menggunakan URL audio global dari API settings saat tersedia.
- `src/components/Header.astro` — mengambil logo dan tahun ajaran melalui data-access.
- `src/components/LogoLightbox.astro` — memakai URL logo global.
- `src/components/Footer.astro` — mengambil pengaturan situs dan tautan sosial melalui data-access.
- `src/layouts/Layout.astro` — mengambil metadata/OG settings melalui data-access.
- `src/pages/anggota.astro` — mengambil anggota dari data-access dan menyematkan payload aman untuk script browser.
- `src/pages/galeri.astro` — mengambil galeri dari data-access.
- `src/pages/index.astro` — mengambil statistik dan guru dari data-access.
- `src/pages/keahlian.astro` — mengambil skills dari data-access.
- `src/pages/pengembang.astro` — mengambil profil/skills dari data-access.
- `src/pages/struktur.astro` — mengambil struktur organisasi dari data-access.
- `src/pages/tkj.astro` — mengambil konten jurusan dari data-access.
- `src/scripts/anggota.js` — membaca JSON hasil render server, tidak lagi mengimpor data fallback secara langsung ke browser.
- `src/scripts/beranda.js` dan `src/scripts/alat.js` — mengambil slogan dari DOM hasil render server, bukan dari import JSON di client.
- `src/scripts/pengaturan.js` — diganti compatibility stub karena dataset duplikat legacy sudah dipensiunkan; fallback tunggal tetap `src/data/G.json`.

### Ditambahkan

- `.env.example` — nama variabel yang perlu diisi, tanpa nilai rahasia.
- `README.md` — panduan setup dan daftar perubahan.
- `docs/AUDIT.md` — catatan audit hardcoded data dan referensi media.
- `migrations/schema.sql` — skema Postgres/Supabase dan instruksi bucket.
- `scripts/migrate-data.mjs` — generator seed SQL dan manifest media.
- `src/env.d.ts` — deklarasi tipe environment variable.
- `src/lib/supabase.ts` — inisialisasi server-side Supabase client.
- `src/lib/data.ts` — query `getSettings`, `getAnggota`, `getGaleri`, `getSiteData` dan fallback lokal.
- `src/lib/admin-auth.ts` — verifikasi password dan cookie sesi HMAC.
- `src/pages/api/admin/login.ts` — endpoint login admin.
- `src/pages/api/admin/logout.ts` — endpoint logout admin.
- `src/pages/api/admin/anggota.ts` — API list/create/update/delete anggota.
- `src/pages/api/admin/media.ts` — API upload foto/galeri/logo/audio ke Supabase Storage.
- `src/pages/api/admin/settings.ts` — API baca/perbarui pengaturan umum yang diizinkan.
- `src/pages/api/public/settings.ts` — API publik terbatas untuk URL media global.
- `src/pages/pengembang/admin.astro` — UI panel admin.
- `migrations/seed.generated.sql` — seed SQL hasil generator pada snapshot data saat refactor.
- `migrations/media-manifest.json` — daftar media dan status file pada snapshot arsip.

File asli lain dipertahankan; tidak ada folder source asli yang sengaja dihapus. Folder `public/assets/*` dan file `src/data/G.json` tetap ada agar fallback dan struktur lama tidak hilang.

## Implementasi CMS tambahan (1 November 2026)

Paket perubahan CMS ini menambahkan migration `migrations/20261101_cms.sql`, panduan `docs/CMS-IMPLEMENTATION.md`, editor dashboard modular, endpoint admin konten/navigasi/section/SEO/media/backup/revisi, dan integrasi halaman publik. Terapkan migration CMS satu kali sebelum login ke dashboard versi baru. `package-lock.json` sekarang tidak dikecualikan oleh `.gitignore` agar dapat ikut dikomit untuk deployment yang reproducible.
