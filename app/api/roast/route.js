import { createHash } from 'node:crypto';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GITHUB_API = 'https://api.github.com';
const MAX_README_CHARS = Number.parseInt(process.env.MAX_README_CHARS || '30000', 10);
const RATE_LIMIT_PER_DAY = Number.parseInt(process.env.RATE_LIMIT_PER_DAY || '3', 10);
const CACHE_TTL_SECONDS = Number.parseInt(process.env.CACHE_TTL_SECONDS || '604800', 10);

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeRepoInput(input) {
  if (!input || typeof input !== 'string') return null;
  const value = input.trim().replace(/\.git$/i, '').replace(/\/$/, '');
  let owner;
  let repo;
  try {
    if (/^https?:\/\//i.test(value)) {
      const url = new URL(value);
      if (url.hostname.toLowerCase() !== 'github.com') return null;
      [owner, repo] = url.pathname.split('/').filter(Boolean);
    } else {
      [owner, repo] = value.split('/').filter(Boolean);
    }
  } catch {
    return null;
  }
  if (!owner || !repo) return null;
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) return null;
  return { owner, repo, fullName: `${owner}/${repo}` };
}

function clientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  const real = request.headers.get('x-real-ip');
  return (forwarded?.split(',')[0] || real || 'unknown').trim();
}

function secondsUntilNextUtcDay() {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return Math.max(60, Math.ceil((next.getTime() - now.getTime()) / 1000));
}

function store() {
  globalThis.__rostizadoraStore ||= { rate: new Map(), cache: new Map() };
  return globalThis.__rostizadoraStore;
}

function checkRateLimit(ip) {
  const key = `rate:${hash(ip)}`;
  const ttl = secondsUntilNextUtcDay();
  const memory = store();
  const existing = memory.rate.get(key);
  const now = Date.now();
  if (existing && existing.resetAt > now && existing.count >= RATE_LIMIT_PER_DAY) {
    return { limited: true, limit: RATE_LIMIT_PER_DAY, remaining: 0, resetInSeconds: Math.ceil((existing.resetAt - now) / 1000), mode: 'memory-demo' };
  }
  const next = existing && existing.resetAt > now ? { count: existing.count + 1, resetAt: existing.resetAt } : { count: 1, resetAt: now + ttl * 1000 };
  memory.rate.set(key, next);
  return { limited: false, limit: RATE_LIMIT_PER_DAY, remaining: Math.max(0, RATE_LIMIT_PER_DAY - next.count), resetInSeconds: Math.ceil((next.resetAt - now) / 1000), mode: 'memory-demo' };
}

function getCache(key) {
  const entry = store().cache.get(key);
  if (!entry || entry.expiresAt < Date.now()) return null;
  return entry.value;
}

function setCache(key, value) {
  store().cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000 });
}

