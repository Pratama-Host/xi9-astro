
-- TKJ XI-9 DATABASE SCHEMA

create extension if not exists pgcrypto;

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.anggota (
  id uuid primary key default gen_random_uuid(),
  nis text not null unique,
  nama text not null,
  kelas text not null default 'XI-9',
  jabatan text,
  deskripsi text,
  foto_url text,
  audio_url text,
  audio_nama text,
  foto_audio_url text,
  deskripsi_audio text,
  social jsonb not null default '{}'::jsonb,
  urutan integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guru (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique,
  mapel text,
  peran text,
  quote text,
  expertise jsonb not null default '[]'::jsonb,
  urutan integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique,
  level integer not null default 0
    check (level between 0 and 100),
  icon text,
  deskripsi text,
  urutan integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.galeri (
  id uuid primary key default gen_random_uuid(),
  src text not null unique,
  caption text,
  urutan integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists anggota_urutan_idx
  on public.anggota (urutan);

create index if not exists anggota_nama_idx
  on public.anggota (nama);

create index if not exists guru_urutan_idx
  on public.guru (urutan);

create index if not exists skills_urutan_idx
  on public.skills (urutan);

create index if not exists galeri_urutan_idx
  on public.galeri (urutan);

alter table public.site_settings enable row level security;
alter table public.anggota enable row level security;
alter table public.guru enable row level security;
alter table public.skills enable row level security;
alter table public.galeri enable row level security;

grant all on table
  public.site_settings,
  public.anggota,
  public.guru,
  public.skills,
  public.galeri
to service_role;

comment on table public.site_settings is
'Pengaturan situs dan media global.';

comment on table public.anggota is
'Data anggota siswa, NIS, jabatan, profil dan audio.';

comment on table public.guru is
'Data guru dan keahlian.';

comment on table public.skills is
'Data keterampilan siswa.';

comment on table public.galeri is
'Item galeri dan URL media di Supabase Storage.';
