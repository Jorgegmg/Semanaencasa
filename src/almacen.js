import { supabase } from "./supabase";

/*  El planificador guarda con window.storage.get / .set.
 *  Aquí sustituimos esa pieza por la base de datos, con la misma forma,
 *  para no tener que tocar ni una línea de plan-familiar.jsx.          */

let ctx = { familiaId: null, puedeEditar: false, userId: null };
export const configurarAlmacen = (c) => { ctx = { ...ctx, ...c }; };

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
      const { error } = await supabase
        .from("planes")
        .upsert({ familia_id: ctx.familiaId, datos, actualizado: new Date().toISOString(), actualizado_por: ctx.userId }, { onConflict: "familia_id" });
      if (error) throw error;
      return { key: "plan", value, shared: true };
    },

    async delete() { return null; },
    async list() { return { keys: ["plan"], shared: true }; },
  };
}

/* deja constancia del cambio: es la base de los avisos */
export async function anotarCambio(resumen) {
  if (!ctx.familiaId || !ctx.puedeEditar) return;
  await supabase.from("cambios").insert({ familia_id: ctx.familiaId, user_id: ctx.userId, resumen });
}
