-- ============================================================
--  Notas del día y deshacer
--  Supabase > SQL Editor > New query > Run
-- ============================================================

-- ---------- notas ----------
-- "mañana lleva la mochila de piscina": en la práctica se usa más
-- que los horarios, porque los horarios ya se los saben

create table if not exists notas (
  id         bigserial primary key,
  familia_id uuid not null references familias(id) on delete cascade,
  user_id    uuid references auth.users(id),
  autor      text,
  fecha      date not null default current_date,
  texto      text not null,
  creada     timestamptz not null default now()
);
create index if not exists notas_familia_idx on notas(familia_id, fecha);

alter table notas enable row level security;

-- cualquiera de la casa puede dejar una nota, también la abuela
drop policy if exists no_ver on notas;
create policy no_ver on notas for select using (es_miembro(familia_id));
drop policy if exists no_crear on notas;
create policy no_crear on notas for insert with check (es_miembro(familia_id) and user_id = auth.uid());
drop policy if exists no_borrar on notas;
create policy no_borrar on notas for delete using (user_id = auth.uid() or es_editor(familia_id));

-- ---------- deshacer ----------
-- guardamos cómo estaba la semana ANTES de cada cambio:
-- deshacer es simplemente volver a escribir eso

alter table cambios add column if not exists datos_antes jsonb;

-- ---------- avisos en vivo ----------
do $$ begin
  alter publication supabase_realtime add table notas;
exception when duplicate_object then null;
end $$;
