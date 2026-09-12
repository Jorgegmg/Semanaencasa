/* Service worker mínimo: hace falta para que iOS permita mostrar avisos
   desde la app instalada en la pantalla de inicio. */
self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((lista) => {
      for (const c of lista) if ("focus" in c) return c.focus();
      if (self.clients.openWindow) return self.clients.openWindow("/");
    })
  );
});

/* preparado para cuando enganchemos las notificaciones push de verdad */
self.addEventListener("push", (e) => {
  let d = { title: "La semana en casa", body: "" };
  try { d = e.data.json(); } catch (err) { if (e.data) d.body = e.data.text(); }
  e.waitUntil(self.registration.showNotification(d.title, { body: d.body, icon: "/icono-192.png", badge: "/icono-192.png" }));
});
