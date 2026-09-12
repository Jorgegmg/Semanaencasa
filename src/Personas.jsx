import React, { useEffect, useState } from "react";
import { supabase } from "./supabase";

const T = { paper: "#EEF1EC", surface: "#fff", ink: "#19312F", soft: "#5E7472", faint: "#93A6A3", line: "#D5DED9", accent: "#2E6E63", alert: "#A32D3C" };

export default function Personas({ familia, familiaId, editor, userId, alCambiar }) {
  const [gente, setGente] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [copiado, setCopiado] = useState("");

  const cargar = async () => {
    const { data } = await supabase.from("miembros").select("user_id, nombre, rol, alta").eq("familia_id", familiaId).order("alta");
    setGente(data || []);
    setCargando(false);
  };
  useEffect(() => { cargar(); }, [familiaId]);

  const cambiarRol = async (uid, rol) => {
    await supabase.from("miembros").update({ rol }).eq("familia_id", familiaId).eq("user_id", uid);
    cargar();
    if (alCambiar) alCambiar();
  };
  const quitar = async (uid) => {
    await supabase.from("miembros").delete().eq("familia_id", familiaId).eq("user_id", uid);
    cargar();
  };

  const copiar = async (txt, que) => {
    try { await navigator.clipboard.writeText(txt); setCopiado(que); setTimeout(() => setCopiado(""), 1800); } catch (e) {}
  };

  const enlace = typeof window !== "undefined" ? window.location.origin : "";
  const invitacion = familia
    ? `Te paso el acceso al plan de la semana.\n\n1. Entra en ${enlace}\n2. Crea tu cuenta con tu correo\n3. Cuando te lo pida, mete este código de familia: ${familia.codigo}`
    : "";

  const boton = (p) => ({ border: p ? 0 : `1px solid ${T.line}`, background: p ? T.accent : T.surface, color: p ? "#fff" : T.ink, borderRadius: 8, padding: "8px 13px", font: "inherit", fontSize: 13, fontWeight: p ? 600 : 400, cursor: "pointer" });

  return (
    <div style={{ padding: "18px 14px 24px", maxWidth: 560, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 18px" }}>Personas y accesos</h1>

      {/* código de familia */}
      {familia && (
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <strong style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 3 }}>Código de la familia</strong>
          <p style={{ fontSize: 12.5, color: T.soft, margin: "0 0 11px", lineHeight: 1.45 }}>
            Quien lo use entrará como lector: ve la semana pero no la cambia. Luego puedes darle permiso aquí abajo.
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <code style={{ fontSize: 22, fontWeight: 700, letterSpacing: 4, background: "#F1F5F2", border: `1px solid ${T.line}`, borderRadius: 9, padding: "9px 16px", color: T.ink }}>
              {familia.codigo}
            </code>
            <button onClick={() => copiar(familia.codigo, "codigo")} style={boton(false)}>
              {copiado === "codigo" ? "Copiado" : "Copiar código"}
            </button>
          </div>
          <button onClick={() => copiar(invitacion, "texto")} style={{ ...boton(false), marginTop: 10 }}>
            {copiado === "texto" ? "Copiado, ya lo puedes pegar" : "Copiar el mensaje de invitación"}
          </button>
        </div>
      )}

      {/* miembros */}
      <h2 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 10px" }}>En esta casa</h2>
      {cargando ? (
        <p style={{ color: T.faint, fontSize: 13 }}>Cargando…</p>
      ) : (
        <div style={{ display: "grid", gap: 9 }}>
          {gente.map((m) => {
            const yo = m.user_id === userId;
            return (
              <div key={m.user_id} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 14.5, fontWeight: 600 }}>{m.nombre || "Sin nombre"}</strong>
                  {yo && <span style={{ fontSize: 11, color: T.faint }}>tú</span>}
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: m.rol === "editor" ? T.accent : T.soft, background: m.rol === "editor" ? "#E4EFEA" : "#F1F5F2", borderRadius: 10, padding: "2px 9px" }}>
                    {m.rol === "editor" ? "organiza" : "solo mira"}
                  </span>
                </div>

                {editor && !yo && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <button onClick={() => cambiarRol(m.user_id, m.rol === "editor" ? "lector" : "editor")} style={boton(false)}>
                      {m.rol === "editor" ? "Dejar en solo lectura" : "Dejar que organice"}
                    </button>
                    <button onClick={() => quitar(m.user_id)} style={{ ...boton(false), color: T.alert, borderColor: "rgba(163,45,60,.35)" }}>
                      Sacar de la familia
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editor && (
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 16, marginTop: 20 }}>
          <strong style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 6 }}>Cómo se añade alguien</strong>
          <p style={{ fontSize: 12.5, color: T.soft, margin: 0, lineHeight: 1.5 }}>
            Cada persona crea su propia cuenta con su correo y entra con el código de arriba. No se pueden crear cuentas
            ajenas desde aquí: haría falta una clave de administrador, y esa clave no puede estar en una web sin que
            cualquiera pueda cogerla. Si alguien no se apaña, puedes darle de alta desde Supabase, en Authentication,
            con la opción de invitar por correo.
          </p>
        </div>
      )}
    </div>
  );
}
