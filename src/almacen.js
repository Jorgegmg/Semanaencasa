import { supabase } from "./supabase";

/*  El planificador guarda con window.storage.get / .set.
 *  Aquí sustituimos esa pieza por la base de datos, con la misma forma,
 *  para no tener que tocar ni una línea de plan-familiar.jsx.          */

let ctx = { familiaId: null, puedeEditar: false, userId: null, nombre: "" };
export const configurarAlmacen = (c) => { ctx = { ...ctx, ...c }; };

const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const hora = (h) => {
  const H = Math.floor(h + 1e-9);
  return `${String(H).padStart(2, "0")}:${String(Math.round((h - H) * 60)).padStart(2, "0")}`;
};

/* compara dos versiones de la semana y lo cuenta en una frase */
function resumirCambio(antes, ahora) {
  if (!antes || !antes.blocks) return "montó la semana";
  const quien = (s, id) => {
    const p = (s.people || []).find((x) => x.id === id);
    return p ? p.name : "nadie";
  };
  const nom = (s, b) => b.label || (b.type === "school" ? "el colegio" : b.type === "activity" ? "una actividad" : "un bloque");
  const viejos = new Map(antes.blocks.map((b) => [b.id, b]));
  const nuevos = new Map(ahora.blocks.map((b) => [b.id, b]));
  const partes = [];

  for (const [id, b] of nuevos) {
    const v = viejos.get(id);
    if (!v) { partes.push(`anadio ${nom(ahora, b)}`.replace("anadio", "añadió")); continue; }
    if (v.start !== b.start || v.end !== b.end)
      partes.push(`movió ${nom(ahora, b)} del ${DIAS[b.day]} a las ${hora(b.start)}`);
    else if (v.dropoffBy !== b.dropoffBy)
      partes.push(`ahora ${quien(ahora, b.dropoffBy)} lleva a ${nom(ahora, b)} el ${DIAS[b.day]}`);
    else if (v.pickupBy !== b.pickupBy)
      partes.push(`ahora ${quien(ahora, b.pickupBy)} recoge de ${nom(ahora, b)} el ${DIAS[b.day]}`);
    else if (v.active !== b.active)
      partes.push(`${b.active ? "activó" : "quitó"} ${nom(ahora, b)} del ${DIAS[b.day]}`);
    else if (v.short !== b.short)
      partes.push(`${b.short ? "puso" : "quitó"} jornada matinera el ${DIAS[b.day]}`);
  }
  for (const [id, v] of viejos) if (!nuevos.has(id)) partes.push(`borró ${nom(antes, v)}`);
  if ((antes.people || []).length !== (ahora.people || []).length) partes.push("cambió las personas");

  if (!partes.length) return "ajustó la semana";
  return partes.length > 2 ? `${partes[0]} y ${partes.length - 1} cambios más` : partes.join(" y ");
}

export function instalarAlmacen() {
  window.storage = {
    async get() {
      if (!ctx.familiaId) return null;
      const { data, error } = await supabase.from("planes").select("datos").eq("familia_id", ctx.familiaId).maybeSingle();
      if (error) throw error;
      const vacio = !data || !data.datos || !data.datos.people;
      return vacio ? null : { key: "plan", value: JSON.stringify(data.datos), shared: true };
    },

    async set(_key, value) {
      if (!ctx.familiaId) return null;
      if (!ctx.puedeEditar) throw new Error("Solo lectura");
      const datos = typeof value === "string" ? JSON.parse(value) : value;

      // cómo estaba antes, para el registro y para poder deshacer
      const { data: previo } = await supabase.from("planes").select("datos").eq("familia_id", ctx.familiaId).maybeSingle();
      const antes = previo && previo.datos && previo.datos.people ? previo.datos : null;

      const { error } = await supabase
        .from("planes")
        .upsert({ familia_id: ctx.familiaId, datos, actualizado: new Date().toISOString(), actualizado_por: ctx.userId }, { onConflict: "familia_id" });
      if (error) throw error;

      try {
        await supabase.from("cambios").insert({
          familia_id: ctx.familiaId,
          user_id: ctx.userId,
          resumen: `${ctx.nombre || "Alguien"} ${resumirCambio(antes, datos)}`,
          datos_antes: antes,
        });
      } catch (e) { /* el registro es un extra: si falla, el plan ya está guardado */ }

      return { key: "plan", value, shared: true };
    },

    async delete() { return null; },
    async list() { return { keys: ["plan"], shared: true }; },
  };
}

/* últimos movimientos de la semana */
export async function ultimosCambios(familiaId, n = 5) {
  const { data } = await supabase
    .from("cambios")
    .select("id, resumen, creado, datos_antes, user_id")
    .eq("familia_id", familiaId)
    .order("creado", { ascending: false })
    .limit(n);
  return data || [];
}

/* deshacer: volver a escribir cómo estaba antes de ese cambio */
export async function deshacer(familiaId, cambioId, userId) {
  const { data: c } = await supabase.from("cambios").select("datos_antes").eq("id", cambioId).maybeSingle();
  if (!c || !c.datos_antes) return false;
  const { error } = await supabase
    .from("planes")
    .update({ datos: c.datos_antes, actualizado: new Date().toISOString(), actualizado_por: userId })
    .eq("familia_id", familiaId);
  return !error;
}

/* lee la semana sin pasar por el planificador (para la vista de hoy) */
export async function leerPlan(familiaId) {
  const { data } = await supabase.from("planes").select("datos").eq("familia_id", familiaId).maybeSingle();
  return data && data.datos && data.datos.people ? data.datos : null;
}
