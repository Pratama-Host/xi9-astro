-- CMS extension for TKJ XI-9. Additive migration: existing rows and tables are preserved.

alter table public.anggota
  add column if not exists visible boolean not null default true,
  add column if not exists skills jsonb not null default '[]'::jsonb;

alter table public.galeri
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists category text not null default 'Kegiatan',
  add column if not exists taken_at date,
  add column if not exists alt_text text,
  add column if not exists visible boolean not null default true;

create table if not exists public.site_pages (
  slug text primary key,
  title text,
  description text,
  og_image text,
  noindex boolean not null default false,
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.site_navigation (
  id text primary key,
  label text not null,
  href text not null,
  icon text,
  sort_order integer not null default 0,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.site_sections (
  id text primary key,
  page_slug text not null,
  section_key text not null,
  label text not null,
  sort_order integer not null default 0,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (page_slug, section_key)
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  object_path text not null unique,
  public_url text not null,
  filename text not null,
  title text,
  alt_text text,
  category text not null default 'assets',
  mime_type text not null,
  size_bytes bigint not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_revisions (
  id uuid primary key default gen_random_uuid(),
  page_slug text not null,
  version integer not null,
  content jsonb not null default '{}'::jsonb,
  seo jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (page_slug, version)
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  entity text not null,
  entity_id text,
  summary text not null,
  created_at timestamptz not null default now()
);

create index if not exists site_navigation_order_idx on public.site_navigation (sort_order);
create index if not exists site_sections_page_order_idx on public.site_sections (page_slug, sort_order);
create index if not exists media_assets_category_created_idx on public.media_assets (category, created_at desc);
create index if not exists content_revisions_page_version_idx on public.content_revisions (page_slug, version desc);
create index if not exists admin_audit_logs_created_idx on public.admin_audit_logs (created_at desc);

alter table public.site_pages enable row level security;
alter table public.site_navigation enable row level security;
alter table public.site_sections enable row level security;
alter table public.media_assets enable row level security;
alter table public.content_revisions enable row level security;
alter table public.admin_audit_logs enable row level security;

-- All CMS writes and reads use the server-side service-role client.
grant all on table
  public.site_pages,
  public.site_navigation,
  public.site_sections,
  public.media_assets,
  public.content_revisions,
  public.admin_audit_logs
 to service_role;
grant all on table public.anggota, public.galeri to service_role;

-- Navigation mirrors the routes that already exist in the public website.
insert into public.site_navigation (id, label, href, icon, sort_order, enabled)
values
  ('home', 'Home', '/', 'fa-house', 0, true),
  ('developer', 'Developer', '/pengembang', 'fa-code', 1, true),
  ('struktur', 'Struktur', '/struktur', 'fa-sitemap', 2, true),
  ('anggota', 'Anggota', '/anggota', 'fa-users', 3, true),
  ('keahlian', 'Skills', '/keahlian', 'fa-code', 4, true),
  ('galeri', 'Galeri', '/galeri', 'fa-images', 5, true),
  ('tkj', 'TKJ', '/tkj', 'fa-network-wired', 6, true)
on conflict (id) do nothing;

-- Only sections that already exist in current Astro markup are listed here.
insert into public.site_sections (id, page_slug, section_key, label, sort_order, enabled)
values
  ('home.hero', '/', 'hero', 'Hero / Pembuka', 0, true),
  ('home.stats', '/', 'stats', 'Statistik kelas', 1, true),
  ('home.teachers', '/', 'teachers', 'Tim pengajar', 2, true),
  ('anggota.list', '/anggota', 'list', 'Daftar anggota', 0, true),
  ('galeri.featured', '/galeri', 'featured', 'Sorotan galeri', 0, true),
  ('galeri.grid', '/galeri', 'grid', 'Koleksi foto', 1, true),
  ('struktur.organization', '/struktur', 'organization', 'Struktur organisasi', 0, true),
  ('keahlian.list', '/keahlian', 'list', 'Daftar keahlian', 0, true),
  ('tkj.overview', '/tkj', 'overview', 'Pengenalan TKJ', 0, true),
  ('tkj.subjects', '/tkj', 'subjects', 'Mata pelajaran', 1, true),
  ('tkj.curriculum', '/tkj', 'curriculum', 'Alur kurikulum', 2, true),
  ('tkj.careers', '/tkj', 'careers', 'Prospek karier', 3, true),
  ('tkj.tools', '/tkj', 'tools', 'Alat bantu jaringan', 4, true),
  ('developer.story', '/pengembang', 'story', 'Profil dan cerita developer', 0, true)
on conflict (id) do nothing;

-- Seed SEO metadata from the existing page titles/descriptions, without inventing page content.
insert into public.site_pages (slug, title, description, noindex)
values
  ('/', 'TKJ XI-9 - Beranda | SMK Muhammadiyah Belitang', null, false),
  ('/anggota', 'Daftar Anggota Kelas XI-9 TKJ — SMK Muhammadiyah Belitang', 'Daftar lengkap seluruh siswa-siswi kelas TKJ XI-9 SMK Muhammadiyah Belitang beserta NIS, profil, dan informasi keanggotaan.', false),
  ('/galeri', 'Galeri & Kenangan Kelas XI-9 TKJ — SMK Muhammadiyah Belitang', 'Dokumentasi dan momen berharga kebersamaan keluarga besar kelas TKJ XI-9 SMK Muhammadiyah Belitang.', false),
  ('/struktur', 'Struktur Organisasi Kelas XI-9 TKJ — SMK Muhammadiyah Belitang', 'Bagan kepengurusan dan struktur organisasi kelas TKJ XI-9 SMK Muhammadiyah Belitang periode 2026/2027.', false),
  ('/keahlian', 'Kompetensi & Keahlian Siswa TKJ XI-9 — SMK Muhammadiyah Belitang', 'Bidang keahlian teknis jaringan komputer, server Linux, pemrograman web, dan keamanan siber yang dikuasai siswa TKJ XI-9.', false),
  ('/tkj', 'Jurusan Teknik Komputer & Jaringan — TKJ XI-9 SMK Muhammadiyah Belitang', 'Informasi program keahlian TKJ, mata pelajaran, alur kurikulum, prospek karir lulusan, dan alat bantu Subnet Calculator online.', false),
  ('/pengembang', 'Pengembang Website — TKJ XI-9 SMK Muhammadiyah Belitang', 'Profil pengembang dan perjalanan pembuatan website resmi kelas TKJ XI-9 SMK Muhammadiyah Belitang.', false)
on conflict (slug) do nothing;
