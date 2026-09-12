/*  Avisos de los recordatorios.
 *
 *  Lo que hace hoy: con la app abierta (o de fondo, en el móvil, mientras
 *  no la cierres del todo), comprueba cada minuto si toca avisar de algo
 *  y lanza la notificación del sistema.
 *
 *  Lo que todavía no: avisar con la app cerrada. Eso son notificaciones
 *  push de verdad y necesitan servidor; el service worker ya está puesto
 *  para poder engancharlas sin rehacer nada de esto.                     */

const YA_AVISADO = new Set();

export function estadoPermiso() {
  if (typeof Notification === "undefined") return "no-disponible";
  return Notification.permission; // default | granted | denied
}

export async function pedirPermiso() {
  if (typeof Notification === "undefined") return "no-disponible";
  try {
    return await Notification.requestPermission();
  } catch (e) {
    return "denied";
  }
}

async function mostrar(titulo, cuerpo) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const opciones = { body: cuerpo, icon: "/icono-192.png", badge: "/icono-192.png", tag: cuerpo, renotify: false };
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) return reg.showNotification(titulo, opciones);
  } catch (e) { /* sin service worker probamos de la otra forma */ }
  try { new Notification(titulo, opciones); } catch (e) {}
}

/*  pendientes: [{ id, texto, cuando: Date, etiqueta }]  */
export function vigilar(obtenerPendientes) {
  const tic = async () => {
    const ahora = Date.now();
    const lista = obtenerPendientes() || [];
    for (const p of lista) {
      const clave = `${p.id}|${p.cuando.toDateString()}`;
      if (YA_AVISADO.has(clave)) continue;
      const falta = p.cuando.getTime() - ahora;
      // ventana de dos minutos, para no perder el aviso si el móvil estaba dormido
      if (falta <= 0 && falta > -120000) {
        YA_AVISADO.add(clave);
        await mostrar(p.etiqueta || "Recuerda", p.texto);
      }
    }
  };
  tic();
  const id = setInterval(tic, 30000);
  document.addEventListener("visibilitychange", tic);
  return () => { clearInterval(id); document.removeEventListener("visibilitychange", tic); };
}
