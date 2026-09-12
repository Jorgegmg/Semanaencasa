-- ============================================================
--  La semana en casa — esquema y permisos
--  Pégalo entero en Supabase: SQL Editor > New query > Run
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- tablas ----------

create table if not exists familias (
  id      uuid primary key default gen_random_uuid(),
  nombre  text not null,
  codigo  text not null unique default upper(substring(encode(gen_random_bytes(6),'hex') from 1 for 6)),
  creada  timestamptz not null default now()
);

create table if not exists miembros (
  familia_id uuid not null references familias(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  nombre     text,
  rol        text not null default 'lector' check (rol in ('editor','lector')),
  alta       timestamptz not null default now(),
  primary key (familia_id, user_id)
);

create table if not exists planes (
  familia_id      uuid primary key references familias(id) on delete cascade,
  datos           jsonb not null default '{}'::jsonb,
  actualizado     timestamptz not null default now(),
  actualizado_por uuid references auth.users(id)
);

-- histórico: es lo que permitirá avisar de los cambios
create table if not exists cambios (
  id         bigserial primary key,
  familia_id uuid not null references familias(id) on delete cascade,
  user_id    uuid references auth.users(id),
  resumen    text,
  creado     timestamptz not null default now()
);
create index if not exists cambios_familia_idx on cambios(familia_id, creado desc);

-- ---------- funciones de control ----------
-- security definer para que consultar "miembros" no vuelva a disparar RLS
-- sobre la propia tabla miembros (bucle infinito clásico)

create or replace function es_miembro(f uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from miembros where familia_id = f and user_id = auth.uid());
$$;

create or replace function es_editor(f uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from miembros where familia_id = f and user_id = auth.uid() and rol = 'editor');
$$;

-- crear familia y quedar dentro como editor, en un solo paso
create or replace function crear_familia(p_nombre text, p_mi_nombre text)
returns uuid language plpgsql security definer set search_path = public as $$
declare nueva uuid;
begin
  insert into familias (nombre) values (p_nombre) returning id into nueva;
  insert into miembros (familia_id, user_id, nombre, rol) values (nueva, auth.uid(), p_mi_nombre, 'editor');
  insert into planes (familia_id, datos, actualizado_por) values (nueva, '{}'::jsonb, auth.uid());
  return nueva;
end; $$;

-- unirse con el código que comparte la familia; entra como lector
create or replace function unirse_con_codigo(p_codigo text, p_mi_nombre text)
returns uuid language plpgsql security definer set search_path = public as $$
declare f uuid;
begin
  select id into f from familias where codigo = upper(trim(p_codigo));
  if f is null then raise exception 'Código no válido'; end if;
  insert into miembros (familia_id, user_id, nombre, rol)
  values (f, auth.uid(), p_mi_nombre, 'lector')
  on conflict (familia_id, user_id) do nothing;
  return f;
end; $$;

-- ---------- RLS ----------

alter table familias enable row level security;
alter table miembros enable row level security;
alter table planes   enable row level security;
alter table cambios  enable row level security;

drop policy if exists fam_ver on familias;
create policy fam_ver on familias for select using (es_miembro(id));
drop policy if exists fam_editar on familias;
create policy fam_editar on familias for update using (es_editor(id));

drop policy if exists mi_ver on miembros;
create policy mi_ver on miembros for select using (es_miembro(familia_id));
drop policy if exists mi_gestionar on miembros;
create policy mi_gestionar on miembros for update using (es_editor(familia_id));
drop policy if exists mi_quitar on miembros;
create policy mi_quitar on miembros for delete using (es_editor(familia_id) or user_id = auth.uid());

-- el plan: todos los de la familia lo leen, solo los editores lo escriben
drop policy if exists pl_ver on planes;
create policy pl_ver on planes for select using (es_miembro(familia_id));
drop policy if exists pl_crear on planes;
create policy pl_crear on planes for insert with check (es_editor(familia_id));
drop policy if exists pl_editar on planes;
create policy pl_editar on planes for update using (es_editor(familia_id));

drop policy if exists ca_ver on cambios;
create policy ca_ver on cambios for select using (es_miembro(familia_id));
drop policy if exists ca_crear on cambios;
create policy ca_crear on cambios for insert with check (es_editor(familia_id));

-- ---------- avisos en vivo ----------
alter publication supabase_realtime add table planes;
