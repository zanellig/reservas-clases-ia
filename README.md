# Aula IA · Reservas de clases de IA

Prototipo de una plataforma donde los alumnos encuentran profesores de inteligencia artificial, consultan sus especialidades y horarios, y reservan una clase 1:1.

<!-- DEMO -->

## Requisitos

- [Bun](https://bun.sh) 1.3 o superior
- Una cuenta de [Convex](https://convex.dev) es opcional. `convex dev` puede levantar un backend local sin cuenta.

<!-- SETUP -->

## Comandos

| Comando | Qué hace |
| --- | --- |
| `bun run dev` | Sube las funciones a Convex, corre el seed y levanta la app en http://localhost:3000 |
| `bun run test` | Corre los tests del backend (vitest + convex-test) |
| `bun run typecheck` | Chequeo de tipos con `tsc` |
| `bun run build` | Build de producción |

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
- "Mis clases": próximas clases del alumno con su estado (Confirmada o Cancelada) y la opción de cancelar. Al cancelar, el turno vuelve a estar disponible.
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

Las mutations de Convex son transacciones serializables con control de concurrencia optimista. Si dos alumnos reservan el mismo turno al mismo tiempo, las dos leen el índice `by_slotId_and_status` y las dos intentan insertar. Convex confirma una y detecta que la otra leyó datos que cambiaron, así que la reintenta. En el reintento, esa segunda mutation ve la reserva ya hecha y falla con "Ese horario ya fue reservado". Esto no es una simulación: es la misma garantía que tendría la app en producción.

Con una base SQL, lo mismo se resuelve con un índice único parcial, que hace que la base rechace el segundo insert aunque dos requests lleguen juntas:

```sql
CREATE UNIQUE INDEX one_confirmed_booking_per_slot
  ON bookings (slot_id) WHERE status = 'confirmed';
```

**Validaciones.** El servidor es la fuente de verdad y responde con mensajes en español (`ConvexError`). El formulario repite las mismas reglas con `required`, `minLength` y `maxLength` para avisar antes de enviar, y los límites del tema vienen de una constante compartida (`convex/lib/constants.ts`). El id del alumno sale siempre de la sesión (`ctx.auth.getUserIdentity()`), nunca de los argumentos.

**Zona horaria.** Los horarios se guardan en UTC (epoch ms) y se muestran siempre en hora de Argentina (`America/Argentina/Buenos_Aires`). Con SSR, el servidor y el navegador pueden estar en zonas distintas. Fijar la zona hace que el HTML del servidor coincida con el del cliente y que el horario sea el mismo para todos los alumnos.

**Autenticación.** Better Auth corre dentro de Convex como componente, así que usuarios y sesiones viven en el mismo deployment que las reservas. TanStack Start reenvía `/api/auth/*` a Convex, y el token de la sesión se pasa a Convex también durante el SSR.

## Cómo validé el resultado

- Tests del backend en `convex/bookings.test.ts`, con el reloj fijo para que sean deterministas. Cubren: reserva exitosa, segundo alumno sobre el mismo turno, turno pasado, tema inválido, usuario sin sesión, superposición de horarios, cancelación que libera el turno, cancelación ajena o doble, `listMine` y `get` restringidos al dueño, y seed idempotente.
- Revisión del código generado contra el contrato de la API que definí antes de implementar.
- Prueba del flujo completo en el navegador con Playwright, incluida la reserva del mismo turno desde dos sesiones.

## Uso de IA

Usé [Claude Code](https://claude.com/claude-code) (Claude Opus 5.5) como asistente de programación:

- Primero lo usé para discutir el alcance y las decisiones de diseño: modelo de datos, estados de la reserva, validaciones y zona horaria.
- Yo armé la plantilla, el schema y el contrato de la API. Después, tres agentes de Claude trabajaron en paralelo sobre archivos separados: backend y tests en Convex, integración de Better Auth, y páginas de la UI.
- Las fotos de los profesores las generó ChatGPT (modelo de imágenes) a partir de un mismo estilo de referencia.
- Revisé el código, corrí los tests y probé el flujo en el navegador antes de cada commit.

## Limitaciones conocidas y próximos pasos

- Las queries usan `Date.now()`. Convex no las vuelve a ejecutar cuando pasa el tiempo, así que un turno que acaba de empezar sigue visible hasta que cambie algún dato. La solución es pasar la hora como argumento o redondearla en el cliente.
- No hay verificación de email ni recuperación de contraseña. Better Auth ya trae las dos cosas; falta configurar un proveedor de email (por ejemplo Resend).
- Pagos: crear una sesión de Stripe Checkout al confirmar, guardar la reserva como `pending` y pasarla a `confirmed` desde el webhook. Un cron libera los turnos `pending` que no se pagan en 15 minutos.
- Videollamada: al confirmar, una action de Convex crea la sala (Daily, Zoom o Google Meet) y guarda el link en la reserva.
- Lado del profesor: rol `teacher`, carga de disponibilidad semanal que genera `slots`, y vista de su agenda.
- Recordatorios por email con funciones programadas de Convex (`ctx.scheduler.runAt`).
