# La Rostizadora Digital

MVP en Next.js para Vercel. Analiza el README público de un repositorio GitHub y devuelve un roast en español: primero lo quema con cinismo, luego entrega soluciones concretas.

## Stack

- Next.js App Router
- Vercel Hobby
- OpenAI server-side
- Modelo por defecto: `gpt-4.1-nano`
- Sin login
- Rate limit: 3 análisis por IP/día
- Máximo README: 30.000 caracteres
- Caché por README durante 7 días
- Upstash Redis opcional para rate limit/caché persistente

## Variables de entorno

```env
OPENAI_API_KEY=tu_clave_openai
OPENAI_MODEL=gpt-4.1-nano
GITHUB_TOKEN=opcional
RATE_LIMIT_PER_DAY=3
MAX_README_CHARS=30000
CACHE_TTL_SECONDS=604800
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

`OPENAI_API_KEY` es obligatoria. `GITHUB_TOKEN` es recomendable. Upstash es opcional, pero en producción conviene usarlo para que el límite por IP no dependa de memoria serverless.

## Desarrollo

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Deploy

Subir a GitHub, importar en Vercel, añadir variables y desplegar.
