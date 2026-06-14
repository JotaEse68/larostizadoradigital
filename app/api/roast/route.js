import { createHash } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GITHUB_API = 'https://api.github.com';
const DEFAULT_MAX_README_CHARS = 30000;
const DEFAULT_RATE_LIMIT_PER_DAY = 3;
const DEFAULT_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;

function envInt(name, fallback) {
  const value = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const MAX_README_CHARS = envInt('MAX_README_CHARS', DEFAULT_MAX_README_CHARS);
const RATE_LIMIT_PER_DAY = envInt('RATE_LIMIT_PER_DAY', DEFAULT_RATE_LIMIT_PER_DAY);
const CACHE_TTL_SECONDS = envInt('CACHE_TTL_SECONDS', DEFAULT_CACHE_TTL_SECONDS);

function normalizeRepoInput(input) {
  if (!input || typeof input !== 'string') return null;

  const value = input.trim().replace(/\.git$/i, '').replace(/\/$/, '');
  let owner;
  let repo;

  try {
    if (/^https?:\/\//i.test(value)) {
      const url = new URL(value);
      if (url.hostname.toLowerCase() !== 'github.com') return null;
      const parts = url.pathname.split('/').filter(Boolean);
      [owner, repo] = parts;
    } else {
      const parts = value.split('/').filter(Boolean);
      [owner, repo] = parts;
    }
  } catch {
    return null;
  }

  if (!owner || !repo) return null;
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) return null;

  return { owner, repo, fullName: `${owner}/${repo}` };
}

function githubHeaders(accept = 'application/vnd.github+json') {
  const headers = {
    Accept: accept,
    'User-Agent': 'jottarina-readme-roaster',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: githubHeaders(),
    cache: 'no-store'
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const message = response.status === 403
      ? 'GitHub ha cortado el grifo. Añade GITHUB_TOKEN en Vercel, criatura, que las consultas públicas sin token duran lo que una dieta un lunes.'
      : response.status === 404
        ? 'Repositorio no encontrado o privado. Jottarina no abre puertas cerradas sin llave.'
        : `GitHub respondió con error ${response.status}. ${text.slice(0, 180)}`;
    throw new Error(message);
  }

  return response.json();
}

async function fetchReadme({ owner, repo }) {
  const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/readme`, {
    headers: githubHeaders('application/vnd.github.raw'),
    cache: 'no-store'
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Este repositorio no tiene README público en la rama principal. Valiente forma de vender el proyecto: escondiéndolo.');
    }
    if (response.status === 403) {
      throw new Error('GitHub ha limitado las consultas. Añade GITHUB_TOKEN en Vercel para ampliar el margen.');
    }
    throw new Error(`No se pudo descargar el README. Error ${response.status}.`);
  }

  const readme = await response.text();
  const contentDisposition = response.headers.get('content-disposition') || '';
  const pathMatch = contentDisposition.match(/filename="?([^";]+)"?/i);

  return {
    text: readme,
    path: pathMatch?.[1] || 'README.md'
  };
}

function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function secondsUntilNextUtcDay() {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  return Math.max(60, Math.ceil((next.getTime() - now.getTime()) / 1000));
}

function currentUtcDayKey() {
  return new Date().toISOString().slice(0, 10);
}

function hasRedis() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function redisCommand(command) {
  const response = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command),
    cache: 'no-store'
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Redis respondió con error ${response.status}.`);
  }
  return data.result;
}

function memoryStore() {
  if (!globalThis.__JOTTARINA_MEMORY_STORE__) {
    globalThis.__JOTTARINA_MEMORY_STORE__ = {
      rate: new Map(),
      cache: new Map()
    };
  }
  return globalThis.__JOTTARINA_MEMORY_STORE__;
}

async function checkRateLimit(request) {
  const ip = getClientIp(request);
  const ipHash = sha256(ip).slice(0, 24);
  const day = currentUtcDayKey();
  const key = `jottarina:rate:${day}:${ipHash}`;
  const ttl = secondsUntilNextUtcDay();

  if (hasRedis()) {
    const current = Number(await redisCommand(['GET', key]) || 0);
    if (current >= RATE_LIMIT_PER_DAY) {
      return {
        limited: true,
        limit: RATE_LIMIT_PER_DAY,
        remaining: 0,
        resetInSeconds: ttl,
        mode: 'redis'
      };
    }

    const used = Number(await redisCommand(['INCR', key]) || 1);
    if (used === 1) await redisCommand(['EXPIRE', key, ttl]);

    return {
      limited: false,
      limit: RATE_LIMIT_PER_DAY,
      remaining: Math.max(0, RATE_LIMIT_PER_DAY - used),
      resetInSeconds: ttl,
      mode: 'redis'
    };
  }

  const store = memoryStore();
  const existing = store.rate.get(key);
  const now = Date.now();
  const resetAt = now + ttl * 1000;

  if (existing && existing.resetAt > now && existing.count >= RATE_LIMIT_PER_DAY) {
    return {
      limited: true,
      limit: RATE_LIMIT_PER_DAY,
      remaining: 0,
      resetInSeconds: Math.ceil((existing.resetAt - now) / 1000),
      mode: 'memory-demo'
    };
  }

  const next = existing && existing.resetAt > now
    ? { count: existing.count + 1, resetAt: existing.resetAt }
    : { count: 1, resetAt };

  store.rate.set(key, next);

  return {
    limited: false,
    limit: RATE_LIMIT_PER_DAY,
    remaining: Math.max(0, RATE_LIMIT_PER_DAY - next.count),
    resetInSeconds: Math.ceil((next.resetAt - now) / 1000),
    mode: 'memory-demo'
  };
}

