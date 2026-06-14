import { createHash } from 'node:crypto';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API = 'https://api.github.com';
const RAW = 'https://raw.githubusercontent.com';
const MAX = Number.parseInt(process.env.MAX_README_CHARS || '30000', 10);
const LIMIT = Number.parseInt(process.env.RATE_LIMIT_PER_DAY || '3', 10);
const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-nano';
const KEY = process.env['OPENAI_API_KEY'];
const NAMES = ['README.md', 'README.MD', 'README', 'readme.md', 'Readme.md', 'README.rst', 'README.txt'];

function sha(v) { return createHash('sha256').update(v).digest('hex'); }
function mem() { globalThis.__lrd ||= { rate: new Map(), cache: new Map() }; return globalThis.__lrd; }
function repoFrom(input) {
  if (!input || typeof input !== 'string') return null;
  const clean = input.trim().replace(/\.git$/i, '').replace(/\/$/, '');
  let owner, repo;
  if (/^https?:\/\//i.test(clean)) {
    const u = new URL(clean);
    if (u.hostname.toLowerCase() !== 'github.com') return null;
    [owner, repo] = u.pathname.split('/').filter(Boolean);
  } else [owner, repo] = clean.split('/').filter(Boolean);
  if (!owner || !repo) return null;
  if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) return null;
  return { owner, repo, fullName: `${owner}/${repo}` };
}
function headers(raw = false) {
  const h = { Accept: raw ? 'application/vnd.github.raw' : 'application/vnd.github+json', 'User-Agent': 'la-rostizadora-digital' };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}
