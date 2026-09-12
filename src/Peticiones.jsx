import React, { useEffect, useState } from "react";
import { supabase } from "./supabase";

const T = { paper: "#EEF1EC", surface: "#fff", ink: "#19312F", soft: "#5E7472", faint: "#93A6A3", line: "#D5DED9", accent: "#2E6E63", alert: "#A32D3C", aviso: "#C07A1E" };
const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const ESTADO = {
  pendiente: { texto: "Pendiente", color: T.aviso, fondo: "#FBF0DC" },
  aceptada: { texto: "Aceptada", color: T.accent, fondo: "#E4EFEA" },
  rechazada: { texto: "No puede ser", color: T.alert, fondo: "#F6E4E4" },
};

export default function Peticiones({ familiaId, socio, editor, userId, alCambiar }) {
  const [lista, setLista] = useState([]);
  const [texto, setTexto] = useState("");
  const [dia, setDia] = useState("");
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState("");

  const cargar = async () => {
    const { data, error } = await supabase.from("peticiones").select("*").eq("familia_id", familiaId).order("creada", { ascending: false });
    if (!error) setLista(data || []);
    setCargando(false);
  };

  useEffect(() => { cargar(); }, [familiaId]);

  const enviar = async () => {
    if (!texto.trim()) return;
    setEnviando(true); setMsg("");
    const { error } = await supabase.from("peticiones").insert({
      familia_id: familiaId, user_id: userId, autor: socio.nombre || "", texto: texto.trim(), dia: dia || null,
    });
    setEnviando(false);
    if (error) return setMsg(error.message);
    setTexto(""); setDia("");
    cargar();
    if (alCambiar) alCambiar();
  };

  const resolver = async (id, estado) => {
    await supabase.from("peticiones").update({ estado, resuelta: new Date().toISOString() }).eq("id", id);
    cargar();
    if (alCambiar) alCambiar();
  };

  const retirar = async (id) => {
    await supabase.from("peticiones").delete().eq("id", id);
    cargar();
    if (alCambiar) alCambiar();
  };

  const campo = { width: "100%", padding: 10, fontSize: 15, border: `1px solid ${T.line}`, borderRadius: 8, fontFamily: "inherit", boxSizing: "border-box", background: T.surface, color: T.ink };
  const pendientes = lista.filter((p) => p.estado === "pendiente");
  const resueltas = lista.filter((p) => p.estado !== "pendiente");

  return (
    <div style={{ padding: "18px 14px 24px", maxWidth: 560, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 4px" }}>Peticiones</h1>
      <p style={{ fontSize: 13, color: T.soft, margin: "0 0 18px", lineHeight: 1.45 }}>
        {editor
          ? "Lo que pide el resto de la casa. Al aceptar algo, acuérdate de reflejarlo en la semana."
          : "Aquí avisas de que un día no puedes, o propones un cambio. Quien organiza la semana lo verá."}
      </p>

      {/* formulario */}
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 16, marginBottom: 22 }}>
        <span style={{ fontSize: 12, color: T.soft, display: "block", marginBottom: 5 }}>Qué quieres pedir</span>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="El jueves no puedo recoger a las 17:00, ¿puede ir la abuela?"
          style={{ ...campo, height: 82, resize: "vertical", marginBottom: 10, fontSize: 14 }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <select value={dia} onChange={(e) => setDia(e.target.value)} style={{ ...campo, width: "auto", flex: 1 }}>
            <option value="">Sin día concreto</option>
            {DIAS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <button
            onClick={enviar}
            disabled={enviando || !texto.trim()}
            style={{ border: 0, background: T.accent, color: "#fff", borderRadius: 8, padding: "10px 18px", font: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: enviando || !texto.trim() ? 0.55 : 1 }}
          >
            Enviar
          </button>
        </div>
        {msg && <p style={{ fontSize: 12.5, color: T.alert, margin: "10px 0 0" }}>{msg}</p>}
      </div>

      {cargando ? (
        <p style={{ color: T.faint, fontSize: 13 }}>Cargando…</p>
      ) : (
        <>
          {pendientes.length > 0 && (
            <>
              <h2 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 10px" }}>Sin resolver</h2>
              <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
                {pendientes.map((p) => (
                  <Ficha key={p.id} p={p} editor={editor} userId={userId} onResolver={resolver} onRetirar={retirar} />
                ))}
              </div>
            </>
          )}

          {pendientes.length === 0 && (
            <p style={{ fontSize: 13, color: T.faint, textAlign: "center", padding: "16px 0" }}>No hay nada pendiente.</p>
          )}

          {resueltas.length > 0 && (
            <>
              <h2 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 10px" }}>Ya resueltas</h2>
              <div style={{ display: "grid", gap: 10 }}>
                {resueltas.slice(0, 12).map((p) => (
                  <Ficha key={p.id} p={p} editor={editor} userId={userId} onResolver={resolver} onRetirar={retirar} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Ficha({ p, editor, userId, onResolver, onRetirar }) {
  const e = ESTADO[p.estado] || ESTADO.pendiente;
  const fecha = new Date(p.creada).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  const boton = (color) => ({ border: `1px solid ${color}`, background: "transparent", color, borderRadius: 7, padding: "6px 12px", font: "inherit", fontSize: 12.5, fontWeight: 600, cursor: "pointer" });

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderLeft: `4px solid ${e.color}`, borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 13, fontWeight: 600 }}>{p.autor || "Alguien"}</strong>
        {p.dia && <span style={{ fontSize: 11.5, color: T.soft, background: "#F1F5F2", borderRadius: 10, padding: "1px 8px" }}>{p.dia}</span>}
        <span style={{ fontSize: 11.5, color: e.color, background: e.fondo, borderRadius: 10, padding: "1px 8px", fontWeight: 600 }}>{e.texto}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: T.faint }}>{fecha}</span>
      </div>

      <p style={{ fontSize: 14, margin: "0 0 10px", lineHeight: 1.45, color: T.ink }}>{p.texto}</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {editor && p.estado === "pendiente" && (
          <>
            <button onClick={() => onResolver(p.id, "aceptada")} style={boton(T.accent)}>Aceptar</button>
            <button onClick={() => onResolver(p.id, "rechazada")} style={boton(T.alert)}>No puede ser</button>
          </>
        )}
        {(p.user_id === userId || editor) && p.estado !== "pendiente" && (
          <button onClick={() => onRetirar(p.id)} style={{ ...boton(T.faint), fontWeight: 400 }}>Quitar</button>
        )}
        {p.user_id === userId && p.estado === "pendiente" && !editor && (
          <button onClick={() => onRetirar(p.id)} style={{ ...boton(T.faint), fontWeight: 400 }}>Retirar</button>
        )}
      </div>
    </div>
  );
}
