import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabase";
import { configurarAlmacen } from "./almacen";
import Acceso from "./Acceso";
import Familia from "./Familia";
import Inicio from "./Inicio";
import Peticiones from "./Peticiones";
import Personas from "./Personas";
import PlanFamiliar from "./PlanFamiliar";

const T = { paper: "#EEF1EC", surface: "#fff", ink: "#19312F", soft: "#5E7472", faint: "#93A6A3", line: "#D5DED9", accent: "#2E6E63", alert: "#A32D3C", aviso: "#C07A1E" };

export default function App() {
  const [sesion, setSesion] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [socio, setSocio] = useState(null);
  const [familia, setFamilia] = useState(null);
  const [version, setVersion] = useState(0);
  const [aviso, setAviso] = useState("");
  const [vista, setVista] = useState("inicio");
  const [pendientes, setPendientes] = useState(0);
  const [cuantos, setCuantos] = useState(0);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSesion(data.session); setCargando(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSesion(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const contar = useCallback(async (fid) => {
    const [{ count: p }, { count: m }] = await Promise.all([
      supabase.from("peticiones").select("id", { count: "exact", head: true }).eq("familia_id", fid).eq("estado", "pendiente"),
      supabase.from("miembros").select("user_id", { count: "exact", head: true }).eq("familia_id", fid),
    ]);
    setPendientes(p || 0);
    setCuantos(m || 0);
  }, []);

  const cargarPertenencia = useCallback(async () => {
    if (!sesion) return;
    const { data } = await supabase.from("miembros").select("familia_id, rol, nombre, familias(nombre, codigo)").limit(1).maybeSingle();
    if (data) {
      setSocio(data);
      setFamilia(data.familias);
      configurarAlmacen({ familiaId: data.familia_id, puedeEditar: data.rol === "editor", userId: sesion.user.id });
      setVersion((v) => v + 1);
      contar(data.familia_id);
    } else setSocio(null);
  }, [sesion, contar]);

  useEffect(() => { cargarPertenencia(); }, [cargarPertenencia]);

  useEffect(() => {
    if (!socio) return;
    const canal = supabase
      .channel(`familia-${socio.familia_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "planes", filter: `familia_id=eq.${socio.familia_id}` }, (p) => {
        if (p.new && p.new.actualizado_por === sesion.user.id) return;
        setAviso("Alguien acaba de cambiar la semana.");
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "peticiones", filter: `familia_id=eq.${socio.familia_id}` }, () => contar(socio.familia_id))
      .subscribe();
    return () => supabase.removeChannel(canal);
  }, [socio, sesion, contar]);

  const salir = async () => { await supabase.auth.signOut(); setSocio(null); setFamilia(null); setVista("inicio"); };

  if (cargando) return <Centro texto="Abriendo…" />;
  if (!sesion) return <Acceso />;
  if (!socio) return <Familia email={sesion.user.email} onListo={cargarPertenencia} onSalir={salir} />;

  const editor = socio.rol === "editor";
  const secciones = [
    { id: "inicio", etiqueta: "Inicio" },
    { id: "semana", etiqueta: "Semana" },
    { id: "peticiones", etiqueta: editor ? "Peticiones" : "Pedir" },
    { id: "personas", etiqueta: "Personas" },
  ];

  const empezarDeCero = async () => {
    if (!window.confirm("Se borra la semana actual y empiezas de cero. ¿Seguimos?")) return;
    await supabase.from("planes").update({ datos: {}, actualizado_por: sesion.user.id }).eq("familia_id", socio.familia_id);
    setVersion((v) => v + 1);
    setVista("semana");
  };

  return (
    <div style={{ minHeight: "100vh", background: T.paper, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", paddingBottom: 62 }}>
      {/* barra de cuenta */}
      <div style={{ background: T.ink, color: "#fff", padding: "8px 14px", display: "flex", alignItems: "center", gap: 9, fontSize: 12.5 }}>
        <strong style={{ fontWeight: 600 }}>{familia ? familia.nombre : "Mi casa"}</strong>
        <span style={{ opacity: 0.6 }}>{socio.nombre || sesion.user.email}</span>
        {!editor && <span style={{ background: "rgba(255,255,255,.16)", padding: "1px 7px", borderRadius: 10, fontSize: 11 }}>solo lectura</span>}
        <span style={{ flex: 1 }} />
        <button onClick={() => setMenu(!menu)} style={{ border: 0, background: "transparent", color: "#fff", font: "inherit", cursor: "pointer", opacity: 0.85 }}>Cuenta</button>
      </div>

      {menu && (
        <div style={{ background: T.surface, borderBottom: `1px solid ${T.line}`, padding: 14, display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: T.soft, flex: 1, minWidth: 140 }}>{sesion.user.email}</span>
          <button onClick={() => { setMenu(false); setVista("personas"); }} style={{ border: `1px solid ${T.line}`, background: T.surface, borderRadius: 8, padding: "8px 13px", font: "inherit", fontSize: 13, cursor: "pointer" }}>
            Ver el código de familia
          </button>
          <button onClick={salir} style={{ border: `1px solid ${T.line}`, background: T.surface, borderRadius: 8, padding: "8px 13px", font: "inherit", fontSize: 13, cursor: "pointer" }}>Salir</button>
        </div>
      )}

      {aviso && (
        <div style={{ background: "#FBF0DC", borderBottom: "1px solid #E2C99A", padding: "9px 14px", display: "flex", gap: 10, alignItems: "center", fontSize: 13 }}>
          <span style={{ flex: 1 }}>{aviso}</span>
          <button onClick={() => { setAviso(""); setVersion((v) => v + 1); }} style={{ border: "1px solid #C07A1E", background: "transparent", color: "#8A5512", borderRadius: 7, padding: "5px 11px", font: "inherit", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
            Actualizar
          </button>
        </div>
      )}

      {/* contenido */}
      {vista === "inicio" && (
        <Inicio
          familia={familia} socio={socio} editor={editor} pendientes={pendientes} miembros={cuantos}
          resumenHoy={editor ? "Organizas la semana de la casa." : "Puedes consultar la semana y pedir cambios."}
          ir={setVista} nuevaFamilia={empezarDeCero}
        />
      )}

      {vista === "semana" && (
        <div style={{ pointerEvents: editor ? "auto" : "none" }}>
          <PlanFamiliar key={version} />
        </div>
      )}

      {vista === "peticiones" && (
        <Peticiones familiaId={socio.familia_id} socio={socio} editor={editor} userId={sesion.user.id} alCambiar={() => contar(socio.familia_id)} />
      )}

      {vista === "personas" && (
        <Personas familia={familia} familiaId={socio.familia_id} editor={editor} userId={sesion.user.id} alCambiar={cargarPertenencia} />
      )}

      {/* navegación */}
      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: T.surface, borderTop: `1px solid ${T.line}`, display: "flex", zIndex: 40 }}>
        {secciones.map((s) => {
          const on = vista === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setVista(s.id)}
              style={{
                flex: 1, border: 0, background: "transparent", font: "inherit", fontSize: 12, fontWeight: on ? 600 : 400,
                color: on ? T.accent : T.faint, padding: "13px 4px 15px", cursor: "pointer", position: "relative",
                borderTop: on ? `2px solid ${T.accent}` : "2px solid transparent", marginTop: -1,
              }}
            >
              {s.etiqueta}
              {s.id === "peticiones" && editor && pendientes > 0 && (
                <span style={{ position: "absolute", top: 7, right: "50%", marginRight: -26, background: T.aviso, color: "#fff", fontSize: 10.5, fontWeight: 700, minWidth: 17, height: 17, borderRadius: 9, display: "grid", placeItems: "center", padding: "0 4px" }}>
                  {pendientes}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function Centro({ texto }) {
  return <div style={{ minHeight: "100vh", background: T.paper, color: T.ink, display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif" }}>{texto}</div>;
}