async function getCachedAnalysis(cacheKey) {
  if (hasRedis()) {
    const raw = await redisCommand(['GET', cacheKey]);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  const entry = memoryStore().cache.get(cacheKey);
  if (!entry || entry.expiresAt < Date.now()) return null;
  return entry.value;
}

async function setCachedAnalysis(cacheKey, value) {
  if (hasRedis()) {
    await redisCommand(['SET', cacheKey, JSON.stringify(value), 'EX', CACHE_TTL_SECONDS]);
    return;
  }

  memoryStore().cache.set(cacheKey, {
    value,
    expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000
  });
}

function safeJsonParse(text) {
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function extractOpenAIText(payload) {
  if (payload.output_text) return payload.output_text;

  const chunks = [];
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) chunks.push(content.text);
      if (content.type === 'text' && content.text) chunks.push(content.text);
    }
  }
  return chunks.join('\n').trim();
}

function buildFallbackAnalysis(rawText) {
  return {
    score: null,
    verdict: 'La respuesta llegó con el peinado torcido: hubo texto, pero no JSON limpio.',
    personalityLine: 'Jottarina lo intentó, el formato se fue a criar polvo detrás del router.',
    roast: rawText || 'No se pudo leer una respuesta válida del modelo.',
    salvable: 'El backend funciona. El siguiente drama es ajustar el prompt o revisar el modelo.',
    redFlags: ['Respuesta no estructurada', 'JSON inválido', 'Hace falta reintentar con README más corto'],
    actionItems: [
      'Comprueba OPENAI_API_KEY en Vercel.',
      'Verifica que OPENAI_MODEL esté escrito exactamente como corresponde.',
      'Reintenta con un README más corto.',
      'Reduce temperatura si quieres menos creatividad y más obediencia.',
      'No llores todavía: esto es arreglable.'
    ],
    improvedStructure: [
      'Qué problema resuelve',
      'Para quién es',
      'Instalación rápida',
      'Uso básico con ejemplo',
      'Capturas o demo',
      'Roadmap',
      'Licencia'
    ],
    finalPunchline: 'El roast salió, pero el JSON vino sin desayunar.'
  };
}

function getSpanishWeekday() {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    timeZone: 'Europe/Madrid'
  }).format(new Date());
}

