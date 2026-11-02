# CMS TKJ XI-9: panduan implementasi

## Aktivasi database

Database inti proyek sudah berisi tabel `site_settings`, `anggota`, `guru`, `skills`, dan `galeri`. Untuk mengaktifkan endpoint dan dashboard CMS tambahan, jalankan **sekali** file `migrations/20261101_cms.sql` melalui Supabase SQL Editor.

Migration ini bersifat additive. Migration menambah kolom `anggota.visible`, `anggota.skills`, metadata galeri, serta tabel:

- `site_pages`: metadata SEO dan konten terstruktur per halaman.
- `site_navigation`: menu publik.
- `site_sections`: visibilitas dan urutan section yang sudah ada di markup.
- `media_assets`: metadata file Storage.
- `content_revisions`: versi snapshot pengaturan global dan metadata halaman.
- `admin_audit_logs`: catatan aktivitas CMS.

Tabel lama tidak dihapus. Seed navigasi dan section memakai route yang benar-benar ada pada proyek saat audit.

## Modul dashboard

| Modul admin | Data/API | Integrasi publik |
|---|---|---|
| Dashboard | `/api/admin/cms` | Ringkasan jumlah record, ukuran metadata media, koneksi, aktivitas |
| Anggota | tabel `anggota`, `/api/admin/anggota` | `/anggota`, `/struktur`, `/pengembang` melalui data-access |
| Galeri | tabel `galeri`, `/api/admin/gallery` | `/galeri` |
| Konten & profil | `site_settings.value`, `/api/admin/content` | Beranda, header, footer, struktur, TKJ, developer |
| Guru & keahlian | tabel `guru` dan `skills`, `/api/admin/collections` | Beranda dan halaman keahlian |
| Section | `site_sections`, `/api/admin/sections` | Visibilitas/urutan section yang terdaftar di migration |
| Tampilan & media | `site_settings.media` dan `.appearance`, `/api/admin/content`, `/api/admin/media` | Logo, favicon, background, tema, aksen, warna latar, OG dan audio |
| Navigasi | `site_navigation`, `/api/admin/navigation` | `HamburgerMenu.astro` |
| SEO | `site_pages`, `/api/admin/pages` | `Layout.astro` membaca title, description, OG image dan robots |
| Media library | `media_assets` + Storage, `/api/admin/media` | Referensi file yang dipakai halaman dan pengaturan |
| Sistem | `/api/admin/backup`, `/api/admin/revisions` | Export/import data dan pulihkan snapshot |

Semua endpoint admin baru memverifikasi sesi admin melalui mekanisme autentikasi yang telah ada. Client tidak menerima Supabase service-role key.

## Konten yang bisa dikelola

### Pengaturan global (`site_settings.value`)

- `namaKelas`, `jurusan`, `namaSekolah`, `tahunAjaran`, `motto`, `baseUrl`, `deskripsi`, `sloganHero`.
- `hero`: `eyebrow`, `schoolPrefix`, `highlight`, `classLabel`, `primaryText`, `primaryHref`, `secondaryText`, `secondaryHref`.
- `visi`, `misi`, `waliKelas`, `masdo`, `stats`, `prestasi`, `tkj`, `countdown`, `sosmed`, `footer`.
- `media`: `logo_url`, `alternate_logo_url`, `favicon_url`, `og_url` (jika digunakan), `audio_url`, `audio_volume`.
- `appearance`: `theme` (`dark`, `light`, `blue`), `accent_color`, `background_color`, `background_image_url`.

Field daftar terstruktur seperti `stats`, `prestasi`, `tkj`, `countdown`, `sosmed`, dan `footer` diedit sebagai JSON. Pertahankan bentuk object/array yang sudah ditampilkan di editor. Tidak ada HTML atau JavaScript arbitrer yang dieksekusi dari database.

### Metadata halaman (`site_pages.content`)

