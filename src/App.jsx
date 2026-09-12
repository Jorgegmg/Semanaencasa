import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabase";
import { configurarAlmacen } from "./almacen";
import Acceso from "./Acceso";
import Familia from "./Familia";
import PlanFamiliar from "./PlanFamiliar";

const T = { paper: "#EEF1EC", surface: "#fff", ink: "#19312F", soft: "#5E7472", faint: "#93A6A3", line: "#D5DED9", accent: "#2E6E63", alert: "#A32D3C" };

export default function App() {
  const [sesion, setSesion] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [socio, setSocio] = useState(null);   // fila de miembros
  const [familia, setFamilia] = useState(null);
  const [version, setVersion] = useState(0);  // fuerza recarga del plan
  const [aviso, setAviso] = useState("");
  const [menu, setMenu] = useState(false);

  /* --- sesión --- */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSesion(data.session); setCargando(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSesion(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  /* --- a qué familia pertenezco y con qué papel --- */
  const cargarPertenencia = useCallback(async () => {
    if (!sesion) return;
    const { data } = await supabase.from("miembros").select("familia_id, rol, nombre, familias(nombre, codigo)").limit(1).maybeSingle();
    if (data) {
      setSocio(data);
      setFamilia(data.familias);
      configurarAlmacen({ familiaId: data.familia_id, puedeEditar: data.rol === "editor", userId: sesion.user.id });
      setVersion((v) => v + 1);
    } else {
      setSocio(null);
    }
  }, [sesion]);

  useEffect(() => { cargarPertenencia(); }, [cargarPertenencia]);

  /* --- si otro cambia el plan, aquí se entera --- */
  useEffect(() => {
    if (!socio) return;
    const canal = supabase
      .channel(`plan-${socio.familia_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "planes", filter: `familia_id=eq.${socio.familia_id}` }, (p) => {
        if (p.new && p.new.actualizado_por === sesion.user.id) return; // lo he cambiado yo
        setAviso("Alguien acaba de cambiar la semana.");
      })
      .subscribe();
    return () => supabase.removeChannel(canal);
  }, [socio, sesion]);

  const salir = async () => { await supabase.auth.signOut(); setSocio(null); setFamilia(null); };

  if (cargando) return <Centro texto="Abriendo…" />;
  if (!sesion) return <Acceso />;
  if (!socio) return <Familia email={sesion.user.email} onListo={cargarPertenencia} onSalir={salir} />;

  const editor = socio.rol === "editor";

  return (
    <div style={{ minHeight: "100vh", background: T.paper, fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      {/* barra de cuenta */}
      <div style={{ background: T.ink, color: "#fff", padding: "7px 14px", display: "flex", alignItems: "center", gap: 10, fontSize: 12.5 }}>
        <strong style={{ fontWeight: 600 }}>{familia ? familia.nombre : "Mi casa"}</strong>
        <span style={{ opacity: 0.65 }}>{socio.nombre || sesion.user.email}</span>
        {!editor && <span style={{ background: "rgba(255,255,255,.16)", padding: "1px 7px", borderRadius: 10, fontSize: 11 }}>solo lectura</span>}
        <span style={{ flex: 1 }} />
        <button onClick={() => setMenu(!menu)} style={{ border: 0, background: "transparent", color: "#fff", font: "inherit", cursor: "pointer", opacity: 0.85 }}>
          Cuenta
        </button>
      </div>

      {menu && (
        <div style={{ background: T.surface, borderBottom: `1px solid ${T.line}`, padding: 14, display: "grid", gap: 10 }}>
          {editor && familia && (
            <div>
              <span style={{ fontSize: 12, color: T.soft, display: "block", marginBottom: 4 }}>Código para invitar a la abuela o a la nani</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <code style={{ fontSize: 19, fontWeight: 700, letterSpacing: 3, background: "#F6F8F5", border: `1px solid ${T.line}`, borderRadius: 8, padding: "7px 12px", color: T.ink }}>
                  {familia.codigo}
                </code>
                <button
                  onClick={() => navigator.clipboard && navigator.clipboard.writeText(familia.codigo)}
                  style={{ border: `1px solid ${T.line}`, background: T.surface, borderRadius: 7, padding: "8px 12px", font: "inherit", fontSize: 13, cursor: "pointer" }}
                >
                  Copiar
                </button>
              </div>
              <p style={{ fontSize: 12, color: T.faint, margin: "6px 0 0" }}>Quien lo use verá la semana sin poder cambiarla.</p>
            </div>
          )}
          <button onClick={salir} style={{ border: `1px solid ${T.line}`, background: T.surface, borderRadius: 8, padding: 10, font: "inherit", fontSize: 13, cursor: "pointer", justifySelf: "start" }}>
            Salir de la cuenta
          </button>
        </div>
      )}

      {aviso && (
        <div style={{ background: "#FBF0DC", borderBottom: "1px solid #E2C99A", padding: "9px 14px", display: "flex", gap: 10, alignItems: "center", fontSize: 13 }}>
          <span style={{ flex: 1 }}>{aviso}</span>
          <button onClick={() => { setAviso(""); setVersion((v) => v + 1); }} style={{ border: `1px solid #C07A1E`, background: "transparent", color: "#8A5512", borderRadius: 7, padding: "5px 11px", font: "inherit", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
            Ver los cambios
          </button>
        </div>
      )}

      <div style={{ pointerEvents: editor ? "auto" : "none", opacity: editor ? 1 : 0.96 }}>
        <PlanFamiliar key={version} />
      </div>
    </div>
  );
}

function Centro({ texto }) {
  return <div style={{ minHeight: "100vh", background: T.paper, color: T.ink, display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif" }}>{texto}</div>;
}