function githubHeaders() {
  const headers = { Accept: 'application/vnd.github.raw', 'User-Agent': 'la-rostizadora-digital', 'X-GitHub-Api-Version': '2022-11-28' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

async function fetchReadme(repo) {
  const res = await fetch(`${GITHUB_API}/repos/${repo.owner}/${repo.repo}/readme`, { headers: githubHeaders(), cache: 'no-store' });
  if (!res.ok) {
    if (res.status === 404) throw new Error('Repositorio privado, inexistente o sin README público. Gran estrategia: esconder el cartel de entrada.');
    if (res.status === 403) throw new Error('GitHub ha limitado las consultas. Añade GITHUB_TOKEN en Vercel para ampliar margen.');
    throw new Error(`GitHub respondió con error ${res.status}. La parrilla encontró burocracia.`);
  }
  const text = await res.text();
  if (!text.trim()) throw new Error('El README está vacío. Eso no es minimalismo, es abandono con Markdown.');
  const wasTrimmed = text.length > MAX_README_CHARS;
  return { text: wasTrimmed ? text.slice(0, MAX_README_CHARS) : text, originalLength: text.length, wasTrimmed };
}

function fallbackAnalysis(repoName) {
  return {
    score: 50,
    heatLevel: 'Ahumado sospechoso',
    verdict: `El README de ${repoName} existe, pero necesita estructura y señales de vida.`,
    openingBurn: 'Hay intención, pero también olor a “ya lo arreglo luego”. Spoiler: luego nunca llega.',
    roast: {
      claridad: 'El lector no debería hacer arqueología para entender qué hace esto.',
      confianza: 'Faltan capturas, demo, badges o señales de que el proyecto respira.',
      uso: 'La instalación y el primer paso deberían estar servidos como tapa, no escondidos como ingrediente secreto.'
    },
    salvable: 'La base se puede rescatar si ordenas propuesta, instalación, ejemplo y límites reales.',
    redFlags: ['No se entiende el beneficio en los primeros segundos.', 'Falta una ruta clara para probarlo.', 'Pocas señales de confianza.'],
    rescuePlan: ['Escribe un bloque inicial con qué hace, para quién y resultado.', 'Añade instalación y primer uso en menos de 8 líneas.', 'Incluye demo, captura o ejemplo real.', 'Cierra con roadmap y límites honestos.'],
    fixedStructure: ['Título + promesa directa', 'Demo o captura', 'Instalación', 'Primer uso', 'Configuración', 'Casos de uso', 'Limitaciones', 'Roadmap'],
    rewriteStarter: `${repoName}: herramienta para [usuario objetivo] que permite [resultado concreto] sin [dolor principal].`,
    finalSizzle: 'Terminado gana a perfecto. Documentado gana a “ya se entiende”. Ahora deja de decorar el humo y arregla el README.'
  };
}

function parseJson(text) {
  try { return JSON.parse(text); } catch {
    const match = text?.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch { return null; }
  }
}

function normalizeAnalysis(value, repoName) {
  const fb = fallbackAnalysis(repoName);
  return {
    score: typeof value?.score === 'number' ? Math.max(0, Math.min(100, Math.round(value.score))) : fb.score,
    heatLevel: String(value?.heatLevel || fb.heatLevel).slice(0, 80),
    verdict: String(value?.verdict || fb.verdict).slice(0, 420),
    openingBurn: String(value?.openingBurn || fb.openingBurn).slice(0, 420),
    roast: {
      claridad: String(value?.roast?.claridad || fb.roast.claridad).slice(0, 700),
      confianza: String(value?.roast?.confianza || fb.roast.confianza).slice(0, 700),
      uso: String(value?.roast?.uso || fb.roast.uso).slice(0, 700)
    },
    salvable: String(value?.salvable || fb.salvable).slice(0, 700),
    redFlags: Array.isArray(value?.redFlags) ? value.redFlags.slice(0, 6).map((x) => String(x).slice(0, 220)) : fb.redFlags,
    rescuePlan: Array.isArray(value?.rescuePlan) ? value.rescuePlan.slice(0, 7).map((x) => String(x).slice(0, 260)) : fb.rescuePlan,
    fixedStructure: Array.isArray(value?.fixedStructure) ? value.fixedStructure.slice(0, 10).map((x) => String(x).slice(0, 180)) : fb.fixedStructure,
    rewriteStarter: String(value?.rewriteStarter || fb.rewriteStarter).slice(0, 900),
    finalSizzle: String(value?.finalSizzle || fb.finalSizzle).slice(0, 420)
  };
}

async function roastWithOpenAI({ repo, readme }) {
  if (!process.env.OPENAI_API_KEY) throw new Error('Falta OPENAI_API_KEY en Vercel. Sin gas no hay parrilla.');
  const model = process.env.OPENAI_MODEL || 'gpt-4.1-nano';
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model,
    temperature: 0.82,
    max_tokens: 1900,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'Eres La Rostizadora Digital: parrillera digital española, cínica, divertida y útil. Criticas READMEs de GitHub. Primero quemas con humor; luego das soluciones accionables. No insultas a la persona, solo al caos documental. Responde siempre en JSON válido.' },
      { role: 'user', content: `Analiza este README de ${repo.fullName}. Devuelve JSON con estas claves exactas: score number 0-100, heatLevel string, verdict string, openingBurn string, roast {claridad, confianza, uso}, salvable string, redFlags array, rescuePlan array, fixedStructure array, rewriteStarter string, finalSizzle string.\n\nREADME:\n---\n${readme}\n---` }
    ]
  });
  return normalizeAnalysis(parseJson(completion.choices?.[0]?.message?.content), repo.fullName);
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const repo = normalizeRepoInput(url.searchParams.get('repo'));
    if (!repo) return Response.json({ error: 'Formato inválido. Usa usuario/repositorio o una URL pública de GitHub.' }, { status: 400 });

    const rate = checkRateLimit(clientIp(request));
    if (rate.limited) return Response.json({ error: `Has usado los ${rate.limit} análisis de hoy. La parrilla también tiene factura.`, rate }, { status: 429 });

    const readme = await fetchReadme(repo);
    const model = process.env.OPENAI_MODEL || 'gpt-4.1-nano';
    const cacheKey = `roast:${repo.fullName}:${model}:${hash(readme.text)}`;
    const cached = getCache(cacheKey);
    if (cached) return Response.json({ ...cached, cached: true, rate });

    const analysis = await roastWithOpenAI({ repo, readme: readme.text });
    const payload = {
      repo: { fullName: repo.fullName, readmePath: 'README', charactersAnalyzed: readme.text.length, originalCharacters: readme.originalLength, wasTrimmed: readme.wasTrimmed },
      analysis,
      limits: { model, maxReadmeChars: MAX_README_CHARS, cacheTtlSeconds: CACHE_TTL_SECONDS },
      cached: false
    };
    setCache(cacheKey, payload);
    return Response.json({ ...payload, rate });
  } catch (err) {
    return Response.json({ error: err.message || 'Error interno. La parrilla explotó de forma poco elegante.' }, { status: 500 });
  }
}