async function text(url, h = {}) {
  const r = await fetch(url, { headers: h, cache: 'no-store' });
  if (!r.ok) return null;
  const t = await r.text();
  if (!t.trim() || /^\s*</.test(t)) return null;
  return t;
}
async function meta(rp) {
  const r = await fetch(`${API}/repos/${rp.owner}/${rp.repo}`, { headers: headers(), cache: 'no-store' });
  if (r.status === 404) throw new Error('Repositorio privado, inexistente o URL mal pegada. Pega usuario/repositorio y deja la decoración para Canva.');
  if (r.status === 403) throw new Error('GitHub está limitando consultas. Añade GITHUB_TOKEN en Vercel.');
  if (!r.ok) throw new Error(`GitHub respondió ${r.status}.`);
  const j = await r.json();
  return j.default_branch || 'main';
}
function trimReadme(t, source) {
  return { text: t.length > MAX ? t.slice(0, MAX) : t, original: t.length, trimmed: t.length > MAX, source };
}
async function readme(rp) {
  const direct = await text(`${API}/repos/${rp.owner}/${rp.repo}/readme`, headers(true));
  if (direct) return trimReadme(direct, 'github-readme-api');
  const def = await meta(rp);
  const branches = [...new Set([def, 'main', 'master', 'develop', 'dev'].filter(Boolean))];
  for (const b of branches) for (const n of NAMES) {
    const raw = await text(`${RAW}/${rp.owner}/${rp.repo}/${encodeURIComponent(b)}/${n}`);
    if (raw) return trimReadme(raw, `raw:${b}/${n}`);
    const api = await text(`${API}/repos/${rp.owner}/${rp.repo}/contents/${n}?ref=${encodeURIComponent(b)}`, headers(true));
    if (api) return trimReadme(api, `api:${b}/${n}`);
  }
  throw new Error('No encontré README público. Probé API de GitHub, raw.githubusercontent.com, main, master y nombres habituales. Si existe, GitHub está haciendo de portero.');
}
function rate(req) {
  const ip = (req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'x').trim();
  const k = sha(ip); const now = Date.now(); const reset = new Date(); reset.setUTCHours(24,0,0,0);
  const s = mem(); const e = s.rate.get(k);
  if (e && e.reset > now && e.count >= LIMIT) return { limited: true, remaining: 0, limit: LIMIT, resetInSeconds: Math.ceil((e.reset - now) / 1000) };
  const next = e && e.reset > now ? { count: e.count + 1, reset: e.reset } : { count: 1, reset: reset.getTime() };
  s.rate.set(k, next);
  return { limited: false, remaining: Math.max(0, LIMIT - next.count), limit: LIMIT, resetInSeconds: Math.ceil((next.reset - now) / 1000) };
}
function basic(name) {
  return { score: 55, heatLevel: 'Brasas básicas', verdict: `El README de ${name} necesita un primer bloque más claro, prueba rápida y señales de confianza.`, openingBurn: 'Hay README, pero todavía huele a “ya se entiende”. Spoiler: no, criatura.', roast: { claridad: 'Explica qué hace, para quién y qué resultado entrega en las primeras líneas.', confianza: 'Añade demo, captura, badges, estado del proyecto o ejemplo real.', uso: 'Instalación y primer uso deben ser obvios, cortos y copiables.' }, salvable: 'La estructura se puede salvar si conviertes el README en una ruta de entrada, no en un cajón técnico.', redFlags: ['Promesa inicial débil', 'Primer uso poco inmediato', 'Faltan señales de confianza'], rescuePlan: ['Reescribe la apertura con problema, solución y resultado', 'Añade demo o captura arriba', 'Pon instalación y primer uso en pasos mínimos', 'Separa configuración, ejemplos y limitaciones'], fixedStructure: ['Promesa', 'Demo', 'Instalación', 'Primer uso', 'Configuración', 'Ejemplo', 'Limitaciones', 'Roadmap'], rewriteStarter: `${name}: herramienta para [usuario] que consigue [resultado] sin [dolor].`, finalSizzle: 'Terminado y claro gana a perfecto y confuso. Ahora deja de ahumar el README y sírvelo bien.' };
}
function norm(v, name) {
  const f = basic(name);
  return { score: typeof v?.score === 'number' ? Math.max(0, Math.min(100, Math.round(v.score))) : f.score, heatLevel: String(v?.heatLevel || f.heatLevel).slice(0,90), verdict: String(v?.verdict || f.verdict).slice(0,520), openingBurn: String(v?.openingBurn || f.openingBurn).slice(0,520), roast: { claridad: String(v?.roast?.claridad || f.roast.claridad).slice(0,850), confianza: String(v?.roast?.confianza || f.roast.confianza).slice(0,850), uso: String(v?.roast?.uso || f.roast.uso).slice(0,850) }, salvable: String(v?.salvable || f.salvable).slice(0,800), redFlags: Array.isArray(v?.redFlags) ? v.redFlags.slice(0,7) : f.redFlags, rescuePlan: Array.isArray(v?.rescuePlan) ? v.rescuePlan.slice(0,8) : f.rescuePlan, fixedStructure: Array.isArray(v?.fixedStructure) ? v.fixedStructure.slice(0,11) : f.fixedStructure, rewriteStarter: String(v?.rewriteStarter || f.rewriteStarter).slice(0,1200), finalSizzle: String(v?.finalSizzle || f.finalSizzle).slice(0,520) };
}
function parse(s) { try { return JSON.parse(s); } catch { const m = s?.match(/\{[\s\S]*\}/); if (!m) return null; try { return JSON.parse(m[0]); } catch { return null; } } }
async function ai(rp, md) {
  if (!KEY) return { ...basic(rp.fullName), mode: 'basic-no-key' };
  const openai = new OpenAI({ apiKey: KEY });
  const c = await openai.chat.completions.create({ model: MODEL, temperature: 0.85, max_tokens: 2200, response_format: { type: 'json_object' }, messages: [
    { role: 'system', content: 'Eres La Rostizadora Digital. Auditas READMEs de GitHub en español. Estilo: cínico, divertido y útil. Primero roast breve, luego acciones. Sé específico: propuesta, demo, instalación, quickstart, ejemplos, confianza, licencia, límites y roadmap. Devuelve solo JSON válido.' },
    { role: 'user', content: `Repo: ${rp.fullName}\nDevuelve JSON con score, heatLevel, verdict, openingBurn, roast{claridad,confianza,uso}, salvable, redFlags, rescuePlan, fixedStructure, rewriteStarter, finalSizzle.\nREADME:\n${md}` }
  ]});
  return norm(parse(c.choices?.[0]?.message?.content), rp.fullName);
}
export async function GET(req) {
  try {
    const rp = repoFrom(new URL(req.url).searchParams.get('repo'));
    if (!rp) return Response.json({ error: 'Formato inválido. Usa usuario/repositorio o URL pública de GitHub.' }, { status: 400 });
    const rl = rate(req); if (rl.limited) return Response.json({ error: `Límite diario alcanzado: ${rl.limit} análisis.`, rate: rl }, { status: 429 });
    const rd = await readme(rp); const cacheKey = sha(`${rp.fullName}:${MODEL}:${rd.text}`); const hit = mem().cache.get(cacheKey);
    if (hit && hit.exp > Date.now()) return Response.json({ ...hit.data, cached: true, rate: rl });
    const analysis = await ai(rp, rd.text);
    const data = { repo: { fullName: rp.fullName, readmePath: rd.source, charactersAnalyzed: rd.text.length, originalCharacters: rd.original, wasTrimmed: rd.trimmed }, analysis, setupWarning: KEY ? null : 'La clave de OpenAI no está configurada en Vercel. Resultado básico temporal.', limits: { model: KEY ? MODEL : 'basic-no-key', maxReadmeChars: MAX }, cached: false };
    mem().cache.set(cacheKey, { exp: Date.now() + 604800000, data });
    return Response.json({ ...data, rate: rl });
  } catch (e) { return Response.json({ error: e.message || 'Error interno.' }, { status: 500 }); }
}
