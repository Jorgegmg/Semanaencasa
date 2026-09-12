import React from "react";

const T = { paper: "#EEF1EC", surface: "#fff", ink: "#19312F", soft: "#5E7472", faint: "#93A6A3", line: "#D5DED9", accent: "#2E6E63", alert: "#A32D3C", aviso: "#C07A1E" };

export default function Inicio({ familia, socio, editor, pendientes, miembros, cambios, onDeshacer, ir, nuevaFamilia }) {
  const hoy = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  const hace = (t) => {
    const m = Math.round((Date.now() - new Date(t).getTime()) / 60000);
    if (m < 1) return "ahora mismo";
    if (m < 60) return `hace ${m} min`;
    const h = Math.round(m / 60);
    if (h < 24) return `hace ${h} h`;
    return `hace ${Math.round(h / 24)} días`;
  };

  const Tarjeta = ({ titulo, texto, insignia, color, onClick }) => (
    <button
      onClick={onClick}
      style={{
        width: "100%", textAlign: "left", background: T.surface, border: `1px solid ${T.line}`,
        borderLeft: `4px solid ${color || T.accent}`, borderRadius: 12, padding: "14px 16px",
        cursor: "pointer", font: "inherit", display: "flex", alignItems: "center", gap: 12,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: T.ink, marginBottom: 2 }}>{titulo}</div>
        <div style={{ fontSize: 12.5, color: T.soft, lineHeight: 1.35 }}>{texto}</div>
      </div>
      {insignia != null && insignia > 0 && (
        <span style={{ background: T.aviso, color: "#fff", fontSize: 12, fontWeight: 700, minWidth: 22, height: 22, borderRadius: 11, display: "grid", placeItems: "center", padding: "0 6px" }}>
          {insignia}
        </span>
      )}
    </button>
  );

  return (
    <div style={{ padding: "18px 14px 24px", maxWidth: 560, margin: "0 auto" }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 12, color: T.faint, textTransform: "none" }}>{hoy}</div>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.5, margin: "2px 0 0" }}>
          Hola{socio && socio.nombre ? `, ${socio.nombre}` : ""}
        </h1>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <Tarjeta
          titulo="Qué toca hoy"
          texto="Horas, quién lleva, quién recoge y los recordatorios del día"
          onClick={() => ir("hoy")}
        />
        <Tarjeta
          titulo={editor ? "Organizar la semana" : "Ver la semana"}
          texto={editor ? "Horarios, extraescolares y quién lleva y recoge" : "Consulta el plan; para cambiar algo, manda una petición"}
          onClick={() => ir("semana")}
        />
        <Tarjeta
          titulo={editor ? "Peticiones y sugerencias" : "Pedir un cambio"}
          texto={editor ? "Lo que pide el resto de la casa" : "Avisar de que no puedes un día o proponer algo"}
          insignia={editor ? pendientes : 0}
          color={pendientes > 0 && editor ? T.aviso : T.accent}
          onClick={() => ir("peticiones")}
        />
        <Tarjeta
          titulo="Personas y accesos"
          texto={`${miembros} en la casa · el código para invitar está aquí`}
          onClick={() => ir("personas")}
        />
      </div>

      {cambios && cambios.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 10px" }}>Últimos cambios</h2>
          <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, overflow: "hidden" }}>
            {cambios.map((c, i) => (
              <div key={c.id} style={{ padding: "11px 14px", borderTop: i ? `1px solid #EDF2EF` : "none", display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.35 }}>{c.resumen}</div>
                  <div style={{ fontSize: 11.5, color: T.faint, marginTop: 2 }}>{hace(c.creado)}</div>
                </div>
                {editor && i === 0 && c.datos_antes && (
                  <button
                    onClick={() => onDeshacer(c.id)}
                    style={{ border: `1px solid ${T.line}`, background: T.surface, borderRadius: 7, padding: "6px 11px", font: "inherit", fontSize: 12.5, cursor: "pointer", color: T.ink, flexShrink: 0 }}
                  >
                    Deshacer
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {editor && (
        <div style={{ marginTop: 22, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 16 }}>
          <strong style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 6 }}>Empezar de cero</strong>
          <p style={{ fontSize: 12.5, color: T.soft, margin: "0 0 10px", lineHeight: 1.45 }}>
            Borra la semana de ejemplo y monta la tuya: quiénes sois, horarios de colegio y de trabajo.
          </p>
          <button
            onClick={nuevaFamilia}
            style={{ border: `1px solid ${T.line}`, background: T.surface, borderRadius: 8, padding: "9px 14px", font: "inherit", fontSize: 13, cursor: "pointer", color: T.ink }}
          >
            Configurar la semana desde cero
          </button>
        </div>
      )}

      <p style={{ fontSize: 11.5, color: T.faint, marginTop: 20, textAlign: "center" }}>
        {familia ? familia.nombre : ""}{editor ? " · organizas la semana" : " · solo lectura"}
      </p>
    </div>
  );
}
