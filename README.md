# Aula IA · Reservas de clases de IA

Prototipo de una plataforma donde los alumnos encuentran profesores de inteligencia artificial, consultan sus especialidades y horarios, y reservan una clase 1:1.

**Demo:** https://reservas-clases-ia.vercel.app (Vercel, runtime Bun, con Convex de producción). Para reservar, creá una cuenta desde "Ingresar"; no hace falta verificar el email.

## Requisitos

- [Bun](https://bun.sh) 1.3 o superior
- Una cuenta de [Convex](https://convex.dev) es opcional. `convex dev` puede levantar un backend local sin cuenta.

## Instalación

```sh
git clone https://github.com/zanellig/reservas-clases-ia.git
cd reservas-clases-ia
bun install
```

1. Creá el deployment de Convex con `bunx convex dev --once`. La CLI pregunta si querés iniciar sesión o arrancar sin cuenta, y las dos opciones funcionan. Sin cuenta, Convex corre localmente en el puerto 3210. El comando escribe `.env.local` con las URLs del deployment.

   En este primer paso el push falla con `Required environment variables are not set: BETTER_AUTH_SECRET, SITE_URL`. Es lo esperado: el deployment ya existe, pero le faltan las variables de Better Auth.

2. Cargá esas dos variables en el deployment:

   ```sh
   bunx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
   bunx convex env set SITE_URL http://localhost:3000
   ```

3. Corré `bun run dev` y abrí http://localhost:3000. Para reservar, creá una cuenta desde "Ingresar".

`.env.example` lista las variables y explica de dónde sale cada una. No hace falta copiarlo, porque `convex dev` escribe `.env.local`.

## Comandos

| Comando             | Qué hace                                                                             |
| ------------------- | ------------------------------------------------------------------------------------ |
| `bun run dev`       | Sube las funciones a Convex, corre el seed y levanta la app en http://localhost:3000 |
| `bun run test`      | Corre los tests del backend (vitest + convex-test)                                   |
| `bun run typecheck` | Chequeo de tipos con `tsc`                                                           |
| `bun run build`     | Build de producción                                                                  |

## Deploy

La demo corre en Vercel. Nitro genera la salida para Vercel, y `bunVersion` en `vercel.json` hace que la función use el runtime de Bun. El backend es el deployment de producción de Convex. Para replicarlo:

```sh
bunx convex env set --prod BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
bunx convex env set --prod SITE_URL https://<tu-dominio>.vercel.app
bunx convex deploy
bunx convex run --prod seed:run
```

En Vercel hay que cargar `VITE_CONVEX_URL` y `VITE_CONVEX_SITE_URL` con las URLs `.convex.cloud` y `.convex.site` del deployment de producción, y desplegar con `vercel deploy --prod`. Los cambios en `convex/` se publican con `bunx convex deploy`, porque Vercel solo construye el frontend.

## Stack

- [TanStack Start](https://tanstack.com/start) (React 19, SSR, rutas por archivo)
- [Convex](https://convex.dev) como base de datos y backend: queries reactivas y mutations transaccionales
- [Better Auth](https://better-auth.com) con email y contraseña, integrado con el componente `@convex-dev/better-auth`
- [shadcn/ui](https://ui.shadcn.com) (Radix) y Tailwind CSS v4
- vitest y `convex-test` para los tests del backend

## Funcionalidades

- Lista de profesores con foto, especialidades y próximo horario libre.
- Perfil de cada profesor con bio, especialidades y horarios agrupados por día. Los turnos tomados aparecen como "Reservado" y no se pueden elegir.
- Reserva desde un diálogo: resumen del turno y un campo obligatorio para contar qué querés trabajar en la clase.
- Pantalla de confirmación con profesor, fecha, hora, duración, tema y estado.
- "Mis clases": próximas clases del alumno con su estado (Confirmada o Cancelada) y la opción de cancelar. La cancelación se ve al instante y se revierte sola si el servidor la rechaza. Al cancelar, el turno vuelve a estar disponible.
- Un alumno puede tener como máximo 5 clases futuras confirmadas.
- Registro e inicio de sesión con email y contraseña.
- Si otro alumno reserva un turno mientras lo estás mirando, la pantalla se actualiza sola, porque las queries de Convex son reactivas.

## Qué persiste y qué está simulado

- Persiste en Convex: profesores, horarios, reservas, usuarios y sesiones. Recargar la página o reiniciar el servidor no pierde nada.
- Simulado: los profesores y sus horarios son datos de ejemplo que crea `convex/seed.ts` (las fotos se generaron con IA). El seed corre en cada `bun run dev`, no duplica datos y vuelve a generar horarios para los próximos 10 días cuando un profesor se queda sin turnos futuros. También reserva 3 turnos a nombre de otro alumno ficticio, para que se vea un turno ocupado.
- No hay lado del profesor: los profesores no inician sesión ni cargan su disponibilidad.

## Decisiones técnicas

**Modelo de datos.** Tres tablas en `convex/schema.ts`: `teachers`, `slots` (un turno concreto con fecha y duración) y `bookings`. Un turno está disponible si no tiene ninguna reserva con estado `confirmed`. La disponibilidad sale de `bookings` y no de un campo en `slots`, así hay una sola fuente de verdad y cancelar una reserva libera el turno sin pasos extra.

**Reservas sin duplicados.** `bookings.create` (`convex/bookings.ts`) valida y guarda en una sola mutation, en este orden:

1. El alumno inició sesión.
2. El tema tiene entre 5 y 300 caracteres.
3. El turno existe.
4. El turno es futuro.
5. El turno no tiene una reserva confirmada.
6. El alumno no tiene otra clase en un horario que se superponga.
7. El alumno tiene menos de 5 clases futuras confirmadas.

Antes de esos chequeos, un rate limit por alumno (`@convex-dev/rate-limiter`) permite hasta 5 reservas o cancelaciones seguidas y después repone 10 por minuto.

Las mutations de Convex son transacciones serializables con control de concurrencia optimista. Si dos alumnos reservan el mismo turno al mismo tiempo, las dos leen el índice `by_slotId_and_status` y las dos intentan insertar. Convex confirma una y detecta que la otra leyó datos que cambiaron, así que la reintenta. En el reintento, esa segunda mutation ve la reserva ya hecha y falla con "Ese horario ya fue reservado". Es la misma garantía que tendría la app en producción.

Con una base SQL, lo mismo se resuelve con un índice único parcial, que hace que la base rechace el segundo insert aunque dos requests lleguen juntas:

```sql
CREATE UNIQUE INDEX one_confirmed_booking_per_slot
  ON bookings (slot_id) WHERE status = 'confirmed';
```

**Validaciones.** El servidor es la fuente de verdad y responde con mensajes en español (`ConvexError`). El formulario repite las mismas reglas con `required`, `minLength` y `maxLength` para avisar antes de enviar, y los límites del tema vienen de una constante compartida (`convex/lib/constants.ts`). El id del alumno sale siempre de la sesión (`ctx.auth.getUserIdentity()`), nunca de los argumentos.

**Zona horaria.** Los horarios se guardan en UTC (epoch ms) y se muestran siempre en hora de Argentina (`America/Argentina/Buenos_Aires`). Con SSR, el servidor y el navegador pueden estar en zonas distintas. Fijar la zona hace que el HTML del servidor coincida con el del cliente y que el horario sea el mismo para todos los alumnos.

**Autenticación.** Better Auth corre dentro de Convex como componente, así que usuarios y sesiones viven en el mismo deployment que las reservas. TanStack Start reenvía `/api/auth/*` a Convex, y el token de la sesión se pasa a Convex también durante el SSR.

**Rate limit de auth.** Better Auth limita login y registro a 3 intentos cada 10 segundos por IP, y guarda los contadores en la tabla `rateLimit` del componente. No usa memoria, porque en Convex cada request puede correr en un isolate distinto. El edge de Convex reemplaza `x-forwarded-for` por la IP de quien se conecta, que en este caso es el servidor de TanStack. Por eso el proxy (`src/routes/api/auth/$.ts`) manda la IP del navegador en `x-client-ip`. Sin ese header, todos los usuarios compartirían un mismo límite.

**Carga de datos.** Cada ruta pide sus datos en el loader con `queryClient.query`, así la página llega del servidor con contenido y el router la precarga cuando el mouse pasa por encima de un link. Las rutas privadas también, con el token de la sesión. En el navegador, la sesión se consulta al servidor una vez por carga de página y no en cada navegación.

**Actualizaciones optimistas.** Cancelar es optimista (`withOptimisticUpdate` de Convex): la tarjeta pasa a "Cancelada" antes de la respuesta, y Convex descarta el cambio local si el servidor falla. Reservar no es optimista, porque el resultado depende de otros alumnos y mostrar "Confirmada" para después revertirlo sería peor que esperar unos cientos de milisegundos. Los reintentos ya los hace Convex: el cliente reenvía las mutations si se corta la conexión, y el servidor reintenta los conflictos de concurrencia. Los errores que llegan a la UI son de negocio, como un turno ya tomado, y no se reintentan.

## Cómo validé el resultado

- Tests del backend en `convex/bookings.test.ts`, con el reloj fijo para que sean deterministas. Cubren: reserva exitosa, segundo alumno sobre el mismo turno, turno pasado, tema inválido, usuario sin sesión, superposición de horarios, cancelación que libera el turno, cancelación ajena o doble, `listMine` y `get` restringidos al dueño, rate limit por alumno, tope de 5 clases futuras y seed idempotente.
- Una prueba de concurrencia real en `scripts/race-check.ts`. Registra dos alumnos y les hace reservar el mismo turno con dos `bookings.create` simultáneos contra el deployment. Lo corrí 7 veces y en todas se confirmó exactamente una reserva. Para repetirlo, con `bun run dev` corriendo: `bun scripts/race-check.ts`.
- Revisión del código generado contra el contrato de la API que definí antes de implementar.
- El flujo completo en Chromium con Playwright: registro, reserva, validación del tema, confirmación, "Mis clases" y cancelación, en escritorio y en mobile, sin errores de hidratación en consola.
- La cancelación optimista: con la mutation retenida, la tarjeta cambia a "Cancelada" en 23 ms; si el servidor la rechaza, vuelve a "Confirmada" y se muestra el error.
- El rate limit de auth con `curl`: con 4 intentos de login seguidos desde la misma IP, el cuarto recibe 429, y una IP distinta no se ve afectada.
- Una instalación desde un clon limpio, siguiendo este README con un deployment local de Convex sin cuenta.

## Uso de IA

Usé varios modelos y asigné cada tarea según su tipo.

**[Claude Code](https://claude.com/claude-code) (Claude Opus 5.5) como orquestador.**

- Primero lo usé para discutir el alcance y las decisiones de diseño: modelo de datos, estados de la reserva, validaciones y zona horaria.
- Con Claude armé la plantilla, el schema y el contrato de la API.
- Después, agentes de Claude Opus trabajaron en paralelo, cada uno sobre sus propios archivos:
  - Backend y tests en Convex
  - Integración de Better Auth
  - Páginas de la UI
  - Precarga de las rutas privadas
  - Cancelación optimista
- Claude integró el trabajo de los agentes, investigó los problemas que aparecieron (el rate limit global de auth y el script `dev`) e hizo el deploy.
- También hizo el prototipo de variantes de favicon del que elegí el birrete actual.

<details>
<summary>Cómo elegí el favicon</summary>

Claude armó una ruta descartable, `/prototype/favicon`, con cinco candidatos en SVG y la paleta del sitio: A (el ícono anterior, una "A" con una chispa), B (chispa), C (burbuja de chat), D (otra "A" con chispa, sobre fondo menta) y E (birrete). Con `?variant=` o las flechas ← → pasaba de una a otra, y la variante activa reemplazaba también el ícono real de la pestaña:

```tsx
for (const l of document.querySelectorAll('link[rel="icon"]')) l.href = v.src;
```

Cada variante se veía donde de verdad se juzga un favicon: en una barra de pestañas clara y oscura, en el encabezado, en la pantalla de inicio del celular y rasterizada a 16, 32 y 48 px reales, ampliada sin suavizado:

```tsx
ctx.drawImage(img, 0, 0, props.size, props.size); // canvas de size×size
<canvas width={size} height={size} style={{ width: px, height: px, imageRendering: "pixelated" }} />
```

Elegí E porque a 16 px se sostiene mejor que la "A" con chispa anterior. Pasó a `public/favicon.svg` y la ruta del prototipo se borró.

</details>

**Sol 6.1 (OpenAI, vía Codex CLI, razonamiento alto).**

- **Configuración del repo para agentes:** `AGENTS.md`, `docs/agents/`, GitHub Issues como tracker y etiquetas de triage (PR #1).
- **Investigación de la carga de imágenes:**
  - Encontró que el Avatar de Radix creaba la imagen recién después de hidratar.
  - Lo midió con Playwright: con JavaScript demorado 2 segundos, el pedido de las fotos se corría los mismos 2 segundos.
  - Propuso el patch que apliqué, con un `<img>` nativo en el SSR, fotos de 192 px y una hora de caché.
- **Licencia MIT.**

**Astra 6 (OpenAI, vía Codex CLI, razonamiento extra alto).**

- Una revisión de seguridad adversarial del código.
- Una segunda sesión verificó los hallazgos contra el código y las dependencias instaladas, sin crear exploits ni atacar el backend, y los publicó en el issue #2:
  - Sesiones revocadas que siguen sirviendo hasta que vence el JWT.
  - Un open redirect en `/login` con caracteres de control.
  - Un `.take(100)` que puede ocultar reservas confirmadas.
- Esos tres hallazgos encabezan los próximos pasos.

**ChatGPT (modelo de imágenes).** Generó las fotos de los profesores a partir de un mismo estilo de referencia.

**Cómo validé lo que generaron.**
- Revisé el código contra el contrato.
- Corrí los tests, el typecheck y Biome antes de cada commit.
- Probé el flujo en el navegador.
- Verifiqué cada propuesta aplicada con una prueba. Por ejemplo, el script de Sol pasó de FAIL a OK, y el rate limit lo comprobé con `curl` en local y en producción.

## Limitaciones conocidas

- Las queries usan `Date.now()`. Convex no las vuelve a ejecutar cuando pasa el tiempo, así que un turno que acaba de empezar sigue visible hasta que cambie algún dato. La solución es pasar la hora como argumento o redondearla en el cliente.
- Quien llame directamente a la URL `.convex.site` puede mandar cualquier `x-client-ip` y esquivar el rate limit de auth por IP. En producción conviene un secreto compartido entre el proxy y Convex, o un rate limit en el WAF.
- El rate limit de reservas corre dentro de la transacción. Si la reserva falla, por ejemplo porque el turno ya estaba tomado, el token se devuelve, así que solo cuentan las escrituras exitosas.
- Si la sesión vence a mitad de una visita, la UI la sigue mostrando como activa hasta recargar. El servidor igual rechaza las operaciones.
- No hay verificación de email ni recuperación de contraseña. Better Auth ya trae las dos cosas; falta configurar un proveedor de email (por ejemplo Resend).

## Explicación, seguridad y próximos pasos

### Qué hice

Demo: lista de profesores, perfil, elegir horario, diálogo con el tema, confirmación, "Mis clases" y cancelación. Para mostrar que no hay reservas duplicadas, abrí el mismo turno en dos navegadores con cuentas distintas y confirmá en los dos: uno queda confirmado y el otro recibe "Ese horario ya fue reservado". `bun scripts/race-check.ts` hace lo mismo con dos requests simultáneos.

- Funciona de verdad: registro e inicio de sesión, persistencia, reservas, cancelación, validaciones y rate limits.
- Simulado: profesores, horarios y fotos (seed y fotos generadas con IA).
- Pendiente: el lado del profesor, pagos, videollamada, verificación de email y los hallazgos del issue #2.

### Tecnologías

- **TanStack Start.** SSR con loaders que precargan datos al pasar el mouse por un link, y rutas de servidor para el proxy de auth.
- **Convex.** Base de datos y backend en TypeScript. Las mutations son transacciones, lo que resuelve la concurrencia de reservas, y las queries reactivas actualizan los turnos sin polling. No hizo falta escribir una API aparte.
- **Better Auth.** Email y contraseña, corriendo dentro de Convex, sin depender de un servicio externo.
- **shadcn/ui y Tailwind.** Componentes accesibles sin diseñar desde cero.
- **Herramientas.** Biome, vitest y `convex-test`. La demo corre en Vercel con runtime Bun.
- **IA.** Claude Code (Claude Opus 5.5) y ChatGPT. Ver "Uso de IA" y "Cómo validé el resultado".

### Decisiones técnicas y dificultades

**Organización del código.**
- `convex/`: schema, `teachers`, `bookings`, `seed` y helpers en `lib/`.
- `src/routes`: una ruta por pantalla.
- `src/components`: componentes compartidos.

Definí el contrato de la API antes de repartir el trabajo, así backend, auth y UI pudieron avanzar en paralelo sin pisarse.

Datos, reservas y validaciones están en "Decisiones técnicas", más arriba.

Dificultades que encontré:
1. **El rate limit de auth era global.** El edge de Convex reemplaza `x-forwarded-for` por la IP del servidor de TanStack. Lo detecté con una ruta temporal que devolvía los headers que recibe Convex, y lo resolví mandando la IP del navegador en `x-client-ip`.
2. **Las fotos aparecían tarde.** El Avatar de Radix crea la imagen recién después de hidratar. Lo cambié por un `<img>` nativo que ya viene en el HTML del servidor, y bajé las fotos de 512 a 192 px (de 106 KB a 22 KB en total).
3. **`convex dev --run` ignoraba `--start`.** Por eso Vite no arrancaba. Lo separé en dos pasos.

### Cómo lo escalaría

- **Permisos.** Una tabla de usuarios con rol (`student`, `teacher`, `admin`) y un helper `requireRole` en cada función.
- **Datos.** Convex escala con índices. Los listados tienen que paginar con `.paginate()` en vez de cortar con `.take(100)`.
- **Concurrencia.** Ya es transaccional. En una base SQL, la usaría junto con un índice único parcial por turno.
- **Pruebas.** `convex-test` para cada regla de negocio y cada permiso, Playwright en CI para el flujo completo, y `race-check` contra cada preview.
- **Rendimiento.** Queries por índice, precarga de rutas, CDN para los assets e imágenes del tamaño en que se muestran.
- **Pagos.** Stripe Checkout:
  1. La reserva se crea como `pending`.
  2. Un webhook con firma verificada la pasa a `confirmed`, usando el id del evento como clave de idempotencia.
  3. Un cron libera las reservas `pending` que no se pagan en 15 minutos.
- **Videollamada.** Al confirmar, una action crea la sala (LiveKit o Daily). Solo el alumno y el profesor de esa reserva reciben un token de acceso, y el token vence.

### Seguridad

**Autenticación y sesiones.**
- Implementado:
  - Better Auth guarda las contraseñas con hash scrypt y la sesión en una cookie `httpOnly`.
  - Convex recibe un JWT que vence a los 15 minutos.
  - "Salir" borra la sesión.
  - Login y registro tienen un límite de 3 intentos cada 10 segundos por IP.
- Propuesto:
  - Verificación de email y recuperación de contraseña.
  - Validar que la sesión siga activa en cada función (issue #2, P1).
  - 2FA para profesores y administradores.

Con un proveedor como Firebase Authentication, la identidad la resuelve el proveedor. La app sigue a cargo de la autorización, de quién es dueño de cada reserva, de los límites de negocio y de los datos.

**Roles y permisos.**
- Implementado:
  - El id del alumno sale del token (`ctx.auth.getUserIdentity()`), nunca de los argumentos.
  - `bookings.get` y `bookings.cancel` comparan `booking.studentId` con ese id. Si no coinciden, `get` devuelve `null` y `cancel` responde "No encontramos esa reserva", sin revelar si la reserva existe.
  - Cambiar el id en la URL o llamar directo a la API no alcanza para ver ni cancelar reservas ajenas, y hay tests que lo verifican.
- Propuesto:
  - El profesor ve y gestiona solo sus turnos.
  - El administrador tiene acceso completo, con registro de auditoría.

**Backend y base de datos.**
- Implementado:
  - Todas las funciones validan sus argumentos con `v`.
  - Las reglas de negocio se validan dentro de la mutation.
  - El seed es una `internalMutation` que no se puede llamar desde el cliente.
- Cómo se prueba: Convex no tiene reglas de acceso como Firestore, así que la autorización vive en cada función, y se prueba con `convex-test` usando identidades distintas.

**Integridad de las reservas.**
- Implementado:
  - Transacciones serializables, explicadas más arriba.
  - Una solicitud repetida falla con un error claro ("ya fue reservado", "ya estaba cancelada").
  - La UI bloquea el doble clic.
  - El cliente de Convex reenvía las mutations sin confirmar y el servidor descarta los duplicados.
- Propuesto: claves de idempotencia para los webhooks de pago.

**Datos y secretos.**
- Qué guardamos: nombre, email, hash de la contraseña y las reservas con su tema.
- Implementado:
  - `BETTER_AUTH_SECRET` vive en las variables de entorno de Convex, nunca en el repo.
  - `.env.local` está en `.gitignore` y `.env.example` no tiene valores.
  - Las variables `VITE_*` son públicas y solo contienen URLs.
  - Todo el tráfico va por HTTPS (Vercel y Convex).
- Propuesto: no registrar email ni tema en los logs, y definir una política de retención de datos.

**Ataques y abuso.**
- Implementado:
  - **XSS:** React escapa todo y no usamos `dangerouslySetInnerHTML`; el tema se muestra como texto.
  - **Inyección:** no hay SQL; las consultas usan índices tipados.
  - **Requests de otro sitio:** Better Auth valida el `Origin`.
  - **Automatización:** rate limit de auth por IP, token bucket por alumno en las reservas y un tope de 5 clases futuras.
  - **Open redirect:** se valida el `redirect` del login.
- Pendiente:
  - Rechazar caracteres de control en ese `redirect` (issue #2).
  - Un secreto compartido entre el proxy y Convex, para que nadie pueda falsificar `x-client-ip`.

**Servicios externos.**
- Verificar la firma de cada webhook (`Stripe-Signature`) y procesar cada evento una sola vez.
- Links de videollamada con un token por usuario que vence.
- Las claves de API solo en actions del servidor.

### Seguridad en producción

- Actualizar dependencias con Renovate y revisar vulnerabilidades en CI.
- Tests de permisos en cada PR.
- Registrar reservas, cancelaciones y logins fallidos sin datos personales.
- Alertas por picos de errores o de respuestas 429.
- Exportaciones programadas de Convex, con pruebas de restauración.
- Si se expone una credencial:
  1. Rotarla. Rotar `BETTER_AUTH_SECRET` invalida todas las sesiones.
  2. Revocar las sesiones.
  3. Revisar los logs del período expuesto.
  4. Avisar a los usuarios afectados.

**Tres riesgos priorizados:**

| Riesgo | Medida | Prueba |
| --- | --- | --- |
| Un alumno ve o cancela una reserva ajena | Verificar el dueño en el servidor | Test con dos identidades (ya existe) y un request directo a la API con el token de otro usuario |
| Dos alumnos reservan el mismo turno | Transacción serializable | `bun scripts/race-check.ts` (7 de 7 corridas OK) |
| Fuerza bruta o bots | Rate limit por IP y por alumno | 4 logins seguidos devuelven 429 (verificado); test del token bucket (ya existe) |

Antes del lanzamiento son indispensables: estas tres medidas, el issue #2, la verificación de email y el secreto entre el proxy y Convex. En una etapa posterior: 2FA, WAF y auditoría para administradores.

### Próximos pasos, en orden

1. **Issue #2, P1.** En `requireStudentId`, validar que la sesión siga activa. Se comprueba con un test que revoca la sesión y espera que la reserva se rechace.
2. **Issue #2, P2.** En `/login`, rechazar caracteres de control y comparar el origen con `new URL()`. Se comprueba con tests de casos válidos y maliciosos.
3. **Issue #2, P2.** Reemplazar `.take(100)` por un índice con estado y paginación. Se comprueba con un test que crea 101 reservas canceladas antes de una confirmada.
4. **Verificación de email y recuperación de contraseña,** con Resend.
5. **Lado del profesor:** disponibilidad semanal que genera los turnos, y una vista de su agenda.
6. **Pagos con Stripe,** y después la videollamada.
7. **Plataforma de contenidos.**
   - Para profesores: subir y administrar clases grabadas y tareas, con visibilidad, publicación programada (`ctx.scheduler.runAt`), capítulos y subtítulos. Los subtítulos se pueden subir o generar automáticamente con WhisperX u otro modelo de voz a texto, en un worker.
   - Para alumnos: ver las clases, entregar tareas y seguir su progreso, al estilo Udemy o Classroom pero más personal.
   - Clases 1:1 en vivo con WebRTC (LiveKit o un SFU propio) dentro de la misma plataforma.
   - Cada flujo se comprueba con un test de Playwright.

## Licencia

Este proyecto se distribuye bajo la [licencia MIT](LICENSE).