async function analyzeReadme({ repoInfo, readme }) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Falta OPENAI_API_KEY en Vercel. Sin llave no hay sarcasmo, solo decoración.');
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4.1-nano';
  const trimmedReadme = readme.text.slice(0, MAX_README_CHARS);
  const wasTrimmed = readme.text.length > MAX_README_CHARS;
  const weekday = getSpanishWeekday();

  const systemPrompt = `Eres Jottarina Coach, una coach digital femenina para revisar READMEs de GitHub.
Tu estilo: sarcástica, mandona, cínica y divertida, pero útil. Hablas en español natural.
Tu función: convertir un README confuso en un README que explique, venda y no dé vergüenza ajena.

Personalidad:
- Actitud de hermana mayor con gafas cínicas: autoridad cariñosa, humor seco y frases memorables.
- Puedes usar apelativos ligeros como "criatura", "genio" o "pequeña guerrilla", sin abusar.
- Llamas al autoengaño por su nombre: falta de claridad, exceso de promesas, ausencia de ejemplos, instalación fantasma.
- No atacas personas. Criticas el README, el posicionamiento y la documentación.
- No uses insultos duros, contenido ofensivo ni humillación personal.
- No digas "como IA", "como modelo" ni hagas metacomentarios técnicos innecesarios. Eres el personaje Jottarina dentro de esta herramienta.
- Si algo no está en el README, no lo inventes. Di que falta.
- Prioriza acción sobre teoría.

Adaptación por día actual: ${weekday}.
- Lunes: tono sargento motivacional.
- Martes a jueves: tono hermana mayor.
- Viernes: tono amiga celebradora con empujón final.
- Sábado/domingo: tono rescate productivo sin drama.

Devuelve SOLO JSON válido. Nada de markdown, nada de texto fuera del JSON.`;

  const userPrompt = `Analiza este README público de GitHub con personalidad Jottarina Coach.

Repositorio: ${repoInfo.full_name || repoInfo.fullName}
Descripción GitHub: ${repoInfo.description || 'Sin descripción'}
Lenguaje principal: ${repoInfo.language || 'No especificado'}
Estrellas: ${repoInfo.stargazers_count ?? 'No disponible'}
Rama por defecto: ${repoInfo.default_branch || 'No disponible'}
README truncado por seguridad/coste: ${wasTrimmed ? 'Sí' : 'No'}
Caracteres analizados: ${trimmedReadme.length}

README:
"""
${trimmedReadme}
"""

Evalúa:
- Claridad del proyecto.
- Propuesta de valor.
- Instalación.
- Uso real con ejemplos.
- Confianza para probarlo.
- Estructura visual.
- Qué falta para que alguien entienda y use el proyecto.

Devuelve exactamente este JSON:
{
  "score": number entre 0 y 100,
  "verdict": "diagnóstico general en una frase clara y con personalidad",
  "personalityLine": "frase corta de Jottarina abriendo el juicio",
  "roast": "crítica directa, sarcástica y útil del README",
  "salvable": "qué cosas sí funcionan o tienen potencial",
  "redFlags": ["4 a 6 problemas concretos detectados"],
  "actionItems": ["5 a 7 acciones concretas ordenadas por impacto"],
  "improvedStructure": ["6 a 9 secciones recomendadas para reestructurar el README"],
  "rewriteStarter": "primer bloque recomendado para empezar el README reescrito, breve y accionable",
  "finalPunchline": "remate final corto, cínico y divertido, pero útil"
}`;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.78,
      max_output_tokens: 1700
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`OpenAI respondió con error ${response.status}. ${text.slice(0, 240)}`);
  }

  const payload = await response.json();
  const outputText = extractOpenAIText(payload);
  const parsed = safeJsonParse(outputText);

  return parsed || buildFallbackAnalysis(outputText);
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const normalized = normalizeRepoInput(body.repo);

    if (!normalized) {
      return Response.json(
        { error: 'Formato inválido. Usa una URL de GitHub o usuario/repositorio. No me traigas un jeroglífico, genio.' },
        { status: 400 }
      );
    }

    const rate = await checkRateLimit(request);
    if (rate.limited) {
      return Response.json(
        {
          error: `Límite diario alcanzado: ${rate.limit} análisis por IP. Jottarina descansa; tu tarjeta también.`,
          rate
        },
        { status: 429 }
      );
    }

    const [repoInfo, readme] = await Promise.all([
      fetchJson(`${GITHUB_API}/repos/${normalized.owner}/${normalized.repo}`),
      fetchReadme(normalized)
    ]);

    if (!readme.text || readme.text.trim().length < 80) {
      return Response.json(
        { error: 'El README es demasiado corto para analizarlo. Eso no es documentación, es una nota pegada en la nevera.' },
        { status: 422 }
      );
    }

    const model = process.env.OPENAI_MODEL || 'gpt-4.1-nano';
    const readmeHash = sha256(readme.text.slice(0, MAX_README_CHARS));
    const cacheKey = `jottarina:cache:${model}:${repoInfo.full_name || normalized.fullName}:${readmeHash}`;
    const cached = await getCachedAnalysis(cacheKey);

    if (cached) {
      return Response.json({
        ...cached,
        cached: true,
        rate,
        limits: {
          maxReadmeChars: MAX_README_CHARS,
          rateLimitPerDay: RATE_LIMIT_PER_DAY,
          model
        }
      });
    }

    const analysis = await analyzeReadme({ repoInfo, readme });

    const responsePayload = {
      repo: {
        fullName: repoInfo.full_name || normalized.fullName,
        description: repoInfo.description,
        language: repoInfo.language,
        stars: repoInfo.stargazers_count,
        defaultBranch: repoInfo.default_branch,
        readmePath: readme.path,
        charactersTotal: readme.text.length,
        charactersAnalyzed: Math.min(readme.text.length, MAX_README_CHARS),
        wasTrimmed: readme.text.length > MAX_README_CHARS
      },
      analysis
    };

    await setCachedAnalysis(cacheKey, responsePayload).catch(() => null);

    return Response.json({
      ...responsePayload,
      cached: false,
      rate,
      limits: {
        maxReadmeChars: MAX_README_CHARS,
        rateLimitPerDay: RATE_LIMIT_PER_DAY,
        model
      }
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Error inesperado. El caos hizo gimnasia.' }, { status: 500 });
  }
}
