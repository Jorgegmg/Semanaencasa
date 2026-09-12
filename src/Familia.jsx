import React, { useState } from "react";
import { supabase } from "./supabase";

const T = { paper: "#EEF1EC", surface: "#fff", ink: "#19312F", soft: "#5E7472", faint: "#93A6A3", line: "#D5DED9", accent: "#2E6E63", alert: "#A32D3C" };

export default function Familia({ email, onListo, onSalir }) {
  const [nombre, setNombre] = useState("");
  const [familia, setFamilia] = useState("Casa");
  const [codigo, setCodigo] = useState("");
  const [msg, setMsg] = useState("");
  const [cargando, setCargando] = useState(false);

  const crear = async () => {
    setCargando(true); setMsg("");
    const { data, error } = await supabase.rpc("crear_familia", { p_nombre: familia.trim() || "Casa", p_mi_nombre: nombre.trim() || email });
    setCargando(false);
    if (error) return setMsg(error.message);
    onListo(data);
  };

  const unirse = async () => {
    setCargando(true); setMsg("");
    const { data, error } = await supabase.rpc("unirse_con_codigo", { p_codigo: codigo, p_mi_nombre: nombre.trim() || email });
    setCargando(false);
    if (error) return setMsg(error.message.includes("Código") ? "Ese código no existe. Pídeselo a quien organiza la semana." : error.message);
    onListo(data);
  };

  const campo = { width: "100%", padding: 10, fontSize: 15, border: `1px solid ${T.line}`, borderRadius: 8, fontFamily: "inherit", boxSizing: "border-box", marginBottom: 11 };
  const boton = (primario) => ({ width: "100%", padding: 11, borderRadius: 9, fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", border: primario ? 0 : `1px solid ${T.line}`, background: primario ? T.accent : T.surface, color: primario ? "#fff" : T.ink });

  return (
    <div style={{ minHeight: "100vh", background: T.paper, color: T.ink, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", display: "grid", placeItems: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <h1 style={{ fontSize: 21, fontWeight: 600, margin: "0 0 16px" }}>Ya casi</h1>

        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 18, marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: T.soft, display: "block", marginBottom: 4 }}>Tu nombre, para que los demás sepan quién eres</span>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Jorge" style={campo} />

          <div style={{ borderTop: `1px solid #E8EEEA`, paddingTop: 14, marginTop: 4 }}>
            <strong style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 8 }}>Empezar una familia</strong>
            <input value={familia} onChange={(e) => setFamilia(e.target.value)} placeholder="Nombre de la casa" style={campo} />
            <button onClick={crear} disabled={cargando} style={boton(true)}>Crear y organizar la semana</button>
            <p style={{ fontSize: 12, color: T.faint, margin: "8px 0 0" }}>Entras como quien organiza: puedes cambiarlo todo.</p>
          </div>
        </div>

        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 18 }}>
          <strong style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 8 }}>Unirme a una familia</strong>
          <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="Código de 6 letras" maxLength={6} style={{ ...campo, letterSpacing: 2, fontWeight: 600, textAlign: "center" }} />
          <button onClick={unirse} disabled={cargando || codigo.length < 4} style={boton(false)}>Entrar con el código</button>
          <p style={{ fontSize: 12, color: T.faint, margin: "8px 0 0" }}>Verás la semana pero no podrás cambiarla.</p>
        </div>

        {msg && <p style={{ fontSize: 13, color: T.alert, marginTop: 14 }}>{msg}</p>}

        <button onClick={onSalir} style={{ border: 0, background: "transparent", color: T.faint, fontSize: 12, fontFamily: "inherit", cursor: "pointer", marginTop: 16, padding: 0 }}>
          Salir de la cuenta {email}
        </button>
      </div>
    </div>
  );
}
