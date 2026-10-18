# API para tus bots

Tus bots de IA pueden **leer y escribir** en tu app a través de una sola
dirección protegida con una llave (`BOT_API_KEY`).

- **Dirección:** `https://TU-SITIO.netlify.app/.netlify/functions/bot`
- **Siempre** `POST`, con un cuerpo JSON que dice la acción: `{"action": "..."}`
- **Siempre** con el encabezado `Authorization: Bearer TU_BOT_API_KEY`

---

## Qué puede hacer un bot (y qué no)

| Puede | Acción |
| --- | --- |
| Agregar una tarea (casa, trabajo, salud o familia) | `add_task` |
| Agregar algo que **solo tú** puedes hacer o aprobar (PRs, guiones, compras, decisiones) | `add_task` con `"needs_me": true` |
| Agregar una tarea de casa | `add_home_task` |
| Marcar o desmarcar una tarea como "Esperando por ti" | `set_needs_me` |
| Marcar como hecha una tarea que dejó un bot | `complete_task` |
| Ver lo de hoy (con tu marcador y racha) | `today` |
| Marcar un no negociable de hoy ("hice gym") | `mark_non_negotiable` |
| Agregar un evento (escuela, actividades de los niños) | `add_event` |
| Leer el resumen de la semana | `week_summary` |
| Revisar Strava ahora y marcar gym/ejercicio si entrenaste | `sync_strava` |
| Avisar qué está haciendo un bot (pestaña **Oficina**) | `set_status` |

`set_status` guarda una fila en `os_bot_activity` (no toca `app_state`):

```bash
curl -X POST "$URL" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "set_status", "bot": "scheduling", "status": "working", "activity": "Reagendando citas de mañana"}'
```

`bot`: bonalti, grok, scheduling, ranch, appt, accounting, founder, ceo, salud, familia, research, email, tc, closers, selections, youtube, news.
`status`: `working`, `idle` o `paused`. `activity` es opcional (máx. 500 caracteres).

- **Solo lectura:** tus no negociables, tus check-ins, tus tableros de casa y
  trabajo y tus 3 prioridades. El bot los puede ver, pero **no** cambiarlos.
- **La función nunca escribe en `app_state`** (donde la app guarda tus
  tableros y tus no negociables). Así un bot nunca puede borrar algo que estás
  cambiando con la app abierta. Lo que hacen los bots se guarda en tablas
  propias:
  - `os_items`: las tareas que te dejan los bots (y las que te esperan a ti).
  - `os_events`: los eventos que mandan los bots.
  - `os_nonneg_marks`: cuando un bot (o Strava) marca un no negociable. La app
    lo pasa a tu lista sola, como si lo hubieras tocado tú.
- **No puede:** borrar nada, ni ver tu diario, finanzas, salud, familia ni
  ninguna otra página.

## Dónde ves todo esto en la app

- **Inicio → Marcador del día:** el % de tus no negociables de hoy que ya
  hiciste (0 a 100 %), tu racha de días seguidos al 100 % y tu mejor racha.
  Sale de tus mismos check-ins; no hay que hacer nada nuevo.
- **Inicio → Prioridades de la semana:** tus 3 prioridades, toda la semana.
  Si no las pusiste el domingo, las puedes escribir ahí mismo.
- **Inicio → Resumen de la semana:** el **domingo** aparece en Inicio, junto a
  tus no negociables ("Plan the week ahead" tiene un botón **Review**). Los
  otros días lo abres desde "Prioridades de la semana". Muestra:
  - lo que hiciste por área (casa, trabajo, salud y familia), contando tus
    tableros de casa y trabajo y las tareas de bots,
  - el % de no negociables de cada día de la semana,
  - un espacio para escoger tus 3 prioridades de la semana que viene.
- **Inicio → Eventos de hoy** y **Calendario:** los eventos que mandaron tus
  bots. En el Calendario los puedes borrar.
