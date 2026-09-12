import React, { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { leerPlan } from "./almacen";

const T = { paper: "#EEF1EC", surface: "#fff", ink: "#19312F", soft: "#5E7472", faint: "#93A6A3", line: "#D5DED9", accent: "#2E6E63", alert: "#A32D3C", aviso: "#C07A1E" };
const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const fmt = (h) => {
  const H = Math.floor(h + 1e-9);
  return `${String(H).padStart(2, "0")}:${String(Math.round((h - H) * 60)).padStart(2, "0")}`;
};
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* la semana tipo más las excepciones de esa semana concreta */
const claveSemana = (d) => {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return iso(x);
};
function bloquesDe(plan, fecha) {
  const w = ((plan.weeks || {})[claveSemana(fecha)]) || {};
  const quitados = w.removed || [];
  const edits = w.edits || {};
  const base = plan.blocks
    .filter((b) => !quitados.includes(b.id))
    .map((b) => (edits[b.id] ? { ...b, ...edits[b.id], _exc: true } : b));
  return [...base, ...(w.extra || []).map((b) => ({ ...b, _exc: true }))];
}

export default function Hoy({ familiaId, socio, userId }) {
  const [plan, setPlan] = useState(null);
  const [notas, setNotas] = useState([]);
  const [nota, setNota] = useState("");
  const [desplazamiento, setDesplazamiento] = useState(0); // 0 hoy, 1 mañana
  const [cargando, setCargando] = useState(true);

  const fecha = new Date();
  fecha.setDate(fecha.getDate() + desplazamiento);
  const indice = (fecha.getDay() + 6) % 7;

  const cargar = async () => {
    const [p, { data: n }] = await Promise.all([
      leerPlan(familiaId),
      supabase.from("notas").select("*").eq("familia_id", familiaId).eq("fecha", iso(fecha)).order("creada"),
    ]);
    setPlan(p);
    setNotas(n || []);
    setCargando(false);
  };
  useEffect(() => { setCargando(true); cargar(); }, [familiaId, desplazamiento]);

  const añadirNota = async () => {
    if (!nota.trim()) return;
    await supabase.from("notas").insert({ familia_id: familiaId, user_id: userId, autor: socio.nombre || "", fecha: iso(fecha), texto: nota.trim() });
    setNota("");
    cargar();
  };
  const borrarNota = async (id) => {
    await supabase.from("notas").delete().eq("id", id);
    cargar();
  };

  if (cargando) return <div style={{ padding: 40, textAlign: "center", color: T.faint }}>Cargando…</div>;

  const kids = plan ? plan.people.filter((p) => p.role === "child") : [];
  const byId = plan ? Object.fromEntries(plan.people.map((p) => [p.id, p])) : {};
  const fin = (b) => (b.type === "school" && b.short ? plan.schoolEndShort : b.end);

  const delDia = bloquesDe(plan, fecha);
  const jornadas = kids.map((k) => {
    const bs = delDia
      .filter((b) => b.active && b.personId === k.id && b.day === indice)
      .sort((a, b) => a.start - b.start);
    return { kid: k, bloques: bs };
  });

  const titulo = desplazamiento === 0 ? "Hoy" : "Mañana";
  const subtitulo = fecha.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div style={{ padding: "18px 14px 24px", maxWidth: 560, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 3 }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: -0.7, margin: 0 }}>{titulo}</h1>
        <span style={{ flex: 1 }} />
        <button
          onClick={() => setDesplazamiento(desplazamiento === 0 ? 1 : 0)}
          style={{ border: `1px solid ${T.line}`, background: T.surface, borderRadius: 8, padding: "7px 13px", font: "inherit", fontSize: 13.5, cursor: "pointer", color: T.ink }}
        >
          {desplazamiento === 0 ? "Ver mañana" : "Volver a hoy"}
        </button>
      </div>
      <p style={{ fontSize: 14, color: T.soft, margin: "0 0 20px" }}>{subtitulo}</p>

      {!plan && <p style={{ color: T.faint }}>Todavía no hay ninguna semana montada.</p>}

      {/* una tarjeta por niña, con lo justo y en grande */}
      <div style={{ display: "grid", gap: 12 }}>
        {jornadas.map(({ kid, bloques }) => (
          <div key={kid.id} style={{ background: T.surface, border: `1px solid ${T.line}`, borderLeft: `5px solid ${kid.color}`, borderRadius: 12, padding: "15px 17px" }}>
            <div style={{ fontSize: 19, fontWeight: 600, color: kid.color, marginBottom: bloques.length ? 12 : 0 }}>{kid.name}</div>

            {bloques.length === 0 && <div style={{ fontSize: 16, color: T.faint }}>Hoy no tiene nada.</div>}

            {bloques.map((b, i) => {
              const lleva = b.dropoffBy ? byId[b.dropoffBy] : null;
              const recoge = b.pickupBy ? byId[b.pickupBy] : null;
              const traslado = b.type === "school" || b.type === "activity" || b.type === "other";
              return (
                <div key={b.id} style={{ paddingTop: i ? 12 : 0, marginTop: i ? 12 : 0, borderTop: i ? `1px solid #EDF2EF` : "none" }}>
                  <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>
                    {b.label || (b.type === "school" ? "Colegio" : "Actividad")}
                    {b.short && <span style={{ fontSize: 13, color: T.aviso, fontWeight: 600, marginLeft: 8 }}>jornada matinera</span>}
                    {b._exc && <span style={{ fontSize: 12.5, color: T.aviso, fontWeight: 600, marginLeft: 8 }}>cambio de esta semana</span>}
                  </div>

                  {traslado ? (
                    <div style={{ display: "grid", gap: 7 }}>
                      <Linea hora={fmt(b.start)} verbo="La lleva" persona={lleva} />
                      <Linea hora={fmt(fin(b))} verbo="La recoge" persona={recoge} />
                    </div>
                  ) : (
                    <div style={{ fontSize: 16, color: T.soft }}>
                      {fmt(b.start)} a {fmt(fin(b))}
                      {b.withId && byId[b.withId] ? ` · con ${byId[b.withId].name}` : ""}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* notas del día */}
      <div style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 10px" }}>Recordatorios del día</h2>

        {notas.length > 0 && (
          <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
            {notas.map((n) => (
              <div key={n.id} style={{ background: "#FBF7EC", border: "1px solid #E6DCC4", borderRadius: 10, padding: "11px 13px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15.5, lineHeight: 1.4, color: T.ink }}>{n.texto}</div>
                  <div style={{ fontSize: 11.5, color: T.faint, marginTop: 3 }}>{n.autor || "Alguien"}</div>
                </div>
                <button onClick={() => borrarNota(n.id)} style={{ border: 0, background: "transparent", color: T.faint, font: "inherit", fontSize: 12, cursor: "pointer", padding: 2 }}>
                  Quitar
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && añadirNota()}
            placeholder="Mochila de piscina, cumpleaños…"
            style={{ flex: 1, minWidth: 0, padding: 11, fontSize: 15, border: `1px solid ${T.line}`, borderRadius: 9, fontFamily: "inherit", background: T.surface, color: T.ink, boxSizing: "border-box" }}
          />
          <button
            onClick={añadirNota}
            disabled={!nota.trim()}
            style={{ border: 0, background: T.accent, color: "#fff", borderRadius: 9, padding: "11px 17px", font: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: nota.trim() ? 1 : 0.5 }}
          >
            Apuntar
          </button>
        </div>
      </div>
    </div>
  );
}

function Linea({ hora, verbo, persona }) {
  const falta = !persona;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
      <span style={{ fontSize: 19, fontWeight: 700, fontVariantNumeric: "tabular-nums", minWidth: 62, color: T.ink }}>{hora}</span>
      <span style={{ fontSize: 15, color: T.soft }}>{verbo}</span>
      <span
        style={{
          fontSize: 15.5, fontWeight: 600,
          color: falta ? T.alert : "#fff",
          background: falta ? "transparent" : persona.color,
          border: falta ? `1.5px dashed ${T.alert}` : "none",
          borderRadius: 14, padding: "3px 12px",
        }}
      >
        {falta ? "sin decidir" : persona.name}
      </span>
    </div>
  );
}
