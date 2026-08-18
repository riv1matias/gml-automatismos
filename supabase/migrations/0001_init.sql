-- ============================================================================
-- GML Portal - esquema inicial
-- Ejecutar en el SQL editor de Supabase (o via supabase db push)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Perfiles de socio (1 solo rol por ahora, pero se deja el campo "role"
--    para poder abrir mas roles el dia de mañana sin migrar de nuevo)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'socio',
  force_password_change boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id)
);

alter table public.profiles enable row level security;

-- cualquier socio autenticado puede ver la lista de socios (para el modulo de usuarios)
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- un socio puede actualizar su propio perfil (ej. marcar que ya cambio la clave)
create policy "profiles_update_self"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- 2. Modulos (hoy solo "comprobantes", pensado para crecer)
-- ---------------------------------------------------------------------------
create table if not exists public.modules (
  code text primary key,
  name text not null,
  description text,
  enabled boolean not null default true,
  sort_order int not null default 0
);

insert into public.modules (code, name, description, sort_order)
values ('comprobantes', 'Automatismo Comprobantes', 'Genera el archivo final de compras a partir del comprobante crudo de AFIP', 1)
on conflict (code) do nothing;

alter table public.modules enable row level security;
create policy "modules_select_authenticated"
  on public.modules for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 3. Archivos base versionados (Proveedores, Plantilla, y los que se agreguen)
--    Cada upload crea una fila nueva. Solo una version por tipo queda is_active.
-- ---------------------------------------------------------------------------
create table if not exists public.base_file_versions (
  id uuid primary key default gen_random_uuid(),
  file_type text not null check (file_type in ('proveedores', 'plantilla')),
  version_number int not null,
  storage_path text not null,
  original_filename text not null,
  is_active boolean not null default true,
  uploaded_by uuid not null references public.profiles (id),
  uploaded_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by uuid references public.profiles (id),
  row_count int,
  notes text
);

create index if not exists base_file_versions_type_active_idx
  on public.base_file_versions (file_type, is_active);

alter table public.base_file_versions enable row level security;
create policy "base_file_versions_select_authenticated"
  on public.base_file_versions for select to authenticated using (true);
create policy "base_file_versions_insert_authenticated"
  on public.base_file_versions for insert to authenticated with check (true);
create policy "base_file_versions_update_authenticated"
  on public.base_file_versions for update to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 4. Corridas del modulo Comprobantes (cada procesamiento = 1 corrida versionada)
-- ---------------------------------------------------------------------------
create table if not exists public.comprobantes_runs (
  id uuid primary key default gen_random_uuid(),
  period text not null,                     -- ej "202608"
  version_number int not null,              -- version dentro del mismo period (reprocesos)
  input_storage_path text not null,
  input_original_filename text not null,
  output_storage_path text,
  status text not null default 'processing' check (status in ('processing','done','error')),
  row_count int,
  warnings jsonb not null default '[]'::jsonb,
  error_message text,
  proveedores_version_id uuid references public.base_file_versions (id),
  plantilla_version_id uuid references public.base_file_versions (id),
  processed_by uuid not null references public.profiles (id),
  processed_at timestamptz not null default now()
);

create index if not exists comprobantes_runs_period_idx on public.comprobantes_runs (period, version_number);

alter table public.comprobantes_runs enable row level security;
create policy "comprobantes_runs_select_authenticated"
  on public.comprobantes_runs for select to authenticated using (true);
create policy "comprobantes_runs_insert_authenticated"
  on public.comprobantes_runs for insert to authenticated with check (true);
create policy "comprobantes_runs_update_authenticated"
  on public.comprobantes_runs for update to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 5. Auditoria general (login, subidas, procesos, descargas, alta/reset usuarios)
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id),
  actor_email text,
  action text not null,           -- 'login' | 'upload_base_file' | 'archive_base_file' |
                                   -- 'process_comprobantes' | 'download_result' |
                                   -- 'create_user' | 'reset_password' | 'change_password'
  entity text,                    -- 'base_file_versions' | 'comprobantes_runs' | 'profiles'
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_actor_idx on public.audit_log (actor_id);
create index if not exists audit_log_action_idx on public.audit_log (action);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;
create policy "audit_log_select_authenticated"
  on public.audit_log for select to authenticated using (true);
create policy "audit_log_insert_authenticated"
  on public.audit_log for insert to authenticated with check (true);

-- ---------------------------------------------------------------------------
-- 6. Trigger: crear perfil automaticamente cuando se crea un usuario en auth.users
--    (se usa tanto para el primer admin como para altas hechas por la Admin API)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, force_password_change)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    coalesce((new.raw_user_meta_data ->> 'force_password_change')::boolean, true)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 7. Storage buckets (privados: se accede siempre via signed URL desde el server)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('base-files', 'base-files', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', false)
on conflict (id) do nothing;

-- Las politicas de storage.objects se manejan por service role desde las API routes
-- (no se expone el bucket directo al cliente), por eso no hace falta abrir policies
-- adicionales para 'authenticated' aca. Si mas adelante se quiere leer directo desde
-- el browser, agregar policies especificas por bucket.
