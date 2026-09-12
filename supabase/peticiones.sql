-- ============================================================
--  Ampliación: peticiones y sugerencias
--  Pégalo en Supabase > SQL Editor > New query > Run
--  (el schema.sql inicial ya debe estar ejecutado)
-- ============================================================

create table if not exists peticiones (
  id          bigserial primary key,
  familia_id  uuid not null references familias(id) on delete cascade,
  user_id     uuid references auth.users(id),
  autor       text,
  texto       text not null,
  dia         text,
  estado      text not null default 'pendiente' check (estado in ('pendiente','aceptada','rechazada')),
  respuesta   text,
  creada      timestamptz not null default now(),
  resuelta    timestamptz
);
create index if not exists peticiones_familia_idx on peticiones(familia_id, estado, creada desc);

alter table peticiones enable row level security;

-- cualquiera de la familia puede pedir un cambio, también los lectores:
-- es justo lo que queremos de la abuela o la nani
drop policy if exists pe_ver on peticiones;
create policy pe_ver on peticiones for select using (es_miembro(familia_id));

drop policy if exists pe_crear on peticiones;
create policy pe_crear on peticiones for insert with check (es_miembro(familia_id) and user_id = auth.uid());

-- solo quien organiza la acepta o la rechaza; el autor puede retirar la suya
drop policy if exists pe_resolver on peticiones;
create policy pe_resolver on peticiones for update using (es_editor(familia_id));

drop policy if exists pe_retirar on peticiones;
create policy pe_retirar on peticiones for delete using (user_id = auth.uid() or es_editor(familia_id));

alter publication supabase_realtime add table peticiones;
