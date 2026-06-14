# Jottarina README Roaster

App MVP para Vercel que analiza el README público de un repositorio GitHub y devuelve un roast útil en español con la personalidad de **Jottarina Coach**: sarcástica, mandona, cínica y divertida, pero con acciones concretas.

Incluye la imagen de Jottarina como mascota visual en la interfaz.

## Qué hace

- Acepta URL pública de GitHub o formato `usuario/repositorio`.
- Descarga únicamente el README público del repositorio.
- No analiza el código.
- Usa OpenAI desde backend server-side para no exponer la API key.
- Modelo por defecto: `gpt-4.1-nano`.
- Límite diario por IP: 3 análisis/día.
- Máximo README analizado: 30.000 caracteres.
- Sin login al principio.
- Caché de resultados por repositorio/modelo/hash de README.
- Diseño visual con Jottarina Coach.

## Stack

- Next.js App Router
- Vercel Hobby compatible
- API Route server-side: `/app/api/roast/route.js`
- GitHub REST API
- OpenAI Responses API
- CSS propio, sin Tailwind
- Rate limit con Upstash Redis opcional y fallback en memoria

## Variables de entorno

Crea estas variables en Vercel > Project Settings > Environment Variables:

```env
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4.1-nano
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxx
RATE_LIMIT_PER_DAY=3
MAX_README_CHARS=30000
CACHE_TTL_SECONDS=604800
UPSTASH_REDIS_REST_URL=https://xxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxxxxxxxxxxxxxxx
```

### Obligatoria

`OPENAI_API_KEY`

Sin esta variable la app no puede generar análisis.

### Recomendadas

`GITHUB_TOKEN`

Mejora el margen de consultas a la API pública de GitHub. No necesita permisos de escritura.

`UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`

Muy recomendable en producción para que el rate limit y la caché sean persistentes en Vercel Serverless.

Sin Upstash, la app usa memoria del runtime. Sirve para pruebas, pero en serverless puede reiniciarse entre ejecuciones y no es protección seria contra abuso.

### Control de coste

`RATE_LIMIT_PER_DAY=3`

Define cuántos análisis puede hacer una IP al día.

`MAX_README_CHARS=30000`

Define cuántos caracteres máximo del README se envían al modelo.

`CACHE_TTL_SECONDS=604800`

Tiempo de caché por análisis. Por defecto, 7 días.

## Desarrollo local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abrir:

```txt
http://localhost:3000
```

## Deploy en Vercel

1. Sube esta carpeta a GitHub.
2. Entra en Vercel.
3. Importa el repositorio.
4. Framework: Next.js.
5. Añade las variables de entorno.
6. Deploy.

## Estructura

```txt
jottarina-readme-roaster/
├─ app/
│  ├─ api/
│  │  └─ roast/
│  │     └─ route.js
│  ├─ globals.css
│  ├─ layout.js
│  └─ page.js
├─ public/
│  └─ jottarina-coach.png
├─ .env.example
├─ .gitignore
├─ next.config.mjs
├─ package.json
└─ README.md
```

## Personalidad Jottarina

El prompt está en:

```txt
app/api/roast/route.js
```

Busca:

```js
const systemPrompt = `Eres Jottarina Coach...
```

Ahí puedes ajustar el nivel de sarcasmo, dureza y estilo.

Importante: el prompt está diseñado para mantener el personaje sin ataques personales. La crítica va contra el README, no contra el autor.

## Próximas mejoras comerciales

- Login con Supabase.
- Créditos por usuario.
- Stripe Checkout para packs.
- Historial de análisis.
- Reescritura completa del README.
- Exportar informe a PDF.
- Comparador antes/después.
- Landing IA Packs / by Jota.

## Nota práctica

Para validar mercado, esta versión es suficiente:

```txt
Vercel Hobby + OpenAI gpt-4.1-nano + 3 análisis/IP/día + README 30k + sin login
```

Para tráfico real, añade Upstash Redis y límite de gasto en el panel de OpenAI. El código reduce coste, pero el límite de gasto real se configura fuera de la app.
