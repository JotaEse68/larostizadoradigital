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

