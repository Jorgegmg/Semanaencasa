-- ============================================================
--  Recordatorios de actividad: quién confirma que lo lleva
--  Supabase > SQL Editor > New query > Run
-- ============================================================

-- El recordatorio en sí viaja dentro del plan (lo pone quien organiza).
-- Aquí solo guardamos las confirmaciones, porque las hace cualquiera
-- de la casa y cambian cada día.

create table if not exists hechos (
  familia_id      uuid not null references familias(id) on delete cascade,
  recordatorio_id text not null,
  fecha           date not null,
  user_id         uuid references auth.users(id),
  autor           text,
  creado          timestamptz not null default now(),
  primary key (familia_id, recordatorio_id, fecha)
);

alter table hechos enable row level security;

drop policy if exists he_ver on hechos;
create policy he_ver on hechos for select using (es_miembro(familia_id));

-- también la abuela puede confirmar que lleva la mochila
drop policy if exists he_crear on hechos;
create policy he_crear on hechos for insert with check (es_miembro(familia_id) and user_id = auth.uid());

drop policy if exists he_deshacer on hechos;
create policy he_deshacer on hechos for delete using (user_id = auth.uid() or es_editor(familia_id));

do $$ begin
  alter publication supabase_realtime add table hechos;
exception when duplicate_object then null;
end $$;
