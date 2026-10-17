# API para tus bots

Tus bots de IA pueden **leer y escribir** en tu app a través de una sola
dirección protegida con una llave (`BOT_API_KEY`).

- **Dirección:** `https://TU-SITIO.netlify.app/.netlify/functions/bot`
- **Siempre** `POST`, con un cuerpo JSON que dice la acción: `{"action": "..."}`
- **Siempre** con el encabezado `Authorization: Bearer TU_BOT_API_KEY`

---

## Qué puede hacer un bot (y qué no)

| Puede | Cómo |
| --- | --- |
| Agregar una tarea (casa, trabajo, salud o familia) | `add_task` |
| Agregar una tarea de casa | `add_home_task` |
| Ver lo de hoy | `today` |
| Marcar como hecha una tarea que dejó un bot | `complete_task` |
| Marcar un no negociable de hoy ("hice gym") | `mark_non_negotiable` |

- **Solo lectura:** tus no negociables y tus tareas de casa y trabajo de hoy.
  El bot las puede ver, pero **no** cambiarlas.
- **La función nunca escribe en `app_state`** (donde la app guarda tus
  tableros). Así un bot nunca puede borrar algo que estás cambiando con la app
  abierta. Lo que hacen los bots se guarda en dos tablas propias:
  - `os_items`: las tareas que te dejan los bots.
  - `os_nonneg_marks`: cuando un bot marca un no negociable. La app lo pasa a
    tu lista sola, como si lo hubieras tocado tú.
- **No puede:** borrar nada, ni ver tu diario, finanzas, salud, familia ni
  ninguna otra página. La función solo lee tus no negociables y tus tableros
  de casa y trabajo.

## Dónde ves lo que hacen tus bots

- **Inicio → "De mis bots":** las tareas abiertas de tus bots y las que
  terminaste hoy. Las marcas como hechas desde ahí. Se actualiza sola.
- **Tareas de casa:** una sección "De mis bots" con las tareas de casa que
  agregaron (solo aparece cuando hay alguna).
- **No negociables:** el que marcó un bot aparece palomeado con
  "via nombre-del-bot". Si lo desmarcas tú, también se borra la marca del bot.

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
| `notes` | No | Notas (hasta 5000 letras). |

Responde con la tarea creada. Guarda el `id` si luego la quieres marcar como hecha:

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
    "done_at": null,
    "created_at": "2026-10-17T14:49:01.120Z"
  }
}
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

