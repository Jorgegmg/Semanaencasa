import React, { useState, useEffect, useMemo, useCallback } from "react";

/* ================================================================== */
/*  La semana en casa — planificador de conciliación familiar         */
/* ================================================================== */

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DAYS_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const H_START = 7;
const H_END = 21;
const CORE = [8, 19];
const HOUR_H = 54;
const LANE_MIN = 74;
const RAIL = 30;
const STORE_KEY = "planfamiliar:v4";

/* --- tokens --- */
const T = {
  paper: "#EEF1EC",
  surface: "#FFFFFF",
  dim: "#F6F8F5",
  ink: "#19312F",
  soft: "#5E7472",
  faint: "#93A6A3",
  line: "#D5DED9",
  hair: "#E8EEEA",
  accent: "#2E6E63",
  alert: "#A32D3C",
  weekend: "#FBF7F0",
};

const TYPES = {
  school: { label: "Colegio", who: "child", transfer: true },
  activity: { label: "Extraescolar", who: "child", transfer: true },
  care: { label: "En casa", who: "child", transfer: false },
  work: { label: "Trabajo", who: "adult", transfer: false },
  other: { label: "Otro", who: "any", transfer: true },
};

const uid = () => Math.random().toString(36).slice(2, 9);
const fmt = (h) => {
  const H = Math.floor(h + 1e-9);
  const m = Math.round((h - H) * 60);
  return `${String(H).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};
const fmtH = (n) => {
  const r = Math.round(n * 100) / 100;
  return (Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/0$/, "").replace(".", ",")) + " h";
};
const TIMES = (() => {
  const o = [];
  for (let h = H_START; h <= H_END; h += 0.25) o.push(h);
  return o;
})();
const hexA = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

function withTags(people) {
  const firsts = {};
  people.forEach((p) => {
    const c = (p.name[0] || "?").toUpperCase();
    firsts[c] = (firsts[c] || 0) + 1;
  });
  const used = new Set();
  people.filter((p) => p.tag).forEach((p) => used.add(p.tag.toUpperCase()));
  return people.map((p) => {
    if (p.tag) return p;
    const c = (p.name[0] || "?").toUpperCase();
    let t = firsts[c] > 1 ? p.name.slice(0, 2) : c;
    t = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
    let n = 2;
    while (used.has(t.toUpperCase())) t = c + n++;
    used.add(t.toUpperCase());
    return { ...p, tag: t };
  });
}
const migrate = (s) => ({ ...s, people: withTags(s.people) });

/* resumen en texto plano, para mandar por mensaje */
function buildText(state) {
  const byId = Object.fromEntries(state.people.map((p) => [p.id, p]));
  const kids = state.people.filter((p) => p.role === "child");
  const end = (b) => (b.type === "school" && b.short ? state.schoolEndShort : b.end);
  const out = ["La semana en casa", ""];

  DAYS.forEach((dayName, d) => {
    const lines = [];
    kids.forEach((k) => {
      const bs = state.blocks.filter((b) => b.active && b.personId === k.id && b.day === d).sort((a, b) => a.start - b.start);
      bs.forEach((b) => {
        const who = [];
        if (TYPES[b.type].transfer) {
          who.push(b.dropoffBy ? `la lleva ${byId[b.dropoffBy].name}` : "SIN QUIEN LA LLEVE");
          who.push(b.pickupBy ? `la recoge ${byId[b.pickupBy].name}` : "SIN QUIEN LA RECOJA");
        } else if (b.type === "care" && b.withId) who.push(`con ${byId[b.withId].name}`);
        lines.push(`  ${k.name}: ${b.label || TYPES[b.type].label} ${fmt(b.start)}-${fmt(end(b))}${who.length ? " · " + who.join(" · ") : ""}`);
      });
      // huecos
      const seq = bs.map((b) => ({ s: b.start, e: end(b) }));
      for (let i = 0; i < seq.length - 1; i++)
        if (seq[i + 1].s > seq[i].e) lines.push(`  ⚠ ${k.name} sin cubrir de ${fmt(seq[i].e)} a ${fmt(seq[i + 1].s)}`);
    });
    if (!lines.length) return;
    out.push(state.blocks.some((b) => b.type === "school" && b.day === d && b.short) ? `${dayName.toUpperCase()} (jornada matinera)` : dayName.toUpperCase());
    out.push(...lines, "");
  });

  const adults = state.people.filter((p) => p.role === "adult");
  if (adults.length) {
    out.push("TRABAJO");
    adults.forEach((a) => {
      const w = state.blocks.filter((b) => b.active && b.type === "work" && b.personId === a.id).reduce((n, b) => n + (end(b) - b.start), 0);
      if (w) out.push(`  ${a.name}: ${fmtH(w)} a la semana${a.availability === "flexible" ? ", horario flexible" : ""}`);
    });
  }
  return out.join("\n");
}

async function copyText(txt) {
  try {
    await navigator.clipboard.writeText(txt);
    return true;
  } catch (e) {
    try {
      const ta = document.createElement("textarea");
      ta.value = txt;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (e2) {
      return false;
    }
  }
}

/* hoja imprimible independiente: el visor no deja imprimir desde dentro */
function buildPrintHTML(state) {
  const PH = 30; // alto de una hora en la hoja
  const byId = Object.fromEntries(state.people.map((p) => [p.id, p]));
  const kids = state.people.filter((p) => p.role === "child");
  const end = (b) => (b.type === "school" && b.short ? state.schoolEndShort : b.end);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const horas = Array.from({ length: H_END - H_START }, (_, i) => `<div class="h"><span>${fmt(H_START + i)}</span></div>`).join("");

  const dias = DAYS.map((dn, d) => {
    const matinera = state.blocks.some((b) => b.type === "school" && b.day === d && b.short);
    const carriles = kids
      .map((k) => {
        const bs = state.blocks.filter((b) => b.active && b.personId === k.id && b.day === d).sort((a, b) => a.start - b.start);
        const piezas = bs
          .map((b) => {
            const e = end(b);
            const alto = Math.max(20, (e - b.start) * PH - 2);
            const t = TYPES[b.type].transfer;
            const banda = (pid, arriba) => {
              const p = pid ? byId[pid] : null;
              return `<div class="bd ${arriba ? "up" : "dn"}" style="background:${p ? p.color : "#A32D3C"}">${p ? esc(p.tag) : "?"}</div>`;
            };
            return `<div class="bk" style="top:${(b.start - H_START) * PH + 1}px;height:${alto}px;background:${hexA(k.color, 0.13)};border-color:${hexA(k.color, 0.35)}">
              ${t ? banda(b.dropoffBy, true) : ""}
              <div class="bt" style="color:${k.color}">${esc(b.label || TYPES[b.type].label)}<br><span>${fmt(b.start)}-${fmt(e)}</span></div>
              ${t ? banda(b.pickupBy, false) : ""}
            </div>`;
          })
          .join("");
        const huecos = bs
          .map((b, i) => {
            if (i === bs.length - 1) return "";
            const e = end(b);
            return bs[i + 1].start > e
              ? `<div class="gp" style="top:${(e - H_START) * PH + 1}px;height:${(bs[i + 1].start - e) * PH - 2}px">sin cubrir</div>`
              : "";
          })
          .join("");
        return `<div class="ln">${piezas}${huecos}</div>`;
      })
      .join("");

    const trabajo = state.people
      .filter((p) => p.role === "adult")
      .map((p, i, arr) => {
        const w = state.blocks.filter((b) => b.active && b.type === "work" && b.personId === p.id && b.day === d);
        return w
          .map(
            (b) =>
              `<div class="wk" style="left:${(i * 100) / arr.length}%;width:${100 / arr.length - 4}%;top:${(b.start - H_START) * PH + 1}px;height:${(end(b) - b.start) * PH - 2}px;background:${hexA(p.color, 0.55)}"></div>`
          )
          .join("");
      })
      .join("");

    return `<div class="dy">
      <div class="dh">${dn}${matinera ? '<em class="mt">matinera</em>' : ""}</div>
      <div class="kh">${kids.map((k) => `<span style="color:${k.color};background:${hexA(k.color, 0.1)};border-top-color:${k.color}">${esc(k.name)}</span>`).join("")}<span class="tw">trabajo</span></div>
      <div class="bd0">${carriles}<div class="rl">${trabajo}</div></div>
    </div>`;
  }).join("");

  const leyenda = state.people
    .map((p) => `<span><i style="background:${p.color}"></i>${esc(p.tag)} ${esc(p.name)}</span>`)
    .join("");

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>La semana en casa</title>
<style>
  @page{size:A4 landscape;margin:8mm}
  *{box-sizing:border-box}
  body{margin:0;padding:14px;font-family:'IBM Plex Sans',system-ui,sans-serif;color:#19312F;background:#fff}
  h1{font-size:17px;margin:0 0 2px;font-weight:600}
  .sub{font-size:11px;color:#93A6A3;margin-bottom:10px}
  .no-print{margin-bottom:12px}
  .no-print button{font:inherit;font-size:13px;padding:8px 14px;border-radius:7px;border:1px solid #2E6E63;background:#2E6E63;color:#fff;cursor:pointer}
  .wrap{display:flex;border:1px solid #D5DED9;border-radius:6px;overflow:hidden}
  .hs{width:40px;flex:0 0 40px;padding-top:33px;background:#F6F8F5;border-right:1px solid #D5DED9}
  .h{height:${PH}px;position:relative}
  .h span{position:absolute;top:-6px;right:5px;font-size:8.5px;color:#5E7472;font-variant-numeric:tabular-nums}
  .dy{flex:1;border-right:1px solid #D5DED9;min-width:0}
  .dy:last-child{border-right:0}
  .dh{height:17px;font-size:10px;font-weight:600;text-align:center;border-bottom:1px solid #E8EEEA;line-height:17px}
  .mt{font-style:normal;font-size:8px;color:#8A5512;margin-left:3px}
  .kh{display:flex;height:14px}
  .kh span{flex:1;text-align:center;font-size:8px;font-weight:700;border-top:2px solid;line-height:12px}
  .kh .tw{flex:0 0 16px;color:#93A6A3;background:#F6F8F5;border-top-color:#D5DED9;font-weight:400}
  .bd0{display:flex;position:relative;height:${(H_END - H_START) * PH}px;background:repeating-linear-gradient(to bottom,transparent 0 ${PH - 1}px,#E8EEEA ${PH - 1}px ${PH}px)}
  .ln{flex:1;position:relative;border-right:1px dashed #E8EEEA;min-width:0}
  .ln:last-of-type{border-right:0}
  .rl{flex:0 0 16px;position:relative;background:#F6F8F5;border-left:1px solid #E8EEEA}
  .wk{position:absolute;border-radius:2px}
  .bk{position:absolute;left:1px;right:1px;border:1px solid;border-radius:4px;overflow:hidden}
  .bd{position:absolute;left:0;right:0;height:9px;color:#fff;font-size:7px;font-weight:700;text-align:center;line-height:9px}
  .bd.up{top:0}
  .bd.dn{bottom:0}
  .bt{position:absolute;top:10px;left:0;right:0;padding:0 2px;font-size:7.5px;font-weight:600;line-height:1.2;overflow:hidden}
  .bt span{color:#5E7472;font-weight:400;font-variant-numeric:tabular-nums}
  .gp{position:absolute;left:1px;right:1px;border:1px dashed #A32D3C;border-radius:4px;color:#A32D3C;font-size:7px;font-weight:700;padding:1px 2px}
  .lg{display:flex;flex-wrap:wrap;gap:9px;margin-top:9px;font-size:9px;color:#5E7472}
  .lg span{display:flex;align-items:center;gap:3px}
  .lg i{width:8px;height:8px;border-radius:4px;display:inline-block}
  @media print{.no-print{display:none}body{padding:0}}
</style></head><body>
<div class="no-print"><button onclick="window.print()">Imprimir esta hoja</button></div>
<h1>La semana en casa</h1>
<div class="sub">Banda de arriba de cada bloque: quien la lleva. Banda de abajo: quien la recoge. En rojo, lo que falta por decidir.</div>
<div class="wrap"><div class="hs">${horas}</div>${dias}</div>
<div class="lg">${leyenda}</div>
</body></html>`;
}

/* --------------------------- familia base -------------------------- */

const SEED = () => {
  const p = (name, role, color, availability) => ({ id: uid(), name, role, color, availability });
  const emma = p("Emma", "child", "#C2436B");
  const lea = p("Lea", "child", "#6A57A8");
  const jorge = p("Jorge", "adult", "#2F6FB5", "flexible");
  const justine = p("Justine", "adult", "#1E8A8A", "fixed");
  const abuela = p("Abuela", "helper", "#C07A1E", "flexible");
  const misa = p("Misa", "helper", "#5B8C2A", "flexible");
  const vanesa = p("Vanesa", "helper", "#8A5A3B", "flexible");
  const people = [emma, lea, jorge, justine, abuela, misa, vanesa];

  const blocks = [];
  [emma, lea].forEach((kid) => {
    for (let d = 0; d < 5; d++)
      blocks.push({
        id: uid(), type: "school", personId: kid.id, day: d, start: 9, end: 17, label: "Colegio",
        dropoffBy: d % 2 === 0 ? jorge.id : justine.id, pickupBy: d % 2 === 0 ? justine.id : jorge.id,
        active: true, short: false,
      });
  });
  blocks.push({ id: uid(), type: "activity", personId: emma.id, day: 1, start: 17, end: 18, label: "Natación", dropoffBy: null, pickupBy: abuela.id, active: true, short: false });
  blocks.push({ id: uid(), type: "activity", personId: lea.id, day: 3, start: 17, end: 18.5, label: "Ballet", dropoffBy: null, pickupBy: misa.id, active: true, short: false });
  for (let d = 0; d < 5; d++) {
    blocks.push({ id: uid(), type: "work", personId: jorge.id, day: d, start: 8.5, end: 18.25, label: "Trabajo", dropoffBy: null, pickupBy: null, active: true, short: false });
    blocks.push({ id: uid(), type: "work", personId: justine.id, day: d, start: 8.75, end: 15.75, label: "Trabajo", dropoffBy: null, pickupBy: null, active: true, short: false });
  }
  return { people: withTags(people), blocks, schoolEndShort: 13 };
};

/* ============================ componente =========================== */

export default function PlanFamiliar() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(0);
  const [view, setView] = useState("week");
  const [focusDay, setFocusDay] = useState(() => (new Date().getDay() + 6) % 7);
  const [lens, setLens] = useState("all");
  const [showAdults, setShowAdults] = useState(true);
  const [editing, setEditing] = useState(null);
  const [panel, setPanel] = useState(false);
  const [share, setShare] = useState(false);

  const today = (new Date().getDay() + 6) % 7;
  const nowH = new Date().getHours() + new Date().getMinutes() / 60;

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(STORE_KEY);
        setState(r && r.value ? migrate(JSON.parse(r.value)) : SEED());
      } catch (e) {
        setState(SEED());
      }
      setLoading(false);
    })();
  }, []);

  const persist = useCallback(async (next) => {
    setState(next);
    try {
      await window.storage.set(STORE_KEY, JSON.stringify(next));
      setSaved(Date.now());
    } catch (e) {
      /* el plan sigue en pantalla aunque no se haya podido guardar */
    }
  }, []);

  const people = state ? state.people : [];
  const byId = useMemo(() => Object.fromEntries(people.map((p) => [p.id, p])), [people]);
  const kids = people.filter((p) => p.role === "child");
  const grownups = people.filter((p) => p.role !== "child");
  const workers = people.filter((p) => p.role === "adult");
  const effEnd = useCallback((b) => (b.type === "school" && b.short ? state.schoolEndShort : b.end), [state]);

  const lanes = lens === "all" ? kids : kids.filter((k) => k.id === lens);

  const kidBlocks = useMemo(
    () => (state ? state.blocks.filter((b) => b.active && byId[b.personId] && byId[b.personId].role === "child") : []),
    [state, byId]
  );

  const gaps = useMemo(() => {
    if (!state) return [];
    const out = [];
    lanes.forEach((kid) => {
      for (let d = 0; d < 7; d++) {
        const bs = state.blocks.filter((b) => b.active && b.personId === kid.id && b.day === d).map((b) => ({ ...b, e: effEnd(b) })).sort((a, b) => a.start - b.start);
        for (let i = 0; i < bs.length - 1; i++)
          if (bs[i + 1].start > bs[i].e) out.push({ id: `${kid.id}${d}${i}`, personId: kid.id, day: d, start: bs[i].e, end: bs[i + 1].start });
      }
    });
    return out;
  }, [state, lens, effEnd]);

  const loadRows = useMemo(() => {
    if (!state) return [];
    const rows = grownups.map((g) => {
      let hours = 0, drops = 0, picks = 0, work = 0;
      state.blocks.filter((b) => b.active).forEach((b) => {
        if (b.type === "care" && b.withId === g.id) hours += effEnd(b) - b.start;
        if (b.type === "work" && b.personId === g.id) work += effEnd(b) - b.start;
        if (b.dropoffBy === g.id) drops++;
        if (b.pickupBy === g.id) picks++;
      });
      return { ...g, hours, drops, picks, work, total: drops + picks };
    });
    const max = Math.max(1, ...rows.map((r) => r.total));
    return rows.map((r) => ({ ...r, share: r.total / max }));
  }, [state, effEnd]);

  const unassigned = useMemo(
    () => (state ? state.blocks.filter((b) => b.active && TYPES[b.type].transfer).reduce((n, b) => n + (b.dropoffBy ? 0 : 1) + (b.pickupBy ? 0 : 1), 0) : 0),
    [state]
  );

  /* lo que pasa hoy, por niña */
  const todayLines = useMemo(() => {
    if (!state) return [];
    return kids.map((k) => {
      const bs = state.blocks.filter((b) => b.active && b.personId === k.id && b.day === today && TYPES[b.type].transfer).sort((a, b) => a.start - b.start);
      if (!bs.length) return { kid: k, empty: true };
      const first = bs[0], last = bs[bs.length - 1];
      return {
        kid: k,
        empty: false,
        inAt: first.start,
        outAt: effEnd(last),
        drop: first.dropoffBy ? byId[first.dropoffBy] : null,
        pick: last.pickupBy ? byId[last.pickupBy] : null,
      };
    });
  }, [state, today, byId, effEnd]);

  if (loading)
    return <div style={{ background: T.paper, color: T.ink, minHeight: 340, display: "grid", placeItems: "center", fontFamily: "system-ui,sans-serif" }}>Abriendo el plan…</div>;

  const dayList = view === "week" ? [0, 1, 2, 3, 4, 5, 6] : [focusDay];
  const isShort = (d) => state.blocks.some((b) => b.type === "school" && b.day === d && b.short);
  const toggleShort = (d) => persist({ ...state, blocks: state.blocks.map((b) => (b.type === "school" && b.day === d ? { ...b, short: !b.short } : b)) });
  const saveBlock = (b) => {
    const ex = state.blocks.some((x) => x.id === b.id);
    persist({ ...state, blocks: ex ? state.blocks.map((x) => (x.id === b.id ? b : x)) : [...state.blocks, b] });
    setEditing(null);
  };
  const removeBlock = (id) => {
    persist({ ...state, blocks: state.blocks.filter((x) => x.id !== id) });
    setEditing(null);
  };
  const reschedule = (id, start, end) =>
    persist({ ...state, blocks: state.blocks.map((x) => (x.id === id ? { ...x, start, end } : x)) });
  const dayW = view === "week" ? lanes.length * LANE_MIN + (showAdults ? RAIL : 0) : 0;

  return (
    <div style={{ background: T.paper, color: T.ink, fontFamily: "'IBM Plex Sans', system-ui, -apple-system, sans-serif", fontSize: 14, lineHeight: 1.45, paddingBottom: 8 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
        .pf{font-feature-settings:"tnum" 0}
        .pf-btn{border:1px solid ${T.line};background:${T.surface};color:${T.soft};border-radius:7px;padding:5px 10px;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;transition:border-color .12s,color .12s}
        .pf-btn:hover{color:${T.ink};border-color:${T.faint}}
        .pf-btn[data-on="true"]{background:${T.ink};color:#fff;border-color:${T.ink}}
        .pf-btn:focus-visible{outline:2px solid ${T.accent};outline-offset:2px}
        .pf-seg{display:inline-flex;background:${T.dim};border:1px solid ${T.line};border-radius:8px;padding:2px;gap:2px}
        .pf-seg button{border:0;background:transparent;color:${T.soft};font:inherit;font-size:13px;font-weight:600;padding:4px 11px;border-radius:6px;cursor:pointer}
        .pf-seg button[data-on="true"]{background:${T.surface};box-shadow:0 1px 2px rgba(25,49,47,.12)}
        .pf-seg button:focus-visible{outline:2px solid ${T.accent};outline-offset:1px}
        .pf-in{border:1px solid ${T.line};border-radius:8px;padding:9px;font-size:14px;width:100%;background:${T.surface};color:${T.ink};font-family:inherit}
        .pf-in:focus{outline:2px solid ${T.accent};outline-offset:-1px;border-color:${T.accent}}
        .pf-cell{transition:background .1s}
        .pf-cell:hover{background:${hexA(T.accent, .06)}}
        .pf-num{font-variant-numeric:tabular-nums}
        .pf-sheet{animation:pfUp .18s ease-out}
        @keyframes pfUp{from{transform:translateY(14px);opacity:.4}to{transform:none;opacity:1}}
        @media (prefers-reduced-motion:reduce){.pf-sheet{animation:none}}
        .pf-scroll::-webkit-scrollbar{height:7px}
        .pf-scroll::-webkit-scrollbar-thumb{background:${T.line};border-radius:4px}
        @media print{
          @page{size:A4 landscape;margin:9mm}
          .pf-noprint{display:none!important}
          .pf-scroll{overflow:visible!important}
          body{background:#fff}
        }
      `}</style>

      {/* ---------------------- cabecera ---------------------- */}
      <header style={{ background: T.surface, borderBottom: `1px solid ${T.line}`, padding: "13px 14px 11px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: -0.4 }}>La semana en casa</h1>
          <span style={{ flex: 1 }} />
          <button className="pf-btn pf-noprint" onClick={() => setShare(true)}>Compartir</button>
          <button className="pf-btn pf-noprint" onClick={() => setPanel(!panel)}>Ajustes</button>
          <button
            className="pf-btn pf-noprint"
            data-on="true"
            onClick={() => setEditing({ id: uid(), type: "activity", personId: lanes[0].id, day: view === "day" ? focusDay : today, start: 17, end: 18, label: "", dropoffBy: null, pickupBy: null, active: true, short: false })}
          >
            Añadir
          </button>
        </div>

        <div className="pf-noprint" style={{ display: "flex", gap: 8, marginTop: 11, flexWrap: "wrap", alignItems: "center" }}>
          <div className="pf-seg">
            <button data-on={lens === "all"} onClick={() => setLens("all")}>Las dos</button>
            {kids.map((k) => (
              <button key={k.id} data-on={lens === k.id} onClick={() => setLens(k.id)} style={lens === k.id ? { color: k.color } : undefined}>
                {k.name}
              </button>
            ))}
          </div>
          <div className="pf-seg">
            <button data-on={view === "week"} onClick={() => setView("week")}>Semana</button>
            <button data-on={view === "day"} onClick={() => setView("day")}>Día</button>
          </div>
          {view === "day" && (
            <select className="pf-in" style={{ width: "auto" }} value={focusDay} onChange={(e) => setFocusDay(+e.target.value)}>
              {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
          )}
          <button className="pf-btn" data-on={showAdults} onClick={() => setShowAdults(!showAdults)} title="Muestra el horario de trabajo de los adultos junto a cada día">
            Trabajo
          </button>
        </div>
      </header>

      {panel && <Settings state={state} persist={persist} close={() => setPanel(false)} onReset={() => persist(SEED())} saved={saved} />}

      {/* ---------------------- cinta de hoy ---------------------- */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.line}`, padding: "10px 14px" }}>
        <div style={{ fontSize: 12, color: T.faint, marginBottom: 6 }}>
          Hoy es {DAYS[today].toLowerCase()}
          {unassigned > 0 && <span style={{ color: T.alert, fontWeight: 600 }}> · {unassigned} {unassigned === 1 ? "traslado sin responsable" : "traslados sin responsable"} esta semana</span>}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {todayLines.map((l) => (
            <div key={l.kid.id} style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${T.line}`, borderLeft: `3px solid ${l.kid.color}`, borderRadius: 8, padding: "6px 10px", background: T.surface, flex: "1 1 190px" }}>
              <strong style={{ fontSize: 13, color: l.kid.color }}>{l.kid.name}</strong>
              {l.empty ? (
                <span style={{ fontSize: 12, color: T.faint }}>sin colegio</span>
              ) : (
                <span className="pf-num" style={{ fontSize: 12, color: T.soft }}>
                  {fmt(l.inAt)} {l.drop ? `con ${l.drop.name}` : <em style={{ color: T.alert, fontStyle: "normal", fontWeight: 600 }}>sin quien la lleve</em>}
                  {" · "}
                  {fmt(l.outAt)} {l.pick ? `con ${l.pick.name}` : <em style={{ color: T.alert, fontStyle: "normal", fontWeight: 600 }}>sin quien la recoja</em>}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ---------------------- rejilla ---------------------- */}
      <div className="pf-scroll" style={{ overflowX: "auto", background: T.surface }}>
        <div style={{ minWidth: view === "week" ? 46 + 7 * dayW : "100%", display: "flex" }}>
          {/* canal horario */}
          <div style={{ width: 46, flexShrink: 0, paddingTop: 66, borderRight: `1px solid ${T.line}`, background: T.dim }}>
            {Array.from({ length: H_END - H_START }, (_, i) => {
              const h = H_START + i;
              const core = h >= CORE[0] && h < CORE[1];
              return (
                <div key={i} style={{ height: HOUR_H, position: "relative" }}>
                  <span className="pf-num" style={{ position: "absolute", top: -8, right: 7, fontSize: 12, fontWeight: core ? 600 : 400, color: core ? T.soft : T.faint }}>
                    {fmt(h)}
                  </span>
                </div>
              );
            })}
          </div>

          {dayList.map((d) => {
            const weekend = d > 4;
            const isToday = d === today;
            return (
              <div key={d} style={{ flex: 1, minWidth: view === "week" ? dayW : 0, borderRight: `1px solid ${T.line}`, display: "flex", flexDirection: "column" }}>
                {/* cabecera del día */}
                <div style={{ flexShrink: 0, borderBottom: `1px solid ${T.line}`, background: isToday ? hexA(T.accent, 0.07) : T.surface }}>
                  <div style={{ height: 47, padding: "6px 4px 4px", textAlign: "center", boxSizing: "border-box" }}>
                    <div style={{ fontWeight: isToday ? 700 : 600, fontSize: 13, color: isToday ? T.accent : weekend ? T.faint : T.ink }}>{DAYS_SHORT[d]}</div>
                    {!weekend && (
                      <button
                        className="pf-btn"
                        onClick={() => toggleShort(d)}
                        style={{ padding: "0 7px", fontSize: 10, marginTop: 2, lineHeight: "16px", background: isShort(d) ? "#FBF0DC" : "transparent", borderColor: isShort(d) ? "#C07A1E" : T.line, color: isShort(d) ? "#8A5512" : T.faint, fontWeight: isShort(d) ? 600 : 500 }}
                        title={`Jornada matinera: el colegio acaba a las ${fmt(state.schoolEndShort)}`}
                      >
                        {isShort(d) ? "matinera" : "jornada"}
                      </button>
                    )}
                  </div>
                  <div style={{ display: "flex", height: 19 }}>
                    {lanes.map((k) => (
                      <div key={k.id} style={{ flex: 1, textAlign: "center", fontSize: 10.5, fontWeight: 600, color: k.color, background: hexA(k.color, 0.1), borderTop: `2px solid ${k.color}`, lineHeight: "17px" }}>
                        {k.name}
                      </div>
                    ))}
                    {showAdults && (
                      <div style={{ width: RAIL, flexShrink: 0, background: T.dim, display: "flex", alignItems: "center", justifyContent: "center", borderTop: `2px solid ${T.line}` }}>
                        {workers.map((w) => (
                          <span key={w.id} title={`Trabajo de ${w.name}`} style={{ flex: 1, textAlign: "center", fontSize: 9, fontWeight: 700, color: w.color, lineHeight: "17px" }}>
                            {w.tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* cuerpo del día */}
                <div style={{ display: "flex", position: "relative", height: (H_END - H_START) * HOUR_H, background: weekend ? T.weekend : T.surface }}>
                  {lanes.map((kid, li) => (
                    <div key={kid.id} style={{ flex: 1, position: "relative", borderRight: li < lanes.length - 1 ? `1px dashed ${T.hair}` : "none" }}>
                      {Array.from({ length: H_END - H_START }, (_, i) => {
                        const h = H_START + i;
                        const core = h >= CORE[0] && h < CORE[1];
                        return (
                          <div
                            key={i}
                            className="pf-cell"
                            onClick={(e) => {
                              const r = e.currentTarget.getBoundingClientRect();
                              const q = Math.max(0, Math.min(3, Math.floor(((e.clientY - r.top) / r.height) * 4))) / 4;
                              const s = h + q;
                              setEditing({ id: uid(), type: "care", personId: kid.id, withId: grownups[0] ? grownups[0].id : null, day: d, start: s, end: Math.min(H_END, s + 1), label: "", dropoffBy: null, pickupBy: null, active: true, short: false });
                            }}
                            style={{ height: HOUR_H, borderBottom: `1px solid ${T.hair}`, cursor: "pointer", position: "relative", background: core ? "transparent" : hexA("#19312F", 0.022) }}
                          >
                            <div style={{ position: "absolute", top: HOUR_H / 4, left: 0, width: 5, borderTop: `1px solid ${T.hair}` }} />
                            <div style={{ position: "absolute", top: HOUR_H / 2, left: 6, right: 6, borderTop: `1px dotted ${T.hair}` }} />
                            <div style={{ position: "absolute", top: (HOUR_H * 3) / 4, left: 0, width: 5, borderTop: `1px solid ${T.hair}` }} />
                          </div>
                        );
                      })}

                      {gaps.filter((g) => g.day === d && g.personId === kid.id).map((g) => (
                        <div
                          key={g.id}
                          style={{
                            position: "absolute", top: (g.start - H_START) * HOUR_H + 1, height: (g.end - g.start) * HOUR_H - 2, left: 2, right: 2,
                            border: `1.5px dashed ${T.alert}`, borderRadius: 7, background: `repeating-linear-gradient(135deg, ${hexA(T.alert, .05)} 0 6px, transparent 6px 12px)`,
                            pointerEvents: "none", padding: "4px 5px", fontSize: 10.5, color: T.alert, fontWeight: 600, lineHeight: 1.2,
                          }}
                        >
                          Sin cubrir
                          <div className="pf-num" style={{ fontWeight: 400, fontSize: 10 }}>{fmt(g.start)}</div>
                        </div>
                      ))}

                      {kidBlocks.filter((b) => b.day === d && b.personId === kid.id).map((b) => (
                        <Ticket key={b.id} b={b} kid={kid} byId={byId} end={effEnd(b)} onOpen={() => setEditing(b)} onCommit={reschedule} />
                      ))}
                    </div>
                  ))}

                  {/* barra de trabajo de los adultos */}
                  {showAdults && (
                    <div style={{ width: RAIL, flexShrink: 0, position: "relative", borderLeft: `1px solid ${T.hair}`, background: T.dim }}>
                      {state.blocks.filter((b) => b.active && b.day === d && byId[b.personId] && byId[b.personId].role === "adult").map((b) => {
                        const p = byId[b.personId];
                        const idx = workers.findIndex((w) => w.id === p.id);
                        const wpc = 100 / Math.max(1, workers.length);
                        return (
                          <div
                            key={b.id}
                            onClick={() => setEditing(b)}
                            title={`${p.name}: ${b.label || "Trabajo"} ${fmt(b.start)}–${fmt(effEnd(b))}${p.availability === "flexible" ? " (flexible)" : ""}`}
                            style={{
                              position: "absolute", top: (b.start - H_START) * HOUR_H + 1, height: (effEnd(b) - b.start) * HOUR_H - 3,
                              left: `${idx * wpc}%`, width: `calc(${wpc}% - 3px)`, marginLeft: 1.5, cursor: "pointer", borderRadius: 3,
                              background: p.availability === "flexible" ? `repeating-linear-gradient(135deg, ${hexA(p.color, .6)} 0 3px, ${hexA(p.color, .15)} 3px 6px)` : hexA(p.color, 0.6),
                            }}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* hora actual */}
                  {isToday && nowH > H_START && nowH < H_END && (
                    <div style={{ position: "absolute", top: (nowH - H_START) * HOUR_H, left: 0, right: 0, height: 0, borderTop: `2px solid ${T.accent}`, pointerEvents: "none" }}>
                      <span style={{ position: "absolute", left: 0, top: -3, width: 6, height: 6, borderRadius: 3, background: T.accent }} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------------------- reparto ---------------------- */}
      <section style={{ padding: "14px 14px 6px" }}>
        <h2 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600 }}>Quién carga con qué</h2>
        <div style={{ display: "grid", gap: 7, maxWidth: 520 }}>
          {loadRows.filter((g) => g.total > 0 || g.hours > 0 || g.work > 0).map((g) => (
            <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 78, fontSize: 13, fontWeight: 500, flexShrink: 0 }}>
                {g.name}
                {g.work > 0 && (
                  <span className="pf-num" style={{ display: "block", fontSize: 10.5, color: T.faint, fontWeight: 400 }}>
                    {fmtH(g.work)}{g.availability === "flexible" ? " flexible" : ""}
                  </span>
                )}
              </span>
              <div style={{ flex: 1, height: 10, background: T.surface, borderRadius: 5, overflow: "hidden", border: `1px solid ${T.line}` }}>
                <div style={{ width: `${g.share * 100}%`, height: "100%", background: hexA(g.color, 0.75) }} />
              </div>
              <span className="pf-num" style={{ fontSize: 12, color: T.soft, width: 112, textAlign: "right", flexShrink: 0 }}>
                {g.drops} llevadas · {g.picks} recogidas
              </span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: T.faint, marginTop: 12, maxWidth: 520 }}>
          En cada bloque, la banda de arriba es quien la lleva y la de abajo quien la recoge. Rayada en rojo significa que falta decidirlo. Arrastra esas bandas para cambiar la hora de entrada o de salida, y el asidero de puntos de la izquierda para mover el bloque entero. Un toque abre el detalle. La columna estrecha de la derecha de cada día es el horario de trabajo de los adultos, uno por cada etiqueta de la cabecera; el rayado indica que es flexible. Se quita con el botón Trabajo.
        </p>
      </section>

      {editing && <BlockSheet block={editing} state={state} onSave={saveBlock} onDelete={removeBlock} onClose={() => setEditing(null)} />}
      {share && <ShareSheet state={state} onClose={() => setShare(false)} onRestore={(s) => { persist(migrate(s)); setShare(false); }} />}
    </div>
  );
}

/* ------------------------- bloque tipo billete --------------------- */

/* la banda vive fuera del bloque: si se redefine en cada render, el gesto se corta */
function TicketBand({ person, top, band, locked, onDown }) {
  const missing = !person;
  return (
    <div
      onPointerDown={locked ? undefined : onDown}
      title={`${top ? "La lleva" : "La recoge"}: ${missing ? "sin asignar" : person.name}${locked ? "" : ". Arrastra para cambiar la hora"}`}
      style={{
        position: "absolute", left: 0, right: 0, top: top ? 0 : "auto", bottom: top ? "auto" : 0, height: band,
        background: missing ? `repeating-linear-gradient(135deg, ${hexA(T.alert, .85)} 0 4px, ${hexA(T.alert, .55)} 4px 8px)` : person.color,
        borderRadius: top ? "6px 6px 0 0" : "0 0 6px 6px",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
        color: "#fff", fontSize: Math.min(10.5, band - 4.5), fontWeight: 700, lineHeight: 1,
        cursor: locked ? "pointer" : "ns-resize", touchAction: locked ? "auto" : "none",
      }}
    >
      {missing ? "?" : person.tag}
      {!locked && band >= 11 && <span style={{ width: 11, height: 4, borderTop: "1px solid rgba(255,255,255,.75)", borderBottom: "1px solid rgba(255,255,255,.75)", opacity: .9 }} />}
    </div>
  );
}

function Ticket({ b, kid, byId, end, onOpen, onCommit }) {
  const [gh, setGh] = useState(null); // gesto en curso: {s,e,mode}
  const vs = gh ? gh.s : b.start;
  const ve = gh ? gh.e : end;
  const h = Math.max(30, (ve - vs) * HOUR_H - 3);
  const withTransfer = TYPES[b.type].transfer;
  const band = withTransfer ? Math.min(16, Math.floor(h / 3.2)) : 0;
  const room = h - band * 2;
  const drop = b.dropoffBy ? byId[b.dropoffBy] : null;
  const pick = b.pickupBy ? byId[b.pickupBy] : null;
  const withAdult = b.type === "care" && b.withId ? byId[b.withId] : null;
  const snap = (x) => Math.round(x * 4) / 4;
  const clamp = (x, a, z) => Math.max(a, Math.min(z, x));

  /* mode: 'move' | 'top' | 'bottom' */
  const begin = (mode) => (ev) => {
    if (ev.button != null && ev.button !== 0) return;
    ev.stopPropagation();
    ev.preventDefault();
    const y0 = ev.clientY;
    const s0 = b.start, e0 = b.end, ve0 = end;
    const cur = { s: s0, e: e0, vs: s0, ve: ve0 };
    let moved = false;
    setGh({ s: s0, e: ve0, mode });

    const move = (m) => {
      const d = snap((m.clientY - y0) / HOUR_H);
      if (Math.abs(m.clientY - y0) > 3) moved = true;
      if (mode === "move") {
        const dur = e0 - s0, vdur = ve0 - s0;
        const s = clamp(s0 + d, H_START, H_END - vdur);
        cur.s = s; cur.e = s + dur; cur.vs = s; cur.ve = s + vdur;
      } else if (mode === "top") {
        const s = clamp(s0 + d, H_START, ve0 - 0.25);
        cur.s = s; cur.e = e0; cur.vs = s; cur.ve = ve0;
      } else {
        const e = clamp(e0 + d, s0 + 0.25, H_END);
        cur.s = s0; cur.e = e; cur.vs = s0; cur.ve = e;
      }
      setGh({ s: cur.vs, e: cur.ve, mode });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      setGh(null);
      if (!moved) onOpen();
      else if (cur.s !== s0 || cur.e !== e0) onCommit(b.id, cur.s, cur.e);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  return (
    <div
      onClick={() => { if (!gh) onOpen(); }}
      style={{
        position: "absolute", top: (vs - H_START) * HOUR_H + 1, height: h, left: 2, right: 2,
        background: hexA(kid.color, gh ? 0.22 : 0.12), border: `1px solid ${hexA(kid.color, gh ? 0.6 : 0.3)}`, borderRadius: 7,
        cursor: "pointer", overflow: "visible", boxSizing: "border-box",
        boxShadow: gh ? `0 4px 12px ${hexA(kid.color, .3)}` : "none", zIndex: gh ? 20 : 1,
      }}
    >
      <div style={{ position: "absolute", inset: 0, borderRadius: 6, overflow: "hidden" }}>
        {withTransfer && <TicketBand person={drop} top band={band} locked={false} onDown={begin("top")} />}
        <div style={{ position: "absolute", top: band, height: room, left: 0, right: 0, padding: "2px 5px 2px 13px", overflow: "hidden" }}>
          <div style={{ fontWeight: 600, fontSize: 11, color: kid.color, lineHeight: 1.15, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
            {b.label || TYPES[b.type].label}
          </div>
          {room > 30 && <div className="pf-num" style={{ fontSize: 10, color: T.soft }}>{fmt(vs)}–{fmt(ve)}</div>}
          {withAdult && room > 26 && <div style={{ fontSize: 10, color: withAdult.color, fontWeight: 600 }}>{withAdult.name}</div>}
        </div>
        {withTransfer && <TicketBand person={pick} top={false} band={band} locked={!!b.short} onDown={begin("bottom")} />}
      </div>

      {/* asidero para mover el bloque entero */}
      {room > 26 && (
        <div
          onPointerDown={begin("move")}
          title="Arrastra para mover el bloque"
          style={{
            position: "absolute", left: 1, top: band + 2, width: 11, height: Math.min(30, room - 4),
            display: "flex", flexDirection: "column", gap: 2, alignItems: "center", justifyContent: "center",
            cursor: "grab", touchAction: "none", borderRadius: 4, background: hexA(kid.color, .16),
          }}
        >
          {[0, 1, 2].map((i) => <span key={i} style={{ width: 3, height: 3, borderRadius: 2, background: hexA(kid.color, .85) }} />)}
        </div>
      )}

      {/* hora en vivo mientras se arrastra */}
      {gh && (
        <div className="pf-num" style={{ position: "absolute", left: "50%", top: -22, transform: "translateX(-50%)", background: T.ink, color: "#fff", fontSize: 10.5, fontWeight: 600, padding: "3px 7px", borderRadius: 5, whiteSpace: "nowrap", zIndex: 30 }}>
          {fmt(gh.s)}–{fmt(gh.e)}
        </div>
      )}
    </div>
  );
}

/* ---------------------------- ajustes ------------------------------ */

function Settings({ state, persist, close, onReset, saved }) {
  const [nuevo, setNuevo] = useState("");
  const [rol, setRol] = useState("helper");
  const upd = (id, patch) => persist({ ...state, people: state.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const roleLabel = { child: "niña", adult: "adulto", helper: "apoyo" };

  return (
    <div style={{ background: T.surface, borderBottom: `1px solid ${T.line}`, padding: "14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <strong style={{ fontSize: 14, fontWeight: 600 }}>Personas</strong>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {saved > 0 && <span style={{ fontSize: 11, color: T.accent }}>guardado</span>}
          <button className="pf-btn" onClick={onReset}>Reiniciar</button>
          <button className="pf-btn" onClick={close}>Cerrar</button>
        </div>
      </div>

      <div style={{ display: "grid", gap: 7 }}>
        {state.people.map((p) => (
          <div key={p.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ width: 9, height: 9, borderRadius: 5, background: p.color, flexShrink: 0 }} />
            <input className="pf-in" value={p.name} onChange={(e) => upd(p.id, { name: e.target.value })} style={{ flex: 1, minWidth: 0 }} />
            <input className="pf-in" value={p.tag || ""} maxLength={3} onChange={(e) => upd(p.id, { tag: e.target.value })} title="Cómo aparece en las bandas de llevar y recoger" style={{ width: 48, textAlign: "center", fontWeight: 700, flexShrink: 0 }} />
            {p.role !== "child" && (
              <button className="pf-btn" onClick={() => upd(p.id, { availability: p.availability === "fixed" ? "flexible" : "fixed" })} style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
                {p.availability === "fixed" ? "fijo" : "flexible"}
              </button>
            )}
            <button className="pf-btn" onClick={() => persist({ ...state, people: state.people.filter((x) => x.id !== p.id), blocks: state.blocks.filter((b) => b.personId !== p.id) })} style={{ flexShrink: 0 }}>
              Quitar
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 11 }}>
        <input className="pf-in" placeholder="Nombre" value={nuevo} onChange={(e) => setNuevo(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
        <select className="pf-in" style={{ width: "auto", flexShrink: 0 }} value={rol} onChange={(e) => setRol(e.target.value)}>
          {Object.entries(roleLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button
          className="pf-btn"
          data-on="true"
          style={{ flexShrink: 0 }}
          onClick={() => {
            if (!nuevo.trim()) return;
            persist({ ...state, people: withTags([...state.people, { id: uid(), name: nuevo.trim(), role: rol, availability: rol === "adult" ? "fixed" : "flexible", color: "#4A7C7A" }]) });
            setNuevo("");
          }}
        >
          Añadir
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.hair}` }}>
        <span style={{ fontSize: 13, color: T.soft }}>La jornada matinera acaba a las</span>
        <select className="pf-in" style={{ width: "auto" }} value={state.schoolEndShort} onChange={(e) => persist({ ...state, schoolEndShort: +e.target.value })}>
          {TIMES.filter((t) => t >= 11 && t <= 15).map((t) => <option key={t} value={t}>{fmt(t)}</option>)}
        </select>
      </div>
    </div>
  );
}

/* --------------------------- compartir ---------------------------- */

function ShareSheet({ state, onClose, onRestore }) {
  const [tab, setTab] = useState("text");
  const [msg, setMsg] = useState("");
  const [pegado, setPegado] = useState("");
  const texto = useMemo(() => buildText(state), [state]);
  const json = useMemo(() => JSON.stringify(state, null, 2), [state]);

  const descargar = (contenido, nombre, tipo) => {
    try {
      const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
      const a = document.createElement("a");
      a.href = url;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setMsg(`Descargado ${nombre}`);
    } catch (e) {
      setMsg("La descarga no está permitida aquí. Copia el texto de abajo y pégalo donde quieras guardarlo.");
    }
  };

  const restaurar = () => {
    try {
      const s = JSON.parse(pegado);
      if (!s.people || !s.blocks) throw new Error("faltan datos");
      onRestore(s);
    } catch (e) {
      setMsg("Ese texto no es una copia válida. Pega el contenido completo del archivo.");
    }
  };

  const Tab = ({ id, children }) => (
    <button data-on={tab === id} onClick={() => { setTab(id); setMsg(""); }}>{children}</button>
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(25,49,47,.42)", display: "grid", placeItems: "end center", zIndex: 50 }}>
      <div
        className="pf-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{ background: T.surface, width: "100%", maxWidth: 520, borderRadius: "16px 16px 0 0", padding: 18, maxHeight: "88vh", overflowY: "auto", fontFamily: "'IBM Plex Sans', system-ui, sans-serif", color: T.ink }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <strong style={{ fontSize: 16, fontWeight: 600 }}>Compartir y guardar</strong>
          <button className="pf-btn" onClick={onClose}>Cerrar</button>
        </div>

        <div className="pf-seg" style={{ marginBottom: 14 }}>
          <Tab id="text">Mensaje</Tab>
          <Tab id="print">Imprimir</Tab>
          <Tab id="file">Copia</Tab>
        </div>

        {tab === "text" && (
          <>
            <p style={{ fontSize: 13, color: T.soft, marginTop: 0 }}>
              La semana escrita, lista para mandar por mensaje a la abuela o a quien haga la recogida.
            </p>
            <textarea readOnly value={texto} className="pf-in" style={{ height: 210, fontSize: 12, lineHeight: 1.45, resize: "vertical" }} />
            <button
              className="pf-btn"
              style={{ marginTop: 10, width: "100%", padding: 11, background: T.accent, color: "#fff", borderColor: T.accent, fontWeight: 600 }}
              onClick={async () => setMsg((await copyText(texto)) ? "Copiado. Ya lo puedes pegar en el mensaje." : "No he podido copiarlo. Selecciona el texto a mano.")}
            >
              Copiar el texto
            </button>
          </>
        )}

        {tab === "print" && (
          <>
            <p style={{ fontSize: 13, color: T.soft, marginTop: 0 }}>
              Desde aquí dentro el navegador no deja lanzar la impresión, así que te preparo la hoja en un archivo aparte: la descargas, la abres y le das a imprimir. Sale en A4 horizontal con los siete días.
            </p>
            <button
              className="pf-btn"
              style={{ width: "100%", padding: 11, background: T.accent, color: "#fff", borderColor: T.accent, fontWeight: 600 }}
              onClick={() => descargar(buildPrintHTML(state), "semana-en-casa.html", "text/html")}
            >
              Descargar la hoja
            </button>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                className="pf-btn"
                style={{ flex: 1, padding: 10 }}
                onClick={async () => setMsg((await copyText(buildPrintHTML(state))) ? "Copiado. Pégalo en un archivo .html y ábrelo." : "No he podido copiarlo.")}
              >
                Copiar el código
              </button>
              <button className="pf-btn" style={{ flex: 1, padding: 10 }} onClick={() => { try { window.print(); } catch (e) { setMsg("Confirmado: el visor bloquea la impresión directa. Usa la descarga."); } }}>
                Intentar imprimir aquí
              </button>
            </div>
            <p style={{ fontSize: 12, color: T.faint, marginTop: 10 }}>
              Al abrir el archivo verás un botón de imprimir arriba, que no sale en el papel. En el diálogo puedes elegir guardar como PDF.
            </p>
          </>
        )}

        {tab === "file" && (
          <>
            <p style={{ fontSize: 13, color: T.soft, marginTop: 0 }}>
              Guarda un archivo con toda la configuración: personas, horarios, extraescolares y reparto. Sirve para recuperarla o para llevártela a otro sitio.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="pf-btn" style={{ flex: 1, padding: 10, fontWeight: 600 }} onClick={() => descargar(json, "plan-familiar.json", "application/json")}>
                Descargar copia
              </button>
              <button className="pf-btn" style={{ flex: 1, padding: 10 }} onClick={async () => setMsg((await copyText(json)) ? "Copia en el portapapeles." : "No he podido copiarla.")}>
                Copiar copia
              </button>
            </div>

            <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.hair}` }}>
              <span style={{ fontSize: 12, color: T.soft, display: "block", marginBottom: 5 }}>Recuperar una copia guardada</span>
              <textarea
                className="pf-in"
                placeholder="Pega aquí el contenido del archivo"
                value={pegado}
                onChange={(e) => setPegado(e.target.value)}
                style={{ height: 90, fontSize: 12, resize: "vertical" }}
              />
              <button className="pf-btn" style={{ marginTop: 8, width: "100%", padding: 10 }} onClick={restaurar} disabled={!pegado.trim()}>
                Restaurar y reemplazar la semana
              </button>
            </div>
          </>
        )}

        {msg && <p style={{ fontSize: 12, color: T.accent, marginTop: 12, marginBottom: 0 }}>{msg}</p>}
      </div>
    </div>
  );
}

/* ----------------------------- panel de edición -------------------- */

/* campos fuera del panel: si se redefinen en cada render, el input pierde el foco */
const Field = ({ label, children }) => (
  <label style={{ display: "block", marginBottom: 11 }}>
    <span style={{ fontSize: 12, color: T.soft, display: "block", marginBottom: 4 }}>{label}</span>
    {children}
  </label>
);
const Sel = ({ value, onChange, options, empty }) => (
  <select className="pf-in" value={value === null || value === undefined ? "" : value} onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}>
    {empty && <option value="">{empty}</option>}
    {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
  </select>
);

function BlockSheet({ block, state, onSave, onDelete, onClose }) {
  const [b, setB] = useState(block);
  const set = (patch) => setB({ ...b, ...patch });
  const people = state.people;
  const kids = people.filter((p) => p.role === "child");
  const grownups = people.filter((p) => p.role !== "child");
  const pool = TYPES[b.type].who === "child" ? kids : TYPES[b.type].who === "adult" ? people.filter((p) => p.role === "adult") : people;
  const exists = state.blocks.some((x) => x.id === b.id);

  useEffect(() => {
    if (!pool.some((p) => p.id === b.personId) && pool[0]) set({ personId: pool[0].id });
  }, [b.type]);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(25,49,47,.42)", display: "grid", placeItems: "end center", zIndex: 50 }}>
      <div
        className="pf-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{ background: T.surface, width: "100%", maxWidth: 460, borderRadius: "16px 16px 0 0", padding: 18, maxHeight: "88vh", overflowY: "auto", fontFamily: "'IBM Plex Sans', system-ui, sans-serif", color: T.ink }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <strong style={{ fontSize: 16, fontWeight: 600 }}>{exists ? "Editar" : "Añadir"}</strong>
          <button className="pf-btn" onClick={onClose}>Cerrar</button>
        </div>

        <Field label="Qué es"><Sel value={b.type} onChange={(v) => set({ type: v })} options={Object.entries(TYPES).map(([k, t]) => ({ v: k, l: t.label }))} /></Field>
        <Field label="De quién"><Sel value={b.personId} onChange={(v) => set({ personId: v })} options={pool.map((p) => ({ v: p.id, l: p.name }))} /></Field>

        {b.type === "care" && (
          <Field label="Quién se queda"><Sel value={b.withId || null} onChange={(v) => set({ withId: v })} options={grownups.map((p) => ({ v: p.id, l: p.name }))} empty="Sin decidir" /></Field>
        )}

        <Field label="Nombre">
          <input className="pf-in" value={b.label} placeholder={TYPES[b.type].label} onChange={(e) => set({ label: e.target.value })} />
        </Field>

        <Field label="Día"><Sel value={b.day} onChange={(v) => set({ day: +v })} options={DAYS.map((d, i) => ({ v: i, l: d }))} /></Field>

        <div style={{ display: "flex", gap: 11 }}>
          <div style={{ flex: 1 }}><Field label="Empieza"><Sel value={b.start} onChange={(v) => set({ start: +v })} options={TIMES.map((t) => ({ v: t, l: fmt(t) }))} /></Field></div>
          <div style={{ flex: 1 }}><Field label="Acaba"><Sel value={b.end} onChange={(v) => set({ end: +v })} options={TIMES.filter((t) => t > b.start).map((t) => ({ v: t, l: fmt(t) }))} /></Field></div>
        </div>

        {TYPES[b.type].transfer && (
          <div style={{ display: "flex", gap: 11 }}>
            <div style={{ flex: 1 }}><Field label="La lleva"><Sel value={b.dropoffBy} onChange={(v) => set({ dropoffBy: v })} options={grownups.map((p) => ({ v: p.id, l: p.name }))} empty="Sin asignar" /></Field></div>
            <div style={{ flex: 1 }}><Field label="La recoge"><Sel value={b.pickupBy} onChange={(v) => set({ pickupBy: v })} options={grownups.map((p) => ({ v: p.id, l: p.name }))} empty="Sin asignar" /></Field></div>
          </div>
        )}

        <label style={{ display: "flex", alignItems: "center", gap: 9, margin: "4px 0 16px" }}>
          <input type="checkbox" checked={b.active} onChange={(e) => set({ active: e.target.checked })} style={{ accentColor: T.accent, width: 16, height: 16 }} />
          <span style={{ fontSize: 13 }}>Activo esta semana</span>
        </label>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="pf-btn" style={{ flex: 1, padding: 11, fontWeight: 600, background: T.accent, color: "#fff", borderColor: T.accent }} onClick={() => onSave(b)}>Guardar</button>
          {exists && <button className="pf-btn" style={{ color: T.alert, borderColor: hexA(T.alert, .4), padding: "11px 14px" }} onClick={() => onDelete(b.id)}>Borrar</button>}
        </div>
      </div>
    </div>
  );
}
