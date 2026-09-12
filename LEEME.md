# La semana en casa — puesta en marcha

De prototipo a web con login. Tres pasos: base de datos, arrancar en local, publicar.
Tiempo real: entre 30 y 45 minutos la primera vez.

---

## 1. Base de datos (Supabase)

1. Entra en `supabase.com`, crea cuenta y pulsa **New project**. Región: Frankfurt o París.
   Apunta la contraseña de la base de datos, aunque no la vas a necesitar aquí.
2. Cuando termine de crearse, ve a **SQL Editor → New query**, pega entero el contenido de
   `supabase/schema.sql` y pulsa **Run**. Debe decir *Success*.
3. Ve a **Authentication → Providers → Email** y desactiva **Confirm email**.
   Para cinco personas de la misma casa, confirmar el correo solo estorba.
4. Ve a **Project Settings → API** y copia dos cosas:
   - **Project URL**
   - **anon public** (la clave larga)

La clave `anon` es pública por diseño: no da acceso a nada. Quien manda son las políticas
de seguridad del SQL, que comprueban en cada consulta si eres de la familia y si eres editor.
La otra clave (`service_role`) no se usa nunca en el navegador.

---

## 2. Arrancar en tu ordenador

Necesitas Node instalado (`node --version` debe responder algo).

```bash
cd semana-en-casa
cp .env.example .env      # y pega dentro tus dos valores
npm install
npm run dev
```

Abre lo que te diga la consola, normalmente `http://localhost:5173`.

Primera vez:
1. **Crear cuenta** con tu correo.
2. **Crear la familia** → entras como organizador.
3. En la barra negra, **Cuenta** → ahí está el **código de 6 letras** para la abuela.

Para probar los permisos: abre una ventana de incógnito, crea otra cuenta y entra con el
código. Verás la semana en gris claro y sin poder tocar nada.

---

## 3. Publicar en Render

1. Sube la carpeta a un repositorio de GitHub.
2. En Render: **New → Static Site** y conecta el repositorio.
3. Configuración:
   - Build command: `npm install && npm run build`
   - Publish directory: `dist`
4. En **Environment**, añade las dos variables: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
5. **Create Static Site**. En dos o tres minutos tienes la URL.

Static Site, no Web Service: no hay servidor propio que mantener ni que se duerma.

---

## Qué hay dentro

| Archivo | Para qué |
|---|---|
| `src/PlanFamiliar.jsx` | El planificador, tal cual lo has probado |
| `src/almacen.js` | Sustituye el guardado local por la base de datos |
| `src/Acceso.jsx` | Entrar, crear cuenta, recuperar contraseña |
| `src/Familia.jsx` | Crear una familia o unirse con código |
| `src/App.jsx` | Sesión, permisos y aviso de cambios de otros |
| `supabase/schema.sql` | Tablas y reglas de acceso |

El planificador **no se ha tocado**. `almacen.js` reemplaza `window.storage` por la base de
datos con la misma forma, así que todo lo que ajustes en el prototipo se puede traer
copiando el archivo encima.

---

## Cómo pasar tu semana real

En el prototipo: **Compartir → Copia → Copiar copia**. En la web, con la familia ya creada,
pégalo en **Compartir → Copia → Recuperar**. No hay que volver a teclear nada.

---

## Permisos

- **Editor**: cambia horarios, extraescolares y reparto. Jorge y Justine.
- **Lector**: solo mira. Abuela, Misa, Vanesa.

Quien entra con el código llega como lector. Para ascender a alguien, en Supabase
**Table Editor → miembros** y cambia `rol` a `editor`. Cuando haya más gente, esa
pantalla se añade a la app.

El bloqueo no es solo visual: aunque alguien manipulase el navegador, la base de datos
rechaza la escritura de un lector.

---

## Lo que falta para estar completo

1. **Avisos de verdad**. Ahora aparece una cinta amarilla si otro cambia algo mientras
   estás dentro. Para que llegue un correo o una notificación al móvil hace falta una
   función programada en Supabase que lea la tabla `cambios`. La tabla ya está creada y
   preparada.
2. **Semana tipo y semana concreta**. Hoy editas la plantilla: cambiar un jueves cambia
   todos los jueves. Es lo primero que conviene resolver.
3. **Dos personas editando a la vez**. Gana quien guarda el último. Con dos adultos es
   asumible; si molesta, se resuelve guardando por bloque en lugar de la semana entera.