Halaman yang didukung: `/`, `/anggota`, `/galeri`, `/struktur`, `/keahlian`, `/tkj`, `/pengembang`.

Kunci konten yang sudah dipakai markup saat ini meliputi `eyebrow`, `headline`, `intro`, `featuredEyebrow`, `featuredTitle`, `collectionEyebrow`, `collectionTitle`, `footerNote`, `subjectsTitle`, `curriculumTitle`, `careersTitle`, `teachersEyebrow`, `teachersTitle`, dan `devIntroText`.

### Section

Section hanya dapat diatur jika sudah ada di markup Astro. CMS tidak dapat membuat section atau komponen visual baru secara dinamis. Untuk menambah struktur/desain baru tetap diperlukan perubahan source code.

## Media dan Storage

- Default bucket aplikasi dan script migrasi/upload adalah `astro`.
- Upload mendukung gambar, audio, dan PDF dengan batas 20 MB per file.
- Path file dibuat unik agar upload baru tidak menimpa file lama.
- Fitur “Ganti file” mempertahankan object path/URL lama dan mensyaratkan ekstensi sama.
- Hapus media memeriksa referensi pada anggota, galeri, pengaturan, dan konten halaman; jika pemeriksaan gagal atau media masih direferensikan, penghapusan dibatalkan.
- File legacy Storage yang belum punya row `media_assets` tetap ditampilkan sebagai item tidak terindeks dan dapat dimasukkan ke indeks lewat edit metadata.
- Penghapusan item galeri tidak menghapus file Storage. File tetap terlihat di Media Library sampai dihapus secara terpisah dan tidak lagi direferensikan.

## Publikasi dan revisi

Simpan di dashboard berarti langsung memperbarui database dan halaman SSR menggunakan nilai baru pada request berikutnya. Draft/publish terpisah dan preview publik tokenized belum tersedia. Riwayat menyimpan snapshot pengaturan global dan SEO/konten halaman; admin dapat memulihkan versi terdahulu.

Backup JSON berisi baris database/metadata CMS, bukan binary object Storage. Import melakukan upsert dan tidak menghapus baris yang tidak ada dalam file backup.

## Batas yang belum disediakan

- Form ganti password admin mandiri. Password tetap diubah melalui mekanisme environment `ADMIN_PASSWORD` yang sudah ada.
- Kuota total bucket Storage. Dashboard menghitung file yang ditemukan melalui listing Storage dan metadata yang terindeks, tetapi tidak menampilkan batas kuota akun Supabase. Listing dibatasi dan dapat memberi peringatan jika pemindaian tidak lengkap.
- Editor visual bebas untuk seluruh paragraf dan setiap heading panjang yang masih tertulis langsung di markup, terutama isi detail/timeline cerita developer. Field pembuka/intro dan metadata halaman sudah dapat dikelola; konten statis lain perlu pemetaan tambahan jika memang akan sering diubah.
- Preview draft sebelum publish.

## Pengujian sesudah penerapan

1. Jalankan migration CMS sekali di Supabase.
2. Jalankan `npm run build` di lingkungan Termux dengan versi Node yang digunakan proyek.
3. Jalankan server lokal, login ke `/pengembang/admin`, dan buka dashboard.
4. Uji simpan satu field hero, lalu muat ulang beranda untuk memeriksa hasil publik.
5. Uji tambah/edit/sembunyikan/hapus satu anggota percobaan.
6. Uji upload satu foto galeri, edit metadata, sembunyikan, lalu tampilkan lagi.
7. Uji upload logo/audio baru dan periksa header/player.
8. Uji ubah label/urutan navigasi, warna aksen, favicon, dan SEO.
9. Uji media library: edit metadata, ganti file dengan ekstensi yang sama, dan pastikan file yang masih dipakai tidak dapat dihapus.
10. Uji export backup dan pemulihan satu revisi.

Jangan menganggap deployment Vercel berhasil sebelum ada build/deployment aktual dan verifikasi URL produksi.