### 3. Ver lo de hoy — `today`

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
  "bot_tasks": [
    { "id": "5adc1570-5ce7-409c-b68c-edca436bc05a", "title": "Mandar los números del Q4 al contador",
      "notes": "Los pidió dos veces", "bot": "asistente-correo", "area": "trabajo", "due": "2026-10-20",
      "priority": "alta", "status": "abierta", "done_at": null, "created_at": "2026-10-17T14:49:01.120Z" }
  ],
  "non_negotiables": [
    { "id": "nn_sleep", "text": "Sleep — at least 7 hours", "done": false, "marked_by_bot": null },
    { "id": "nn_wend_relax", "text": "Relax & recharge", "done": true, "marked_by_bot": null },
    { "id": "nn_wend_move", "text": "Move / exercise", "done": true, "marked_by_bot": "telegram" }
  ],
  "home_tasks": [
    { "id": "w_abc", "text": "Mow the lawn", "done": false, "urgent": false }
  ],
  "work_tasks": [
    { "id": "w_def", "text": "Call title company", "done": false, "urgent": true, "company": "stb" }
  ]
}
```

- `bot_tasks`: todas las tareas abiertas de tus bots, más las de hoy y las que
  terminaste hoy.
- `non_negotiables`: **solo los que aplican hoy** (entre semana o fin de
  semana, igual que en Inicio), y si ya están hechos. `marked_by_bot` dice qué
  bot lo marcó.
- `home_tasks` y `work_tasks`: lo que tienes hoy en tus tableros, igual que
  las tarjetas de Inicio. **Solo lectura.**

### 4. Marcar una tarea como hecha — `complete_task`

Solo funciona con tareas que dejó un bot (las de `bot_tasks`). Usa su `id`.

```bash
curl -X POST "$URL" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "complete_task", "id": "5adc1570-5ce7-409c-b68c-edca436bc05a"}'
```

### 5. Marcar un no negociable de hoy — `mark_non_negotiable`

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

```json
{ "ok": true, "date": "2026-10-17", "non_negotiable": { "id": "nn_wend_move", "text": "Move / exercise", "done": true }, "already_done": false }
```

---

## Si algo sale mal

Toda respuesta trae `"ok"`. Si es `false`, también trae `error` (un código) y
`message` (qué pasó).

| Código HTTP | `error` | Qué significa |
| --- | --- | --- |
| 400 | `missing_field`, `bad_area`, `bad_date`, `bad_priority`, `bad_id`, `too_long`, `invalid_json`, `unknown_action` | Faltó un dato o vino mal. El `message` dice cuál. |
| 401 | `unauthorized` | Falta la llave o está mal. |
| 404 | `not_found`, `none_today` | No existe esa tarea, o ese no negociable no aplica hoy. |
| 405 | `method_not_allowed` | Usa `POST`. |
| 409 | `ambiguous` | Varios no negociables coinciden; elige uno de `options` por `id`. |
| 502 | `database_error` | Supabase no aceptó el cambio. Revisa los logs de la función en Netlify. |
| 503 | `not_configured` | Falta una variable de entorno, o la llave de Supabase no es la secreta (el `message` dice cuál). |
| 503 | `not_set_up` | Todavía no corres la migración en Supabase. |

---

## Variables de entorno en Netlify

Netlify → tu sitio → **Site configuration → Environment variables**.

| Variable | ¿Obligatoria? | Qué es / de dónde sale |
| --- | --- | --- |
| `BOT_API_KEY` | Sí | La llave que usan tus bots. Inventa una larga y al azar (mínimo 24 caracteres). En la terminal: `openssl rand -hex 32` |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí | La llave secreta de Supabase. Supabase → **Project Settings → API Keys** → la **secret key** (`sb_secret_…`) o, si tu proyecto usa las llaves antiguas, la **`service_role`**. |
| `BOT_USER_ID` | Sí | Tu id de usuario. Supabase → **Authentication → Users** → tu correo → **User UID**. Todo lo que hagan los bots queda a tu nombre. |
| `SUPABASE_URL` | No | Si no la pones, usa `VITE_SUPABASE_URL`, que ya tienes. |
| `BOT_TIMEZONE` | No | Qué es "hoy" para los bots. Si no la pones: `America/Chicago` (hora de Texas). |

> ⚠️ **Muy importante:**
> - **Nunca** le pongas `VITE_` al principio a `SUPABASE_SERVICE_ROLE_KEY` ni a
>   `BOT_API_KEY`. Todo lo que empieza con `VITE_` se mete en la página y lo
>   puede ver cualquiera.
> - Al crear estas dos, marca **"Contains secret values"** y, si te deja,
>   limita el alcance a **Functions**.
> - La llave de servicio de Supabase salta tu seguridad (RLS). Solo vive en
>   Netlify; nunca en el código, nunca en un bot.

---

## Pasos para ponerlo en vivo

1. **Revisa el PR** y apruébalo cuando estés listo. (Todavía no lo mezcles.)
2. **Crea las tablas en Supabase.** Supabase → **SQL Editor → New query** →
   pega todo el archivo `supabase/migrations/20261017120000_os_items.sql` →
   **Run**. Debe decir *Success*. Se puede correr más de una vez sin problema.
   - Revisa en **Table Editor** que existan `os_items` y `os_nonneg_marks`, con
     el candado de RLS activado.
3. **Copia tus datos de Supabase:** la llave secreta (`SUPABASE_SERVICE_ROLE_KEY`)
   y tu User UID (`BOT_USER_ID`). Ver la tabla de arriba.
4. **Crea tu llave de bots:** `openssl rand -hex 32` → esa es tu `BOT_API_KEY`.
   Guárdala en tu gestor de contraseñas.
5. **Ponlas en Netlify** (Environment variables): `BOT_API_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` y `BOT_USER_ID`.
6. **Publica:** mezcla el PR. Si ya estaba mezclado cuando pusiste las
   variables, ve a **Deploys → Trigger deploy → Deploy site**: la función solo
   ve las variables nuevas después de un deploy.
7. **Prueba:** corre el ejemplo de `today` de arriba. Debe responder
   `"ok": true` con tus no negociables de hoy. Luego prueba `add_task` y mira
   que la tarea aparezca en Inicio → "De mis bots".
8. **Dale a tu bot** la dirección y la llave (como secreto de su configuración,
   nunca en un chat). Puedes pegarle estas instrucciones:

```text
Tengo una API para mi app personal.
Dirección: https://TU-SITIO.netlify.app/.netlify/functions/bot
Siempre usa POST con el encabezado "Authorization: Bearer <la llave>" y un cuerpo JSON.
- Ver mi día: {"action":"today"}
- Agregar tarea: {"action":"add_task","title":"...","area":"casa|trabajo|salud|familia","bot":"<tu nombre>","due":"AAAA-MM-DD (opcional)","priority":"baja|media|alta (opcional)","notes":"(opcional)"}
- Agregar tarea de casa: {"action":"add_home_task","title":"...","bot":"<tu nombre>"}
- Terminar una tarea tuya: {"action":"complete_task","id":"<id de bot_tasks>"}
- Marcar un no negociable de hoy: {"action":"mark_non_negotiable","id":"<id de non_negotiables>","bot":"<tu nombre>"}
Antes de marcar un no negociable, llama a "today" y usa el id exacto. Si la respuesta es 409, pregúntame cuál.
```

### Si se filtra una llave

- **`BOT_API_KEY`:** crea otra con `openssl rand -hex 32`, cámbiala en Netlify,
  haz **Trigger deploy** y actualízala en tus bots. La vieja deja de servir en
  cuanto termina el deploy.
- **Llave de servicio de Supabase:** en Supabase → **API Keys**, crea una nueva
  y borra/revoca la vieja; cámbiala en Netlify y haz **Trigger deploy**.

---

## Cosas que conviene saber

- **"Hoy"** es el día en `BOT_TIMEZONE` (Texas si no la cambias). Si viajas a
  otra zona horaria, la app usa la hora de tu teléfono y los bots la de
  `BOT_TIMEZONE`.
- **Una sola llave para todos tus bots.** El campo `bot` es lo que cada bot
  dice ser; sirve para saber quién hizo qué, no como seguridad.
- **Desmarcar sin internet:** si desmarcas en la app un no negociable que marcó
  un bot y no hay conexión, la marca del bot no se puede borrar, así que se
  vuelve a marcar y la app te avisa. Inténtalo otra vez con conexión.
- **Las tareas de bots no se borran** (ni desde la API ni desde la app, por
  ahora); se marcan como hechas.
- **Las tareas de casa de los bots** no están en tu tablero semanal, así que no
  se arrastran entre días; viven en su sección "De mis bots".
- **Sin límite de llamadas.** La llave es larga y al azar, así que adivinarla
  no es práctico, pero cuídala como una contraseña.
- **La app funciona igual sin esto.** Si no corres la migración, Inicio solo
  muestra un aviso en la tarjeta "De mis bots" y la función responde
  `not_set_up`; nada más cambia.
