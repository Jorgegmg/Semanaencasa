import React, { useState } from "react";
import { supabase } from "./supabase";

const T = { paper: "#EEF1EC", surface: "#fff", ink: "#19312F", soft: "#5E7472", faint: "#93A6A3", line: "#D5DED9", accent: "#2E6E63", alert: "#A32D3C" };

export default function Acceso() {
  const [modo, setModo] = useState("entrar"); // entrar | crear | olvido
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState("");
  const [cargando, setCargando] = useState(false);

  const enviar = async () => {
    setMsg("");
    setCargando(true);
    try {
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
        if (error) throw error;
      } else if (modo === "crear") {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password: pass });
        if (error) throw error;
        setMsg("Cuenta creada. Si te pide confirmar el correo, revisa tu bandeja antes de entrar.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
        if (error) throw error;
        setMsg("Te he mandado un enlace para cambiar la contraseña.");
      }
    } catch (e) {
      const t = String(e.message || e);
      setMsg(
        t.includes("Invalid login") ? "Ese correo o esa contraseña no cuadran." :
        t.includes("already registered") ? "Ese correo ya tiene cuenta. Entra con tu contraseña." :
        t.includes("at least") ? "La contraseña necesita al menos 6 caracteres." : t
      );
    }
    setCargando(false);
  };

  const Tab = ({ id, children }) => (
    <button
      onClick={() => { setModo(id); setMsg(""); }}
      style={{
        border: 0, background: "transparent", font: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer",
        padding: "5px 12px", borderRadius: 6, color: modo === id ? T.ink : T.faint,
        boxShadow: modo === id ? "0 1px 2px rgba(25,49,47,.14)" : "none", backgroundColor: modo === id ? T.surface : "transparent",
      }}
    >
      {children}
    </button>
  );

  return (
    <div style={{ minHeight: "100vh", background: T.paper, color: T.ink, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", display: "grid", placeItems: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <h1 style={{ fontSize: 25, fontWeight: 600, letterSpacing: -0.6, margin: "0 0 4px" }}>La semana en casa</h1>
        <p style={{ color: T.soft, fontSize: 14, marginTop: 0, marginBottom: 22 }}>
          El plan de la semana: horarios, quién lleva y quién recoge.
        </p>

        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 18 }}>
          <div style={{ display: "inline-flex", background: "#F6F8F5", border: `1px solid ${T.line}`, borderRadius: 8, padding: 2, gap: 2, marginBottom: 16 }}>
            <Tab id="entrar">Entrar</Tab>
            <Tab id="crear">Crear cuenta</Tab>
          </div>

          <label style={{ display: "block", marginBottom: 11 }}>
            <span style={{ fontSize: 12, color: T.soft, display: "block", marginBottom: 4 }}>Correo</span>
            <input
              type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && enviar()}
              style={{ width: "100%", padding: 10, fontSize: 15, border: `1px solid ${T.line}`, borderRadius: 8, fontFamily: "inherit", boxSizing: "border-box" }}
            />
          </label>

          {modo !== "olvido" && (
            <label style={{ display: "block", marginBottom: 14 }}>
              <span style={{ fontSize: 12, color: T.soft, display: "block", marginBottom: 4 }}>Contraseña</span>
              <input
                type="password" autoComplete={modo === "crear" ? "new-password" : "current-password"}
                value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === "Enter" && enviar()}
                style={{ width: "100%", padding: 10, fontSize: 15, border: `1px solid ${T.line}`, borderRadius: 8, fontFamily: "inherit", boxSizing: "border-box" }}
              />
            </label>
          )}

          <button
            onClick={enviar} disabled={cargando || !email}
            style={{ width: "100%", padding: 12, background: T.accent, color: "#fff", border: 0, borderRadius: 9, fontSize: 15, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", opacity: cargando || !email ? 0.6 : 1 }}
          >
            {cargando ? "Un momento…" : modo === "entrar" ? "Entrar" : modo === "crear" ? "Crear la cuenta" : "Mandarme el enlace"}
          </button>

          <button
            onClick={() => { setModo(modo === "olvido" ? "entrar" : "olvido"); setMsg(""); }}
            style={{ border: 0, background: "transparent", color: T.faint, fontSize: 12, fontFamily: "inherit", cursor: "pointer", marginTop: 10, padding: 0 }}
          >
            {modo === "olvido" ? "Volver a entrar" : "No recuerdo la contraseña"}
          </button>

          {msg && <p style={{ fontSize: 13, color: msg.startsWith("Te he") || msg.startsWith("Cuenta") ? T.accent : T.alert, marginBottom: 0, marginTop: 12 }}>{msg}</p>}
        </div>

        <p style={{ fontSize: 12, color: T.faint, marginTop: 16, lineHeight: 1.5 }}>
          Cada persona entra con su cuenta. Quien organiza la semana puede cambiarla; a quien le pasas el código de la familia, la ve pero no la toca.
        </p>
      </div>
    </div>
  );
}