- **Inicio → Esperando por ti** (arriba de "De mis bots"): lo que solo tú
  puedes hacer o aprobar. Si las notas traen un link (un PR, un documento),
  sale un botón **Open ↗**. Lo palomeas cuando ya lo hiciste.
- **Inicio → De mis bots:** las demás tareas abiertas de tus bots y las que
  terminaste hoy. Las de casa también salen en **Tareas de casa**.
- **No negociables:** el que marcó un bot o Strava aparece palomeado con
  "via nombre-del-bot". Si lo desmarcas tú, también se borra la marca.

---

## Las acciones, con ejemplos

Pon esto una vez en tu terminal para copiar los ejemplos tal cual:

```bash
URL="https://TU-SITIO.netlify.app/.netlify/functions/bot"
KEY="tu-bot-api-key"
```

### 1. Agregar una tarea — `add_task`

```bash
curl -X POST "$URL" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "add_task",
    "title": "Mandar los números del Q4 al contador",
    "area": "trabajo",
    "bot": "asistente-correo",
    "due": "2026-10-20",
    "priority": "alta",
    "notes": "Los pidió dos veces"
  }'
```

| Campo | ¿Obligatorio? | Qué va |
| --- | --- | --- |
| `title` | Sí | El nombre de la tarea (hasta 300 letras). |
| `bot` | Sí | Qué bot la crea, por ejemplo `"telegram"` (hasta 60 letras). |
| `area` | Sí | `casa`, `trabajo`, `salud` o `familia` (también acepta `home`, `work`, `health`, `family`). |
| `due` | No | La fecha: `AAAA-MM-DD`, o `"hoy"` / `"mañana"` (también `"today"` / `"tomorrow"`). |
| `priority` | No | `baja`, `media` (si no pones nada) o `alta` (también `low` / `medium` / `high`). |
| `notes` | No | Notas (hasta 5000 letras). Si traen un link, la app muestra **Open ↗**. |
| `needs_me` | No | `true` si **solo tú** lo puedes hacer o aprobar → sale en "Esperando por ti". Si no lo pones: `false`. |

Responde con la tarea creada. Guarda el `id` si luego la quieres marcar:

```json
{
  "ok": true,
  "task": {
    "id": "5adc1570-5ce7-409c-b68c-edca436bc05a",
    "title": "Mandar los números del Q4 al contador",
    "notes": "Los pidió dos veces",
    "bot": "asistente-correo",
    "area": "trabajo",
    "due": "2026-10-20",
    "priority": "alta",
    "status": "abierta",
    "needs_me": false,
    "done_at": null,
    "created_at": "2026-10-17T14:49:01.120Z"
  }
}
```

**Ejemplo de "Esperando por ti"** (un PR que tienes que aprobar):

```bash
curl -X POST "$URL" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "add_task", "title": "Aprobar PR #12: texto de la landing", "area": "trabajo", "bot": "dev-bot", "needs_me": true, "notes": "https://github.com/tu-org/tu-repo/pull/12"}'
```

### 2. Agregar una tarea de casa — `add_home_task`

Igual que `add_task`, pero el área siempre es `casa` (no hace falta ponerla).

```bash
curl -X POST "$URL" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "add_home_task", "title": "Comprar filtros del A/C 20x25x1", "bot": "telegram", "due": "hoy"}'
```

> **¿Por qué no va a mi tablero semanal de casa?** Ese tablero vive en
> `app_state`, y si un bot escribiera ahí mientras tienes la app abierta, uno
> de los dos podría borrar el cambio del otro. Por eso la tarea se guarda en
> `os_items` y aparece en **Inicio** y en la página de **Tareas de casa**, en su
> propia sección "De mis bots".

### 3. Marcar algo como "Esperando por ti" — `set_needs_me`

Para una tarea que ya existe. `true` la pasa a "Esperando por ti"; `false` la
regresa a "De mis bots".

```bash
curl -X POST "$URL" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "set_needs_me", "id": "5adc1570-5ce7-409c-b68c-edca436bc05a", "needs_me": true}'
```

### 4. Marcar una tarea como hecha — `complete_task`

Funciona con cualquier tarea que dejó un bot (también las de "Esperando por
ti"). Usa su `id`.

```bash
curl -X POST "$URL" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "complete_task", "id": "5adc1570-5ce7-409c-b68c-edca436bc05a"}'
```

### 5. Ver lo de hoy — `today`

```bash
curl -X POST "$URL" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "today"}'
```

Responde así (ejemplo de un sábado):

```json
{
  "ok": true,
  "date": "2026-10-17",
  "weekday": "Saturday",
  "timezone": "America/Chicago",
  "score": { "done": 1, "total": 6, "percent": 17, "streak": 10, "best_streak": 10 },
  "priorities": ["Cerrar el trato de Harlingen", "Gym 5 veces", "Cita con mi esposa"],
  "waiting_for_you": [
    { "id": "4357…", "title": "Aprobar PR #12: texto de la landing", "area": "trabajo", "needs_me": true,
      "bot": "dev-bot", "notes": "https://github.com/tu-org/tu-repo/pull/12", "due": null,
      "priority": "media", "status": "abierta", "done_at": null, "created_at": "2026-10-17T15:20:00.000Z" }
  ],
  "bot_tasks": [
    { "id": "5adc…", "title": "Mandar los números del Q4 al contador", "area": "trabajo", "needs_me": false,
      "bot": "asistente-correo", "notes": "Los pidió dos veces", "due": "2026-10-20",
      "priority": "alta", "status": "abierta", "done_at": null, "created_at": "2026-10-17T14:49:01.120Z" }
  ],
  "events": [
    { "id": "8b90…", "title": "Natalia — práctica de fútbol", "area": "familia", "day": "2026-10-17",
      "start_time": "18:00", "end_time": "19:15", "notes": "Llevar agua", "bot": "school-bot", "created_at": "…" }
  ],
  "non_negotiables": [
    { "id": "nn_sleep", "text": "Sleep — at least 7 hours", "done": false, "marked_by_bot": null },
    { "id": "nn_wend_relax", "text": "Relax & recharge", "done": true, "marked_by_bot": null },
    { "id": "nn_wend_move", "text": "Move / exercise", "done": true, "marked_by_bot": "strava" }
  ],
  "home_tasks": [ { "id": "w_abc", "text": "Mow the lawn", "done": false, "urgent": false } ],
  "work_tasks": [ { "id": "w_def", "text": "Call title company", "done": false, "urgent": true, "company": "stb" } ]
}
```

- `score`: tu **marcador del día** — cuántos no negociables de hoy llevas
  (`done` de `total`, y `percent`), tu racha (`streak`: días seguidos al
  100 %) y tu mejor racha (`best_streak`). Hoy cuenta en la racha cuando llegas
  al 100 %; mientras tanto, la racha es la que terminó ayer.
- `priorities`: tus 3 prioridades de esta semana.
- `waiting_for_you`: lo que solo tú puedes hacer o aprobar.
- `bot_tasks`: las demás tareas abiertas de tus bots, más las de hoy y las que
  terminaste hoy.
- `events`: los eventos de hoy.
- `non_negotiables`: **solo los que aplican hoy** (entre semana o fin de
  semana, igual que en Inicio), y si ya están hechos.
- `home_tasks` y `work_tasks`: lo que tienes hoy en tus tableros. **Solo lectura.**

### 6. Marcar un no negociable de hoy — `mark_non_negotiable`

Por ejemplo, cuando le dices a tu bot "hice gym". Usa los no negociables que
ya tienes en la app; no se crea ninguno nuevo. Mándalo por `id` (de `today`) o
por palabras con `text`:

```bash
# Por palabras
curl -X POST "$URL" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "mark_non_negotiable", "text": "gym", "bot": "telegram"}'

# Por id (más seguro)
curl -X POST "$URL" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "mark_non_negotiable", "id": "nn_gym", "bot": "telegram"}'
```

- Con `text`, busca el no negociable de hoy que contenga esas palabras (sin
  importar mayúsculas ni acentos). **Nunca adivina:** si hay dos parecidos,
  responde `409` con la lista (`options`) para que el bot elija el `id`. Si no
  hay ninguno, responde `404` con la lista de los de hoy.
- Solo marca no negociables **de hoy**. Ojo: "Gym / exercise" es de entre
  semana; el sábado y domingo el tuyo es "Move / exercise".
- Si ya estaba marcado, responde `"already_done": true` y no cambia nada.

### 7. Agregar un evento — `add_event`

Para la escuela y las actividades de los niños. Sale en el **Calendario** y en
**Inicio** el día que toca.

```bash
curl -X POST "$URL" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "add_event",
    "title": "Natalia — práctica de fútbol",
    "date": "2026-10-21",
    "time": "6pm",
    "end_time": "7:15 pm",
    "bot": "school-bot",
    "notes": "Llevar agua y espinilleras"
  }'
```

| Campo | ¿Obligatorio? | Qué va |
| --- | --- | --- |
| `title` | Sí | El nombre del evento (hasta 300 letras). |
| `date` | Sí | `AAAA-MM-DD`, `"hoy"` o `"mañana"`. |
| `bot` | Sí | Qué bot lo manda. |
| `area` | No | `familia` si no pones nada (también `casa`, `trabajo`, `salud`). |
| `time` | No | Hora de inicio: `"18:00"`, `"7:30"`, `"6pm"`, `"7:30 pm"`. Sin hora = todo el día. Un `"7"` solo no se acepta (¿mañana o tarde?). |
| `end_time` | No | Hora de fin (después de `time`). |
| `notes` | No | Notas (hasta 5000 letras). |

Si el bot manda **el mismo evento dos veces** (mismo título, mismo día, misma
hora), no se duplica: responde `"duplicate": true` con el evento que ya
existía.

### 8. Leer el resumen de la semana — `week_summary`

```bash
# Esta semana
curl -X POST "$URL" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "week_summary"}'

# Otra semana: cualquier día de esa semana
curl -X POST "$URL" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "week_summary", "date": "2026-10-09"}'
```

```json
{
  "ok": true,
  "week_start": "2026-10-12",
  "week_end": "2026-10-18",
  "by_area": {
    "casa":    { "count": 2, "items": [ { "title": "Fix sink", "date": "2026-10-14", "source": "board" } ] },
    "trabajo": { "count": 2, "items": [ { "title": "Aprobar PR #12", "date": "2026-10-17", "source": "bot" } ] },
    "salud":   { "count": 0, "items": [] },
    "familia": { "count": 0, "items": [] }
  },
  "non_negotiables": [
    { "date": "2026-10-12", "weekday": "Monday", "done": 4, "total": 4, "percent": 100 },
    { "date": "2026-10-17", "weekday": "Saturday", "done": 1, "total": 6, "percent": 17 },
    { "date": "2026-10-18", "weekday": "Sunday", "done": 0, "total": 0, "percent": null }
  ],
  "average_percent": 86,
  "priorities": {
    "this_week": ["Cerrar el trato de Harlingen", "Gym 5 veces", "Cita con mi esposa"],
    "next_week": ["Contratar al PM"]
  }
}
```

- `by_area`: lo que terminaste esa semana, por área. **Casa** y **trabajo**
  cuentan tus tableros (`source: "board"`) y las tareas de bots
  (`source: "bot"`); **salud** y **familia** cuentan tareas de bots. Una tarea
  del tablero cuenta si tiene hora de terminada (la app la guarda al palomear).
- `non_negotiables`: el % de cada día. `null` = ese día todavía no llega.
- `average_percent`: el promedio de los días que ya pasaron (hoy incluido).
- `priorities`: las 3 de esa semana y las de la siguiente. **Solo se escogen
  en la app** (el bot las lee, no las cambia).

### 9. Revisar Strava ahora — `sync_strava`

```bash
curl -X POST "$URL" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "sync_strava"}'
```

```json
{ "ok": true, "date": "2026-10-17",
  "workouts": [ { "name": "Morning lift", "type": "WeightTraining", "minutes": 45 } ],
  "marked": { "id": "nn_wend_move", "text": "Move / exercise" }, "already_done": false }
```

Lee tus entrenos de Strava **de hoy** y marca **solo** el no negociable de gym
o ejercicio de hoy ("Gym / exercise" entre semana, "Move / exercise" el fin de
semana). Nada más.

- Cuenta cualquier entreno de **10 minutos o más** que empezó hoy.
- Si no entrenaste hoy: `"marked": null, "reason": "no_workout_today"`.
- Si ninguno de tus no negociables de hoy suena a ejercicio (gym, exercise,
  ejercicio, workout, entreno, training…), o si **hay más de uno**, no marca
  nada y te lo dice (`reason` y `options`). Nunca adivina.
- **No necesitas llamarla:** la app la corre sola **cada 30 minutos** (una
  función programada de Netlify, `strava-sync`). Esta acción es para cuando un
  bot quiere revisar ya.

---

## Si algo sale mal

Toda respuesta trae `"ok"`. Si es `false`, también trae `error` (un código) y
`message` (qué pasó).

| Código HTTP | `error` | Qué significa |
| --- | --- | --- |
| 400 | `missing_field`, `bad_field`, `bad_area`, `bad_date`, `bad_time`, `bad_priority`, `bad_id`, `too_long`, `invalid_json`, `unknown_action` | Faltó un dato o vino mal. El `message` dice cuál. |
| 401 | `unauthorized` | Falta la llave o está mal. |
| 404 | `not_found`, `none_today` | No existe esa tarea, o ese no negociable no aplica hoy. |
| 405 | `method_not_allowed` | Usa `POST`. |
| 409 | `ambiguous` | Varios no negociables coinciden; elige uno de `options` por `id`. |
| 502 | `database_error`, `strava_error` | Supabase o Strava no contestaron bien. Revisa los logs de la función en Netlify. |
| 503 | `not_configured` | Falta una variable de entorno, o la llave de Supabase no es la secreta (el `message` dice cuál). |
| 503 | `not_set_up` | Todavía no corres la migración en Supabase (o corriste una versión anterior: córrela otra vez). |
| 503 | `strava_auth` | Strava no aceptó tu login: saca un `STRAVA_REFRESH_TOKEN` nuevo (abajo). También aparece "Reconnect Strava" en Esperando por ti. |

---

## Variables de entorno en Netlify

Netlify → tu sitio → **Site configuration → Environment variables**.

| Variable | ¿Obligatoria? | Qué es / de dónde sale |
| --- | --- | --- |
| `BOT_API_KEY` | Sí | La llave que usan tus bots. Inventa una larga y al azar (mínimo 24 caracteres). En la terminal: `openssl rand -hex 32` |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí | La llave secreta de Supabase. Supabase → **Project Settings → API Keys** → la **secret key** (`sb_secret_…`) o, si tu proyecto usa las llaves antiguas, la **`service_role`**. |
| `BOT_USER_ID` | Sí | Tu id de usuario. Supabase → **Authentication → Users** → tu correo → **User UID**. Todo lo que hagan los bots queda a tu nombre. |
| `SUPABASE_URL` | No | Si no la pones, usa `VITE_SUPABASE_URL`, que ya tienes. |
| `BOT_TIMEZONE` | No | Qué es "hoy" para los bots y para Strava. Si no la pones: `America/Chicago` (hora de Texas). |
| `STRAVA_CLIENT_ID` | Para Strava | El número de la app de Strava **solo del OS** (ver abajo). Nunca el de tu otro bot. |
| `STRAVA_CLIENT_SECRET` | Para Strava | El secreto de esa misma app del OS. |
| `STRAVA_REFRESH_TOKEN` | Para Strava | Tu permiso para que la app del OS lea tus entrenos (ver abajo). |

> ⚠️ **Muy importante:**
> - **Nunca** le pongas `VITE_` al principio a ninguna de estas. Todo lo que
>   empieza con `VITE_` se mete en la página y lo puede ver cualquiera.
> - Marca como **"Contains secret values"** `BOT_API_KEY`,
>   `SUPABASE_SERVICE_ROLE_KEY`, `STRAVA_CLIENT_SECRET` y `STRAVA_REFRESH_TOKEN`,
>   y si te deja, limita el alcance a **Functions**.
> - La llave de servicio de Supabase salta tu seguridad (RLS). Solo vive en
>   Netlify; nunca en el código, nunca en un bot.

### Cómo sacar las llaves de Strava (una sola vez, ~15 minutos)

> ⚠️ **Usa una app de Strava SOLO para el OS, con su propio Client ID y Client
> Secret.** No reuses la app ni el token de tu otro bot de Strava. Strava
> cambia el refresh token cada vez que lo renueva y el viejo deja de servir:
> si el OS y tu otro bot renuevan el **mismo** token, el que renueve primero
> deja al otro sin acceso. Con apps separadas, cada uno tiene sus propios
> tokens y nunca se pisan.

**Primero, revisa si tu cuenta ya tiene una app.** Strava permite **una sola
app de API por cuenta**. Entra a <https://www.strava.com/settings/api> con tu
cuenta de siempre:

- **Si te deja crear una app** (tu otro bot usa la app de otro servicio, no
  una tuya): créala ahí mismo para el OS y salta al paso 4.
- **Si ya ves una app ahí** (la de tu otro bot): **no la toques ni copies sus
  llaves.** Haz los pasos 1 a 3 para crear la del OS con una segunda cuenta.

**Crear la app del OS con una segunda cuenta**

1. Cierra sesión en Strava y crea una cuenta nueva y gratis con otro correo
   (por ejemplo `tucorreo+os@…`). Esa cuenta solo es "dueña" de la app; tus
   entrenos siguen en tu cuenta de siempre.
2. Con esa cuenta nueva, entra a <https://www.strava.com/settings/api> y crea
   la app, por ejemplo "RJP OS". En **Authorization Callback Domain** pon
   `localhost`.
3. En esa misma página, sube la **capacidad de atletas** (Athlete Capacity)
   de 1 a más. Las apps nuevas empiezan en "Single Player Mode", donde **solo
   la cuenta dueña** se puede conectar; Strava deja subirla a 10 desde ahí
   mismo, sin revisión. Si no ves la opción, pídela con el formulario de
   desarrolladores de Strava antes de seguir.

**Conectar la app del OS con tu cuenta de siempre**

4. Copia el **Client ID** y el **Client Secret** de la app **del OS** → son
   `STRAVA_CLIENT_ID` y `STRAVA_CLIENT_SECRET`.
5. Cierra sesión y entra a Strava con **tu cuenta de siempre** (la que tiene
   tus entrenos). Abre esta dirección (cambia `TU_CLIENT_ID` por el de la app
   del OS) y dale **Authorize**:
   ```text
   https://www.strava.com/oauth/authorize?client_id=TU_CLIENT_ID&response_type=code&redirect_uri=http://localhost/exchange_token&approval_prompt=force&scope=activity:read_all
   ```
6. Te manda a una página que "no carga" — está bien. Copia de la barra de
   direcciones lo que viene después de `code=` (hasta el `&`).
7. En tu terminal (cambia los tres valores, con el Client ID y Secret **del OS**):
   ```bash
   curl -X POST https://www.strava.com/oauth/token \
     -d client_id=TU_CLIENT_ID \
     -d client_secret=TU_CLIENT_SECRET \
     -d code=EL_CODE_QUE_COPIASTE \
     -d grant_type=authorization_code
   ```
8. De la respuesta, copia `refresh_token` → es tu `STRAVA_REFRESH_TOKEN`.
   En la misma respuesta, `athlete` debe ser **tú** (tu cuenta de siempre), no
   la cuenta nueva.

Pon las **tres** variables juntas en Netlify. Si algún día cambias de app,
cambia las tres a la vez; un token de una app no sirve con el Client ID de
otra.

> Strava cambia el refresh token cada vez que lo renueva y el viejo deja de
> servir. Por eso el OS guarda el más reciente en la tabla `os_tokens` de
> Supabase, que **solo** las funciones del servidor pueden leer (ni la app ni
> el navegador). Si algún día pones un `STRAVA_REFRESH_TOKEN` nuevo en
> Netlify, ese gana. Si guardar el token nuevo falla, el OS lo reintenta una
> vez; si vuelve a fallar, deja un error muy visible en los logs de la función
> ("STRAVA TOKEN NOT SAVED") y la siguiente sincronización te pedirá
> reconectar.

**Si Strava deja de aceptar el login**, no tienes que buscar en los logs:
aparece **"Reconnect Strava"** en **Inicio → Esperando por ti** (área salud,
del bot `strava`). Saca un `STRAVA_REFRESH_TOKEN` nuevo con los pasos 5 a 8,
ponlo en Netlify, haz **Trigger deploy** y palomea el aviso. Nunca se junta
más de un aviso abierto.

---

## Pasos para ponerlo en vivo

1. **Revisa el PR** y apruébalo cuando estés listo. (Todavía no lo mezcles.)
2. **Crea las tablas en Supabase.** Supabase → **SQL Editor → New query** →
   pega todo el archivo `supabase/migrations/20261017120000_os_items.sql` →
   **Run**. Debe decir *Success*.
   - Se puede correr más de una vez. **Si ya habías corrido una versión
     anterior, córrela otra vez completa:** solo agrega lo que falta y no
     borra nada.
   - Revisa en **Table Editor** que existan `os_items`, `os_nonneg_marks`,
     `os_events` y `os_tokens`, todas con el candado de RLS activado.
3. **Copia tus datos de Supabase:** la llave secreta (`SUPABASE_SERVICE_ROLE_KEY`)
   y tu User UID (`BOT_USER_ID`). Ver la tabla de arriba.
4. **Crea tu llave de bots:** `openssl rand -hex 32` → esa es tu `BOT_API_KEY`.
   Guárdala en tu gestor de contraseñas.
5. **(Opcional) Strava:** crea la app **solo del OS** y saca sus 3 llaves
   (sección de arriba). No uses las de tu otro bot de Strava.
6. **Ponlas en Netlify** (Environment variables): `BOT_API_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `BOT_USER_ID` y, si quieres Strava,
   `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` y `STRAVA_REFRESH_TOKEN`.
7. **Publica:** mezcla el PR. Si ya estaba mezclado cuando pusiste las
   variables, ve a **Deploys → Trigger deploy → Deploy site**: las funciones
   solo ven las variables nuevas después de un deploy.
8. **Prueba:** corre el ejemplo de `today`. Debe responder `"ok": true` con tu
   marcador y tus no negociables de hoy. Luego prueba `add_task` y mira que la
   tarea aparezca en Inicio. Si pusiste Strava, prueba `sync_strava`.
   - La revisión automática de Strava (cada 30 min) **solo corre en el sitio
     publicado**, no en los deploy previews. En Netlify → **Logs → Functions →
     strava-sync** ves qué hizo cada vez.
9. **Dale a tu bot** la dirección y la llave (como secreto de su configuración,
   nunca en un chat). Puedes pegarle estas instrucciones:

```text
Tengo una API para mi app personal.
Dirección: https://TU-SITIO.netlify.app/.netlify/functions/bot
Siempre usa POST con el encabezado "Authorization: Bearer <la llave>" y un cuerpo JSON.
- Ver mi día: {"action":"today"}
- Agregar tarea: {"action":"add_task","title":"...","area":"casa|trabajo|salud|familia","bot":"<tu nombre>","due":"AAAA-MM-DD (opcional)","priority":"baja|media|alta (opcional)","notes":"(opcional)"}
- Algo que solo yo puedo hacer o aprobar (PR, guion, compra, decisión): igual que agregar tarea, con "needs_me":true y el link en "notes".
- Agregar tarea de casa: {"action":"add_home_task","title":"...","bot":"<tu nombre>"}
- Cambiar si me espera a mí: {"action":"set_needs_me","id":"<id>","needs_me":true|false}
- Terminar una tarea tuya: {"action":"complete_task","id":"<id de bot_tasks o waiting_for_you>"}
- Marcar un no negociable de hoy: {"action":"mark_non_negotiable","id":"<id de non_negotiables>","bot":"<tu nombre>"}
- Agregar evento de la familia: {"action":"add_event","title":"...","date":"AAAA-MM-DD","time":"18:00 (opcional)","bot":"<tu nombre>"}
- Resumen de la semana: {"action":"week_summary"}
- Revisar Strava ya: {"action":"sync_strava"}
Antes de marcar un no negociable, llama a "today" y usa el id exacto. Si la respuesta es 409, pregúntame cuál.
```

### Si se filtra una llave

- **`BOT_API_KEY`:** crea otra con `openssl rand -hex 32`, cámbiala en Netlify,
  haz **Trigger deploy** y actualízala en tus bots. La vieja deja de servir en
  cuanto termina el deploy.
- **Llave de servicio de Supabase:** en Supabase → **API Keys**, crea una nueva
  y borra/revoca la vieja; cámbiala en Netlify y haz **Trigger deploy**.
- **Strava:** en <https://www.strava.com/settings/apps> quita el acceso de tu
  app (o cambia el Client Secret en <https://www.strava.com/settings/api>),
  saca un `STRAVA_REFRESH_TOKEN` nuevo y ponlo en Netlify.

---

## Cosas que conviene saber

- **"Hoy"** para los bots y para Strava es el día en `BOT_TIMEZONE` (Texas si
  no la cambias). La app usa la hora de tu teléfono. Si viajas a otra zona
  horaria, los dos pueden no coincidir por unas horas.
- **El marcador y la racha** salen de tus check-ins. Los días antes de que
  existiera el historial no cuentan, y un día en que no palomeaste nada cuenta
  como 0 %.
- **Las prioridades** se guardan como el resto de tu app (`week.priorities`),
  así que se sincronizan entre tus dispositivos. Los bots solo las leen.
- **Una sola llave para todos tus bots.** El campo `bot` es lo que cada bot
  dice ser; sirve para saber quién hizo qué, no como seguridad.
- **Desmarcar sin internet:** si desmarcas en la app un no negociable que marcó
  un bot y no hay conexión, la marca del bot no se puede borrar, así que se
  vuelve a marcar y la app te avisa. Inténtalo otra vez con conexión.
- **Las tareas de bots no se borran** (ni desde la API ni desde la app, por
  ahora); se marcan como hechas. Los **eventos** sí se pueden borrar desde el
  Calendario.
- **Las tareas de casa de los bots** no están en tu tablero semanal, así que no
  se arrastran entre días; viven en su sección "De mis bots".
- **Sin límite de llamadas.** La llave es larga y al azar, así que adivinarla
  no es práctico, pero cuídala como una contraseña.
- **La app funciona igual sin esto.** Si no corres la migración, Inicio muestra
  un aviso en la tarjeta "De mis bots" y la función responde `not_set_up`. El
  marcador del día y las prioridades funcionan aunque no haya bots.
